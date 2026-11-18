import { describe, expect, it } from "vitest"
import { parseProfileBio, MAX_PROFILE_BIO_LENGTH } from "@/lib/validation/profile-bio"
import { normalizeSearchInput, MAX_TITLE_SEARCH_TEXT_LENGTH } from "@/lib/validation/title-search"

describe("profile bio boundary", () => {
  it("accepts ordinary text and rejects an oversized or file value", () => {
    expect(parseProfileBio("A short biography")).toBe("A short biography")
    expect(parseProfileBio(null)).toBe("")
    expect(() => parseProfileBio("x".repeat(MAX_PROFILE_BIO_LENGTH + 1))).toThrow("2000 characters")

    const form = new FormData()
    form.set("bio", new Blob(["not text"]), "bio.txt")
    expect(() => parseProfileBio(form.get("bio"))).toThrow("Bio must be text")
  })
})

describe("title search boundary", () => {
  it("bounds every text field and genre array before search work begins", () => {
    expect(normalizeSearchInput({ title: " Dune ", author: "", raw: "", genres: ["FANTASY"] }))
      .toMatchObject({ title: "Dune", genres: ["FANTASY"] })

    expect(() => normalizeSearchInput("x".repeat(MAX_TITLE_SEARCH_TEXT_LENGTH + 1)))
      .toThrow("200 characters")
    expect(() => normalizeSearchInput({ author: "x".repeat(MAX_TITLE_SEARCH_TEXT_LENGTH + 1) }))
      .toThrow("200 characters")
    expect(() => normalizeSearchInput({ raw: "x".repeat(MAX_TITLE_SEARCH_TEXT_LENGTH + 1) }))
      .toThrow("200 characters")
    expect(() => normalizeSearchInput({ genres: new Array(33).fill("FANTASY") }))
      .toThrow("Invalid title search genres")
    expect(() => normalizeSearchInput({ raw: 12 })).toThrow("Invalid title search input")
  })
})
