import { describe, expect, it } from "vitest"
import { MAX_ONBOARDING_FOLLOWS, MAX_ONBOARDING_TITLES } from "@/lib/onboarding-limits"
import { parseOnboardingSelections, parseOnboardingTitleIds } from "@/lib/validation/onboarding"

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`

function validInput() {
  return {
    favoriteGenres: ["MYSTERY"],
    finishedTitleIds: [id(1)],
    currentTitleIds: [id(2)],
    plannedTitleIds: [],
    followProfileIds: [id(3)],
  }
}

describe("onboarding selection validation", () => {
  it("accepts bounded selections and rejects invalid or repeated title ids", () => {
    expect(parseOnboardingSelections(validInput())).toMatchObject({ ok: true })
    expect(parseOnboardingSelections({ ...validInput(), currentTitleIds: [id(1)] })).toMatchObject({ ok: false })
    expect(parseOnboardingSelections({ ...validInput(), followProfileIds: ["not-a-uuid"] })).toMatchObject({ ok: false })
  })

  it("rejects oversized arrays before parsing their elements", () => {
    const oversizedTitles = Array.from({ length: MAX_ONBOARDING_TITLES + 1 }, (_, index) => id(index + 1))
    Object.defineProperty(oversizedTitles, 0, { get: () => { throw new Error("visited title") } })
    expect(parseOnboardingSelections({ ...validInput(), finishedTitleIds: oversizedTitles })).toMatchObject({ ok: false })

    const oversizedFollows = Array.from({ length: MAX_ONBOARDING_FOLLOWS + 1 }, (_, index) => id(index + 1))
    Object.defineProperty(oversizedFollows, 0, { get: () => { throw new Error("visited follow") } })
    expect(parseOnboardingSelections({ ...validInput(), followProfileIds: oversizedFollows })).toMatchObject({ ok: false })

    const oversizedGenres = ["MYSTERY", "MYSTERY", "MYSTERY", "MYSTERY", "MYSTERY", "MYSTERY", "MYSTERY", "MYSTERY"]
    Object.defineProperty(oversizedGenres, 0, { get: () => { throw new Error("visited genre") } })
    expect(parseOnboardingSelections({ ...validInput(), favoriteGenres: oversizedGenres })).toMatchObject({ ok: false })
  })

  it("caps the combined title count and suggestion lookups", () => {
    const finishedTitleIds = Array.from({ length: 30 }, (_, index) => id(index + 1))
    const currentTitleIds = Array.from({ length: 31 }, (_, index) => id(index + 31))
    expect(parseOnboardingSelections({ ...validInput(), finishedTitleIds, currentTitleIds })).toMatchObject({ ok: false })
    expect(parseOnboardingTitleIds(Array.from({ length: MAX_ONBOARDING_TITLES + 1 }, (_, index) => id(index + 1)))).toBeNull()
    expect(parseOnboardingTitleIds([id(1), id(1)])).toEqual([id(1)])
  })
})
