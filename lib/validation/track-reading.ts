import { z } from "zod"
import {
  genreListSchema,
  nonNegativeInteger,
  optionalTrimmedString,
  positiveInteger,
  requiredString,
  uuidSchema,
} from "@/lib/validation/primitives"

const MAX_READING_MINUTES = 1_000_000

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
    .optional()
    .default([])
    .transform((workIds) => Array.from(new Set(workIds))),
  requiresWorkSelection: z.boolean().optional(),
  workCandidates: z.array(openLibraryWorkCandidateSchema).optional().default([]),
})

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
