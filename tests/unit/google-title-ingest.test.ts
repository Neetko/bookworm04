import { describe, expect, it } from "vitest"
import { createFakeSupabase } from "./fake-supabase"
import { findLocalTitleDuplicates } from "@/lib/server/google-title-ingest"

describe("google title ingest", () => {
  it("uses canonical local title search for duplicate preview rows", async () => {
    const supabase = createFakeSupabase({
      tables: {
        reference_isbns: [],
        titles: [
          {
            id: "dune",
            title: "Dune",
            author: "Frank Herbert",
            description: null,
            cover_image_url: "https://example.test/dune.jpg",
            published_year: 1965,
            isbn: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    })

    await expect(findLocalTitleDuplicates(supabase as any, "Dune", "Frank Herbert")).resolves.toEqual([
      {
        id: "dune",
        title: "Dune",
        author: "Frank Herbert",
        coverImageUrl: "https://example.test/dune.jpg",
        source: "title",
      },
    ])
  })
})
