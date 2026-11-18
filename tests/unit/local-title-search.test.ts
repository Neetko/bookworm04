import { describe, expect, it } from "vitest"
import { createFakeSupabase } from "./fake-supabase"
import {
  extractSearchIsbns,
  getCanonicalLocalTitleMatches,
  searchLocalTitleRows,
  uniqueLocalTitleRows,
  type LocalTitleRow,
} from "@/lib/server/local-title-search"

function title(overrides: Partial<LocalTitleRow>): LocalTitleRow {
  return {
    id: overrides.id ?? "title-1",
    title: overrides.title ?? "Dune",
    author: overrides.author ?? "Frank Herbert",
    description: overrides.description ?? null,
    cover_image_url: overrides.cover_image_url ?? null,
    published_year: overrides.published_year ?? 1965,
    isbn: overrides.isbn ?? null,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-01-01T00:00:00.000Z",
  }
}

describe("local title search", () => {
  it("extracts ISBNs from messy search input", () => {
    expect(
      extractSearchIsbns({
        title: "",
        author: "",
        raw: "ISBN: 978-0-441-17271-9",
      })
    ).toEqual(["9780441172719"])
  })

  it("dedupes rows while preserving first-seen order", () => {
    expect(
      uniqueLocalTitleRows([
        title({ id: "a", title: "A" }),
        title({ id: "b", title: "B" }),
        title({ id: "a", title: "A duplicate" }),
      ]).map((row) => row.id)
    ).toEqual(["a", "b"])
  })

  it("prefers reference ISBN matches before broad text fallback", async () => {
    const supabase = createFakeSupabase({
      tables: {
        reference_isbns: [{ isbn: "9780441172719", title_id: "canonical" }],
        titles: [
          title({
            id: "fallback",
            title: "Dune",
            author: "Frank Herbert",
            isbn: "0441172717",
          }),
          title({
            id: "canonical",
            title: "Dune: canonical edition",
            author: "Frank Herbert",
            isbn: null,
          }),
        ],
      },
    })

    const rows = await searchLocalTitleRows(supabase as any, {
      title: "Dune",
      author: "",
      raw: "9780441172719",
    })

    expect(rows.map((row) => row.id)).toEqual(["canonical", "fallback"])
  })

  it("marks exact title-author collisions instead of pretending there is one safe match", async () => {
    const supabase = createFakeSupabase({
      tables: {
        reference_isbns: [],
        titles: [
          title({ id: "king", title: "The Stand", author: "Stephen King" }),
          title({ id: "king-alt", title: "The Stand", author: "Stephen King" }),
        ],
      },
    })

    const matches = await getCanonicalLocalTitleMatches(supabase as any, {
      title: "The Stand",
      author: "Stephen King",
      raw: "",
    })

    expect(matches).toEqual([
      {
        titleId: "king",
        source: "exact-title-author",
        confidenceScore: 80,
        isCollision: true,
      },
      {
        titleId: "king-alt",
        source: "exact-title-author",
        confidenceScore: 80,
        isCollision: true,
      },
    ])
  })

  it("treats punctuation in raw search as data and combines title and author matches", async () => {
    const fake = createFakeSupabase({
      tables: {
        titles: [
          title({ id: "title-match", title: "Dune,author.ilike.%", author: "Writer" }),
          title({ id: "author-match", title: "The Desert", author: "Dune,author.ilike.%" }),
          title({ id: "unrelated", title: "Unrelated", author: "Someone Else" }),
        ],
      },
    })
    let orCalls = 0
    const supabase = {
      ...fake,
      from(table: string) {
        const query = fake.from(table)
        query.or = () => {
          orCalls += 1
          throw new Error("Raw search used a combined filter")
        }
        return query
      },
    }

    const rows = await searchLocalTitleRows(supabase as any, {
      title: "",
      author: "",
      raw: "Dune,author.ilike.%",
    })

    expect(rows.map((row) => row.id)).toEqual(["title-match", "author-match"])
    expect(orCalls).toBe(0)
  })
})
