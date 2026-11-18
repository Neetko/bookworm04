import { z } from "zod"
import { ActionValidationError, parseActionInput } from "@/lib/validation/action"
import { uuidSchema } from "@/lib/validation/primitives"

const openLibraryWorkId = z.string().trim().regex(/^OL[1-9][0-9]{0,11}W$/, "Invalid Open Library work ID")

function isOpenLibraryCoverUrl(value: string | null | undefined): boolean {
  if (value == null) return true

  try {
    const url = new URL(value)
    return url.protocol === "https:"
      && url.hostname === "covers.openlibrary.org"
      && url.port === ""
      && url.username === ""
      && url.password === ""
      && /^\/b\/id\/[1-9][0-9]{0,11}-(M|L)\.jpg$/.test(url.pathname)
      && url.search === "?default=false"
      && url.hash === ""
  } catch {
    return false
  }
}

const selectedWorkSchema = z.object({
  workId: openLibraryWorkId,
  title: z.string().trim().min(1).max(500),
  author: z.string().trim().max(500),
  firstPublishYear: z.number().int().min(0).max(3000).nullable(),
  editionCount: z.number().int().min(0).max(10_000_000).nullable(),
  coverUrl: z.string().trim().max(2_000).nullable().optional().refine(isOpenLibraryCoverUrl, "Invalid Open Library cover URL"),
  subjects: z.array(z.string().trim().max(200)).max(30).optional(),
})

export const titleDedupeSubmissionSchema = z.object({
  titleId: uuidSchema,
  selectedWorks: z.array(selectedWorkSchema).min(1).max(15),
})

export function parseTitleDedupeSubmissionInput(input: unknown) {
  // Guard array lengths before Zod can accumulate an issue for every
  // client-supplied element in a server action payload.
  if (input && typeof input === "object") {
    const selectedWorks = (input as Record<string, unknown>).selectedWorks
    if (Array.isArray(selectedWorks)) {
      if (selectedWorks.length > 15) {
        throw new ActionValidationError("Too many selected Open Library works")
      }
      for (const work of selectedWorks) {
        if (work && typeof work === "object") {
          const subjects = (work as Record<string, unknown>).subjects
          if (Array.isArray(subjects) && subjects.length > 30) {
            throw new ActionValidationError("Too many Open Library subjects")
          }
        }
      }
    }
  }

  return parseActionInput(titleDedupeSubmissionSchema, input)
}
