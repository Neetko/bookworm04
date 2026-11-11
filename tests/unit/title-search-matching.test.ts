import { beforeEach, describe, expect, it, vi } from "vitest"
import { createFakeSupabase } from "./fake-supabase"
import type { MergedWork } from "@/lib/google-books"
import { createAdminClient } from "@/lib/supabase-server"
import { getBestEffortCanonicalExternalMatchReport } from "@/lib/server/title-search-matching"

vi.mock("@/lib/supabase-server", () => ({
  createAdminClient: vi.fn(),
}))

function setAdminTables(tables: Record<string, Array<Record<string, any>>>) {
  vi.mocked(createAdminClient).mockReturnValue(createFakeSupabase({ tables }) as any)
}

function work(overrides: Partial<MergedWork>): MergedWork {
  return {
    source: "google-openlibrary",
    workId: overrides.workId ?? null,
    authorIds: [],
    volumeId: overrides.volumeId ?? "volume-1",
    title: overrides.title ?? "Dune",
    authors: overrides.authors ?? ["Frank Herbert"],
    publisher: null,
    publishedYear: null,
    description: null,
    thumbnailUrl: null,
    googleIdentifiers: overrides.googleIdentifiers ?? [],
    identifiers: overrides.identifiers ?? [],
    isbn: overrides.isbn ?? null,
    mainCategory: null,
    categories: [],
  }
}

describe("title search external matching", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("uses Google title source mappings before ISBN fallback", async () => {
    setAdminTables({
      title_sources: [{ source: "google", external_id: "volume-1", title_id: "source-title" }],
      reference_isbns: [{ isbn: "9780441172719", title_id: "reference-title" }],
      titles: [
        { id: "source-title", title: "Dune", author: "Frank Herbert", isbn: null },
        { id: "reference-title", title: "Dune", author: "Frank Herbert", isbn: "9780441172719" },
      ],
    })

    const report = await getBestEffortCanonicalExternalMatchReport([
      work({ volumeId: "volume-1", isbn: "9780441172719" }),
    ])

    expect(report.collisions.size).toBe(0)
    expect(report.matches.get("volume-1")).toEqual({
      titleId: "source-title",
      source: "title-source",
      confidenceScore: 100,
      isCollision: false,
    })
  })

  it("reports ISBN collisions instead of returning an unsafe single match", async () => {
    setAdminTables({
      title_sources: [],
      reference_isbns: [
        { isbn: "9780441172719", title_id: "title-a" },
        { isbn: "9780441172719", title_id: "title-b" },
      ],
      titles: [
        { id: "title-a", title: "Dune", author: "Frank Herbert", isbn: null },
        { id: "title-b", title: "Dune", author: "Frank Herbert", isbn: null },
      ],
    })

    const report = await getBestEffortCanonicalExternalMatchReport([
      work({ volumeId: "volume-2", isbn: "9780441172719" }),
    ])

    expect(report.matches.size).toBe(0)
    expect(report.collisions.get("volume-2")).toEqual({
      titleIds: ["title-a", "title-b"],
      source: "reference-isbn",
      confidenceScore: 98,
      isCollision: true,
    })
  })

  it("matches an external edition through its canonical work ID", async () => {
    setAdminTables({
      title_sources: [],
      title_reference_works: [{ work_id: "OL-work", title_id: "canonical-work" }],
      reference_isbns: [],
      titles: [
        { id: "canonical-work", title: "Dune", author: "Frank Herbert", isbn: null, work_id: "OL-work" },
      ],
    })

    const report = await getBestEffortCanonicalExternalMatchReport([
      work({ volumeId: "volume-work", workId: "OL-work", isbn: "9780441172719" }),
    ])

    expect(report.matches.get("volume-work")).toEqual({
      titleId: "canonical-work",
      source: "reference-work",
      confidenceScore: 99,
      isCollision: false,
    })
  })

  it("falls back to exact title-author only after source and ISBN paths miss", async () => {
    setAdminTables({
      title_sources: [],
      reference_isbns: [],
      titles: [
        { id: "other", title: "Dune Messiah", author: "Frank Herbert", isbn: null },
        { id: "exact", title: "Dune", author: "Frank Herbert", isbn: null },
      ],
    })

    const report = await getBestEffortCanonicalExternalMatchReport([
      work({ volumeId: "volume-3", title: "Dune", authors: ["Frank Herbert"] }),
    ])

    expect(report.matches.get("volume-3")).toEqual({
      titleId: "exact",
      source: "exact-title-author",
      confidenceScore: 80,
      isCollision: false,
    })
  })
})
