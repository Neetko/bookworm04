import { z } from "zod"
import { GENRES, type Genre } from "@/lib/types"

const genreValues = [...GENRES] as [Genre, ...Genre[]]

export const uuidSchema = z
  .string({
    required_error: "ID is required",
    invalid_type_error: "ID must be text",
  })
  .trim()
  .uuid("ID must be valid")

export const optionalUuidSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  uuidSchema.optional()
)

export const nullableUuidSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  uuidSchema.nullable()
)

export function requiredString(label: string, maxLength = 500) {
  return z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be text`,
    })
    .trim()
    .min(1, `${label} is required`)
    .max(maxLength, `${label} is too long`)
}

export function optionalTrimmedString(label: string, maxLength = 50_000) {
  return z
    .string({
      invalid_type_error: `${label} must be text`,
    })
    .trim()
    .max(maxLength, `${label} is too long`)
    .optional()
}

export const genreSchema = z.enum(genreValues, {
  invalid_type_error: "Genre must be one of Bookworm's canonical genres",
  required_error: "Genre is required",
})

export const genreListSchema = z
  .array(genreSchema, {
    invalid_type_error: "Genres must be a list",
    required_error: "Select at least one genre",
  })
  .min(1, "Select at least one genre")
  .transform((genres) => Array.from(new Set(genres)))

export const optionalGenreListSchema = z
  .array(genreSchema, {
    invalid_type_error: "Genres must be a list",
  })
  .optional()
  .transform((genres) => (genres ? Array.from(new Set(genres)) : undefined))

export function nonNegativeInteger(label: string) {
  return z
    .number({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be a number`,
    })
    .finite(`${label} must be a valid number`)
    .int(`${label} must be a whole number`)
    .min(0, `${label} cannot be negative`)
}

export function positiveInteger(label: string, max = 100_000) {
  return z
    .number({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be a number`,
    })
    .finite(`${label} must be a valid number`)
    .int(`${label} must be a whole number`)
    .min(1, `${label} is required`)
    .max(max, `${label} is too large`)
}
