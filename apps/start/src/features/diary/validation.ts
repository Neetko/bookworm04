import { z } from "zod"
import { normalizeGenres } from "../titles/catalog"

export const MAX_DIARY_NOTE_LENGTH = 10_000

export type DiaryFilter = "none" | "genre" | "author" | "title"

export type DiarySearch = {
  filterBy: DiaryFilter
  genres: string
  author: string
  title: string
}

const progressSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("pages"),
    currentPage: z.number().int().min(0).max(1_000_000),
    totalPages: z.number().int().min(1).max(1_000_000),
  }).strict().refine((value) => value.currentPage <= value.totalPages),
  z.object({
    mode: z.literal("audiobook"),
    minutesListened: z.number().int().min(0).max(1_000_000),
    totalMinutes: z.number().int().min(1).max(1_000_000),
  }).strict().refine((value) => value.minutesListened <= value.totalMinutes),
])

const progressWriteSchema = z.object({
  titleId: z.string().uuid(),
  progress: progressSchema,
  noteText: z.string().max(MAX_DIARY_NOTE_LENGTH).optional().default(""),
}).strict()

const noteWriteSchema = z.object({
  entryId: z.string().uuid(),
  noteText: z.string().max(MAX_DIARY_NOTE_LENGTH),
}).strict()

export type DiaryProgressWrite = z.infer<typeof progressWriteSchema>
export type DiaryNoteWrite = z.infer<typeof noteWriteSchema>

export function normalizeDiarySearch(raw: unknown): DiarySearch {
  const source = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {}
  const filterBy: DiaryFilter = source.filterBy === "genre" || source.filterBy === "author" || source.filterBy === "title"
    ? source.filterBy
    : "none"
  const bounded = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 200) : ""
  return {
    filterBy,
    genres: normalizeGenres(bounded(source.genres)).join(","),
    author: filterBy === "author" ? bounded(source.author) : "",
    title: filterBy === "title" ? bounded(source.title) : "",
  }
}

export function parseDiaryProgressWrite(value: unknown): DiaryProgressWrite | null {
  const parsed = progressWriteSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function parseDiaryNoteWrite(value: unknown): DiaryNoteWrite | null {
  const parsed = noteWriteSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
