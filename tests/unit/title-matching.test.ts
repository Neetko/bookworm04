import { beforeEach, describe, expect, it, vi } from "vitest"
import { createFakeSupabase } from "./fake-supabase"
import { createAdminClient } from "@/lib/supabase-server"
import { findExistingTitleForGoogleVolume } from "@/lib/server/title-matching"

vi.mock("@/lib/supabase-server", () => ({
  createAdminClient: vi.fn(),
}))

function setAdminTables(tables: Record<string, Array<Record<string, any>>>) {
  vi.mocked(createAdminClient).mockReturnValue(createFakeSupabase({ tables }) as any)
}

describe("title matching", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("uses title_sources before ISBN-based matches", async () => {
    setAdminTables({
      title_sources: [{ source: "google", external_id: "volume-1", title_id: "source-title" }],
      reference_isbns: [{ isbn: "9780441172719", title_id: "reference-title" }],
      titles: [
        { id: "source-title", title: "Dune", author: "Frank Herbert", isbn: null },
        { id: "reference-title", title: "Dune", author: "Frank Herbert", isbn: "9780441172719" },
      ],
    })

    await expect(
      findExistingTitleForGoogleVolume({
        volumeId: "volume-1",
        title: "Dune",
        author: "Frank Herbert",
        isbns: ["9780441172719"],
        selectFields: "id,title,author,isbn",
      })
    ).resolves.toMatchObject({
      titleId: "source-title",
      source: "google-source",
      confidenceScore: 100,
      isAmbiguous: false,
    })
  })

  it("returns null instead of choosing a primary ISBN collision", async () => {
    setAdminTables({
      title_sources: [],
      reference_isbns: [],
      titles: [
        { id: "edition-a", title: "Dune", author: "Frank Herbert", isbn: "9780441172719" },
        { id: "edition-b", title: "Dune", author: "Frank Herbert", isbn: "9780441172719" },
      ],
    })

    await expect(
      findExistingTitleForGoogleVolume({
        volumeId: "volume-2",
        title: "Dune",
        author: "Frank Herbert",
        isbns: ["9780441172719"],
        selectFields: "id,title,author,isbn",
      })
    ).resolves.toBeNull()
  })

  it("uses a canonical work match before edition ISBNs", async () => {
    setAdminTables({
      title_sources: [],
      title_reference_works: [{ work_id: "OL-work", title_id: "canonical-work" }],
      reference_isbns: [],
      titles: [
        { id: "canonical-work", title: "Dune", author: "Frank Herbert", isbn: null, work_id: "OL-work" },
        { id: "different-edition", title: "Dune", author: "Frank Herbert", isbn: "9780441172719" },
      ],
    })

    await expect(
      findExistingTitleForGoogleVolume({
        volumeId: "volume-work-match",
        workId: "OL-work",
        title: "Dune",
        author: "Frank Herbert",
        isbns: ["9780441172719"],
        selectFields: "id,title,author,isbn,work_id",
      })
    ).resolves.toMatchObject({
      titleId: "canonical-work",
      source: "reference-work",
      confidenceScore: 99,
      isAmbiguous: false,
    })
  })

  it("falls back to exact title-author after ISBN sources miss", async () => {
    setAdminTables({
      title_sources: [],
      reference_isbns: [],
      titles: [
        { id: "other-book", title: "Dune Messiah", author: "Frank Herbert", isbn: null },
        { id: "exact-book", title: "Dune", author: "Frank Herbert", isbn: null },
      ],
    })

    await expect(
      findExistingTitleForGoogleVolume({
        volumeId: "volume-3",
        title: "Dune",
        author: "Frank Herbert",
        isbns: [],
        selectFields: "id,title,author,isbn",
      })
    ).resolves.toMatchObject({
      titleId: "exact-book",
      source: "exact-title-author",
      confidenceScore: 80,
      isAmbiguous: false,
    })
  })

  it("matches ISBNs stored in the jsonb ISBN list", async () => {
    setAdminTables({
      title_sources: [],
      reference_isbns: [],
      titles: [
        {
          id: "jsonb-isbn-title",
          title: "Dune",
          author: "Frank Herbert",
          isbn: null,
          isbn_list: ["9780441172719"],
        },
      ],
    })

    await expect(
      findExistingTitleForGoogleVolume({
        volumeId: "volume-jsonb-isbn",
        title: "Dune",
        author: "Frank Herbert",
        isbns: ["9780441172719"],
        selectFields: "id,title,author,isbn,isbn_list",
      })
    ).resolves.toMatchObject({
      titleId: "jsonb-isbn-title",
      source: "isbn-list",
      confidenceScore: 94,
      isAmbiguous: false,
    })
  })
})
