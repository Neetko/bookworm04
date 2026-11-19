import { z } from "zod"
import { GENRES, type Genre } from "@/lib/types"

const genreValues = [...GENRES] as [Genre, ...Genre[]]

export const uuidSchema = z
  .string({
    error: (issue) => issue.input === undefined ? "ID is required" : "ID must be text",
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
      error: (issue) => issue.input === undefined ? `${label} is required` : `${label} must be text`,
    })
    .trim()
    .min(1, `${label} is required`)
    .max(maxLength, `${label} is too long`)
}

export function optionalTrimmedString(label: string, maxLength = 50_000) {
  return z
    .string({
      error: `${label} must be text`,
    })
    .trim()
    .max(maxLength, `${label} is too long`)
    .optional()
}

export const genreSchema = z.enum(genreValues, {
  error: (issue) => issue.input === undefined
    ? "Genre is required"
    : "Genre must be one of Bookworm's canonical genres",
})

export const genreListSchema = z
  .array(genreSchema, {
    error: (issue) => issue.input === undefined ? "Select at least one genre" : "Genres must be a list",
  })
  .min(1, "Select at least one genre")
  .transform((genres) => Array.from(new Set(genres)))

export const optionalGenreListSchema = z
  .array(genreSchema, {
    error: "Genres must be a list",
  })
  .optional()
  .transform((genres) => (genres ? Array.from(new Set(genres)) : undefined))

export function nonNegativeInteger(label: string) {
  return z
    .number({
      error: (issue) => issue.input === undefined ? `${label} is required` : `${label} must be a number`,
    })
    .finite(`${label} must be a valid number`)
    .int(`${label} must be a whole number`)
    .min(0, `${label} cannot be negative`)
}

export function positiveInteger(label: string, max = 100_000) {
  return z
    .number({
      error: (issue) => issue.input === undefined ? `${label} is required` : `${label} must be a number`,
    })
    .finite(`${label} must be a valid number`)
    .int(`${label} must be a whole number`)
    .min(1, `${label} is required`)
    .max(max, `${label} is too large`)
}
