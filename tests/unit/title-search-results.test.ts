import { describe, expect, it } from "vitest"
import type { SearchTitleResult } from "@/lib/types"
import { buildTitleAuthorSearchKey, mergeSearchTitleResults } from "@/lib/title-search-results"

function result(overrides: Partial<SearchTitleResult>): SearchTitleResult {
  return {
    id: overrides.id ?? "id",
    source: overrides.source ?? "local",
    title: overrides.title ?? "Dune",
    author: overrides.author ?? "Frank Herbert",
    description: null,
    coverImageUrl: null,
    engagement: overrides.engagement ?? 0,
    ...overrides,
  }
}

describe("title search result merging", () => {
  it("normalizes punctuation and casing for title-author dedupe keys", () => {
    expect(
      buildTitleAuthorSearchKey({
        title: "Dune: A Novel",
        author: "FRANK  HERBERT",
      })
    ).toBe("dune a novel||frank herbert")
  })

  it("keeps local canonical results over matching external results", () => {
    const merged = mergeSearchTitleResults({
      localResults: [
        result({
          id: "local-dune",
          titleId: "local-dune",
          source: "local",
          engagement: 1,
        }),
      ],
      externalResults: [
        result({
          id: "google-dune",
          volumeId: "google-dune",
          source: "google",
          engagement: 99,
        }),
      ],
      query: { title: "Dune" },
    })

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      id: "local-dune",
      source: "local",
      titleId: "local-dune",
    })
  })

  it("does not collapse same-title results by different authors", () => {
    const merged = mergeSearchTitleResults({
      localResults: [
        result({
          id: "local-one",
          title: "The Stand",
          author: "Stephen King",
        }),
      ],
      externalResults: [
        result({
          id: "google-two",
          source: "google",
          title: "The Stand",
          author: "Other Writer",
        }),
      ],
      query: { title: "The Stand" },
    })

    expect(merged.map((entry) => entry.id).sort()).toEqual(["google-two", "local-one"])
  })
})
