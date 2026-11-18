import { z } from "zod"
import { ActionValidationError, parseActionInput } from "@/lib/validation/action"
import {
  genreListSchema,
  nonNegativeInteger,
  optionalTrimmedString,
  positiveInteger,
  requiredString,
  uuidSchema,
} from "@/lib/validation/primitives"

const MAX_READING_MINUTES = 1_000_000
const MAX_INGEST_WORK_CANDIDATES = 16
const MAX_INGEST_GENRES = 32

export const googleVolumeIdSchema = requiredString("Google volume ID", 200)

export const openLibraryWorkIdSchema = requiredString("Open Library work ID", 100)

export const pagesProgressSchema = z.object({
  mode: z.literal("pages"),
  currentPage: nonNegativeInteger("Current page"),
  totalPages: positiveInteger("Total pages"),
})

export const audiobookProgressSchema = z.object({
  mode: z.literal("audiobook"),
  minutesListened: nonNegativeInteger("Minutes listened"),
  totalMinutes: positiveInteger("Total minutes", MAX_READING_MINUTES),
})

export const trackProgressSchema = z
  .discriminatedUnion("mode", [
    pagesProgressSchema,
    audiobookProgressSchema,
  ])
  .superRefine((value, ctx) => {
    if (value.mode === "audiobook") {
      if (value.minutesListened > value.totalMinutes) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["minutesListened"],
          message: "Minutes listened cannot be greater than total minutes",
        })
      }
      return
    }

    if (value.currentPage > value.totalPages) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["currentPage"],
        message: "Current page cannot be greater than total pages",
      })
    }
  })

export const openLibraryWorkCandidateSchema = z.object({
  workId: openLibraryWorkIdSchema,
  title: requiredString("Work title", 500),
  author: requiredString("Work author", 500),
  firstPublishYear: z.number().int().nullable(),
  editionCount: z.number().int().min(0, "Edition count cannot be negative").nullable(),
  coverUrl: optionalTrimmedString("Cover URL", 2_000).nullable(),
})

export const confirmGoogleBookIngestSchema = z.object({
  volumeId: googleVolumeIdSchema,
  previewToken: uuidSchema.nullish(),
  selectedGenres: genreListSchema,
  selectedWorkIds: z
    .array(openLibraryWorkIdSchema)
    .max(MAX_INGEST_WORK_CANDIDATES)
    .optional()
    .default([])
    .transform((workIds) => Array.from(new Set(workIds))),
  requiresWorkSelection: z.boolean().optional(),
  workCandidates: z.array(openLibraryWorkCandidateSchema).max(MAX_INGEST_WORK_CANDIDATES).optional().default([]),
})

export function parseConfirmGoogleBookIngestInput(input: unknown) {
  // Reject oversized arrays before Zod visits every element and accumulates
  // an issue for each invalid item in a client-supplied server action payload.
  if (input && typeof input === "object") {
    const values = input as Record<string, unknown>
    if (Array.isArray(values.workCandidates) && values.workCandidates.length > MAX_INGEST_WORK_CANDIDATES) {
      throw new ActionValidationError("Too many Open Library work candidates")
    }
    if (Array.isArray(values.selectedWorkIds) && values.selectedWorkIds.length > MAX_INGEST_WORK_CANDIDATES) {
      throw new ActionValidationError("Too many selected Open Library works")
    }
    if (Array.isArray(values.selectedGenres) && values.selectedGenres.length > MAX_INGEST_GENRES) {
      throw new ActionValidationError("Too many genres")
    }
  }

  return parseActionInput(confirmGoogleBookIngestSchema, input)
}

export const ensureGoogleBookSchema = z.object({
  volumeId: googleVolumeIdSchema,
})

export const trackTitleProgressSchema = z.object({
  titleId: uuidSchema,
  progress: trackProgressSchema,
  noteHtml: optionalTrimmedString("Diary note", 50_000),
  noteText: optionalTrimmedString("Diary note", 20_000),
})

export const updateDiaryEntrySchema = z.object({
  entryId: uuidSchema,
  noteHtml: optionalTrimmedString("Diary note", 50_000),
  noteText: optionalTrimmedString("Diary note", 20_000),
})

export const claimAndTrackGoogleBookSchema = z.object({
  volumeId: googleVolumeIdSchema,
  progress: trackProgressSchema,
})

export type ConfirmGoogleBookIngestInput = z.input<typeof confirmGoogleBookIngestSchema>
export type TrackTitleProgressInput = z.input<typeof trackTitleProgressSchema>
export type UpdateDiaryEntryInput = z.input<typeof updateDiaryEntrySchema>
