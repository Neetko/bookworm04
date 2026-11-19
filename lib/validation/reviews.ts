import { z } from "zod"
import { uuidSchema } from "@/lib/validation/primitives"

const MAX_REVIEW_HTML_LENGTH = 50_000

export const submitReviewSchema = z.object({
  titleId: uuidSchema,
  rating: z
    .number({
      error: (issue) => issue.input === undefined ? "Rating is required" : "Rating must be a number",
    })
    .finite("Rating must be a valid number")
    .int("Rating must be a whole number")
    .min(1, "Rating must be at least 1")
    .max(10, "Rating cannot be greater than 10"),
  reviewText: z
    .string({
      error: (issue) => issue.input === undefined ? "Review is required" : "Review must be text",
    })
    .trim()
    .max(MAX_REVIEW_HTML_LENGTH, "Review is too long"),
})

export type SubmitReviewInput = z.input<typeof submitReviewSchema>
