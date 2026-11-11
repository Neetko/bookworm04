import { describe, expect, it } from "vitest"
import {
  collapseGoogleBooksItems,
  extractAsins,
  extractIsbns,
  isIsbn10,
  isIsbn13,
  type RawGoogleBook,
} from "@/lib/google-books"

describe("Google Books helpers", () => {
  it("normalizes and dedupes ISBN identifiers", () => {
    expect(
      extractIsbns([
        { type: "ISBN_13", identifier: "978 014 0328721" },
        { type: "ISBN_13", identifier: "9780140328721" },
        { type: "ISBN_10", identifier: "0140328726" },
      ])
    ).toEqual(["9780140328721", "0140328726"])
  })

  it("extracts ASIN identifiers separately from ISBNs", () => {
    expect(
      extractAsins([
        { type: "ASIN", identifier: " B000000001 " },
        { type: "ISBN_13", identifier: "9780140328721" },
      ])
    ).toEqual(["B000000001"])
  })

  it("validates ISBN shapes", () => {
    expect(isIsbn13("9780140328721")).toBe(true)
    expect(isIsbn13("0140328726")).toBe(false)
    expect(isIsbn10("0140328726")).toBe(true)
    expect(isIsbn10("9780140328721")).toBe(false)
  })

  it("collapses duplicate Google volumes and prefers richer metadata", () => {
    const items: RawGoogleBook[] = [
      {
        id: "thin",
        volumeInfo: {
          title: "Dune: A Novel",
          authors: ["Frank Herbert"],
          description: "Short.",
          publishedDate: "1965",
          industryIdentifiers: [{ type: "ISBN_13", identifier: "9780441172719" }],
        },
      },
      {
        id: "rich",
        volumeInfo: {
          title: "Dune",
          authors: ["Frank Herbert"],
          description: "A longer description for the richer volume.",
          imageLinks: { thumbnail: "http://example.com/dune.jpg" },
          publishedDate: "1965-08-01",
          industryIdentifiers: [{ type: "ISBN_13", identifier: "9780441172719" }],
        },
      },
    ]

    expect(collapseGoogleBooksItems(items)).toMatchObject([
      {
        volumeId: "rich",
        title: "Dune",
        thumbnailUrl: "https://example.com/dune.jpg",
      },
    ])
  })
})
