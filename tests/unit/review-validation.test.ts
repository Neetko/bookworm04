import { describe, expect, it } from "vitest"
import { parseActionInput } from "@/lib/validation/action"
import { submitReviewSchema } from "@/lib/validation/reviews"

const titleId = "11111111-1111-4111-8111-111111111111"

describe("review submission validation", () => {
  it("accepts a valid rating and trims review HTML", () => {
    expect(
      parseActionInput(submitReviewSchema, {
        titleId,
        rating: 8,
        reviewText: "  <p>Sharp and memorable.</p>  ",
      })
    ).toEqual({
      titleId,
      rating: 8,
      reviewText: "<p>Sharp and memorable.</p>",
    })
  })

  it.each([0, 11, 4.5, Number.NaN])("rejects an invalid rating: %s", (rating) => {
    expect(() =>
      parseActionInput(submitReviewSchema, {
        titleId,
        rating,
        reviewText: "",
      })
    ).toThrow()
  })

  it("keeps missing and wrong-type field errors distinct", () => {
    expect(() => parseActionInput(submitReviewSchema, { titleId, reviewText: "" }))
      .toThrow("Rating is required")

    expect(() => parseActionInput(submitReviewSchema, { titleId, rating: "7", reviewText: "" }))
      .toThrow("Rating must be a number")
  })

  it("rejects invalid title ids and oversized review HTML", () => {
    expect(() =>
      parseActionInput(submitReviewSchema, {
        titleId: "not-a-title-id",
        rating: 7,
        reviewText: "",
      })
    ).toThrow("ID must be valid")

    expect(() =>
      parseActionInput(submitReviewSchema, {
        titleId,
        rating: 7,
        reviewText: "x".repeat(50_001),
      })
    ).toThrow("Review is too long")
  })
})
