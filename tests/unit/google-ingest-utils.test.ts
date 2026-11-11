import { describe, expect, it } from "vitest"
import type { OpenLibraryEdition, OpenLibraryWorkCandidate } from "@/lib/open-library"
import {
  classifyOpenLibraryCandidateMatch,
  computeStringSimilarity,
  deriveFormat,
  extractIsbnParts,
  findMatchingEdition,
  mergeDupeWorkIds,
  mergeIsbnLists,
  resolveWorkSelection,
} from "@/lib/google-ingest-utils"

function candidate(overrides: Partial<OpenLibraryWorkCandidate>): OpenLibraryWorkCandidate {
  return {
    workId: overrides.workId ?? "OL1W",
    title: overrides.title ?? "Dune",
    author: overrides.author ?? "Frank Herbert",
    coverUrl: overrides.coverUrl ?? null,
    firstPublishYear: overrides.firstPublishYear ?? 1965,
    editionCount: overrides.editionCount ?? 10,
    subjects: overrides.subjects ?? [],
  }
}

function edition(overrides: Partial<OpenLibraryEdition>): OpenLibraryEdition {
  return {
    isbn10: overrides.isbn10 ?? [],
    isbn13: overrides.isbn13 ?? [],
    physicalFormat: overrides.physicalFormat ?? null,
    physicalDescription: overrides.physicalDescription ?? null,
    physicalDimensions: overrides.physicalDimensions ?? null,
  }
}

describe("google ingest utilities", () => {
  it("classifies exact title-author matches as automatic dupes", () => {
    expect(
      classifyOpenLibraryCandidateMatch({
        title: "Dune",
        author: "Frank Herbert",
        candidate: candidate({ title: "Dune", author: "Frank Herbert" }),
      })
    ).toMatchObject({
      confidenceScore: 100,
      matchType: "exact_auto_dupe",
    })
  })

  it("keeps low-confidence candidate matches for user review", () => {
    expect(
      classifyOpenLibraryCandidateMatch({
        title: "Dune",
        author: "Frank Herbert",
        candidate: candidate({ title: "Dune Messiah", author: "Frank Herbert" }),
      })
    ).toMatchObject({
      matchType: "user_review",
    })
  })

  it("computes bounded string similarity", () => {
    expect(computeStringSimilarity("Dune", "Dune")).toBe(1)
    expect(computeStringSimilarity("Dune", "")).toBe(0)
    expect(computeStringSimilarity("Dune", "Dune Messiah")).toBeGreaterThan(0)
    expect(computeStringSimilarity("Dune", "Dune Messiah")).toBeLessThan(1)
  })

  it("resolves the first selected work as primary and dedupes repeated selections", () => {
    expect(resolveWorkSelection(["OL1W", "OL2W", "OL1W", ""])).toEqual({
      primaryWorkId: "OL1W",
      dupeWorkIds: ["OL2W"],
    })
  })

  it("merges ISBNs and duplicate work IDs without keeping the primary work ID as a dupe", () => {
    expect(mergeIsbnLists(["9780441172719"], ["9780441172719", "0441172717"])).toEqual([
      "9780441172719",
      "0441172717",
    ])

    expect(mergeDupeWorkIds(["OL1W"], ["OL2W", "OL3W"], "OL2W")).toEqual(["OL1W", "OL3W"])
  })

  it("extracts ISBN-10 and ISBN-13 identifiers", () => {
    expect(extractIsbnParts(["978 0441172719", "0441172717"])).toEqual({
      isbn10: "0441172717",
      isbn13: "9780441172719",
    })
  })

  it("matches Open Library editions by ISBN priority", () => {
    const first = edition({ isbn10: ["0441172717"] })
    const second = edition({ isbn13: ["9780441172719"] })
    const match = findMatchingEdition([first, second], ["9780441172719", "0441172717"])

    expect(match).toBe(second)
  })

  it("derives practical format labels from category and physical metadata", () => {
    expect(deriveFormat({ categories: ["Audiobooks"] })).toBe("audiobook")
    expect(deriveFormat({ physicalDimensions: "18 cm" })).toBe("paperback")
    expect(deriveFormat({ dimensions: { height: "23 cm" } })).toBe("hardcover")
    expect(deriveFormat({ physicalDescription: "large print edition" })).toBe("large-print")
  })
})
