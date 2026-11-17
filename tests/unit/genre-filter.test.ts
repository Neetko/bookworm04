import { describe, expect, it } from "vitest"
import { hasEverySelectedGenre } from "@/lib/genre-filter"

describe("hasEverySelectedGenre", () => {
  it("matches every title when no genre is selected", () => {
    expect(hasEverySelectedGenre(undefined, [])).toBe(true)
  })

  it("matches a title that contains every selected genre", () => {
    expect(hasEverySelectedGenre(["HORROR", "SCI-FI"], ["HORROR", "SCI-FI"])).toBe(true)
  })

  it("rejects a title when any selected genre is missing", () => {
    expect(hasEverySelectedGenre(["HORROR"], ["HORROR", "SCI-FI"])).toBe(false)
  })

  it("narrows results as more genres are selected", () => {
    const titles = [
      { name: "Frankenstein", genres: ["HORROR", "SCI-FI"] as const },
      { name: "Dracula", genres: ["HORROR"] as const },
      { name: "The Time Machine", genres: ["SCI-FI", "ADVENTURE"] as const },
    ]

    const horrorOnly = titles.filter((title) => hasEverySelectedGenre(title.genres, ["HORROR"]))
    const horrorAndScienceFiction = titles.filter((title) =>
      hasEverySelectedGenre(title.genres, ["HORROR", "SCI-FI"])
    )

    expect(horrorOnly.map((title) => title.name)).toEqual(["Frankenstein", "Dracula"])
    expect(horrorAndScienceFiction.map((title) => title.name)).toEqual(["Frankenstein"])
  })
})
