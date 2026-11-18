import { GENRES, type Genre } from "@/lib/types"
import { genreListSchema, uuidSchema } from "@/lib/validation/primitives"
import { MAX_ONBOARDING_FOLLOWS, MAX_ONBOARDING_TITLES } from "@/lib/onboarding-limits"
import { z } from "zod"

const titleIdsSchema = z.array(uuidSchema).max(MAX_ONBOARDING_TITLES)
const followIdsSchema = z.array(uuidSchema).max(MAX_ONBOARDING_FOLLOWS)

export type OnboardingSelections = {
  favoriteGenres: Genre[]
  finishedTitleIds: string[]
  currentTitleIds: string[]
  plannedTitleIds: string[]
  followProfileIds: string[]
}

type ParseResult =
  | { ok: true; value: OnboardingSelections }
  | { ok: false; error: string }

function isBoundedArray(value: unknown, maxLength: number): value is unknown[] {
  return Array.isArray(value) && value.length <= maxLength
}

export function parseOnboardingSelections(input: unknown): ParseResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Invalid onboarding selections" }
  }

  const values = input as Record<string, unknown>
  const favoriteGenres = values.favoriteGenres
  const finishedTitleIds = values.finishedTitleIds
  const currentTitleIds = values.currentTitleIds
  const plannedTitleIds = values.plannedTitleIds
  const followProfileIds = values.followProfileIds

  // Reject oversized collections before Zod visits each element.
  if (!isBoundedArray(favoriteGenres, GENRES.length)) {
    return { ok: false, error: `Choose no more than ${GENRES.length} favorite genres` }
  }
  if (
    !isBoundedArray(finishedTitleIds, MAX_ONBOARDING_TITLES) ||
    !isBoundedArray(currentTitleIds, MAX_ONBOARDING_TITLES) ||
    !isBoundedArray(plannedTitleIds, MAX_ONBOARDING_TITLES) ||
    finishedTitleIds.length + currentTitleIds.length + plannedTitleIds.length > MAX_ONBOARDING_TITLES
  ) {
    return { ok: false, error: `Choose no more than ${MAX_ONBOARDING_TITLES} titles during setup` }
  }
  if (!isBoundedArray(followProfileIds, MAX_ONBOARDING_FOLLOWS)) {
    return { ok: false, error: `Follow no more than ${MAX_ONBOARDING_FOLLOWS} readers during setup` }
  }

  const parsedGenres = genreListSchema.safeParse(favoriteGenres)
  const parsedFinished = titleIdsSchema.safeParse(finishedTitleIds)
  const parsedCurrent = titleIdsSchema.safeParse(currentTitleIds)
  const parsedPlanned = titleIdsSchema.safeParse(plannedTitleIds)
  const parsedFollows = followIdsSchema.safeParse(followProfileIds)

  if (!parsedGenres.success) {
    return { ok: false, error: parsedGenres.error.issues[0]?.message ?? "Select at least one genre" }
  }
  if (!parsedFinished.success || !parsedCurrent.success || !parsedPlanned.success || !parsedFollows.success) {
    return { ok: false, error: "Invalid title or reader selection" }
  }

  const allTitleIds = [...parsedFinished.data, ...parsedCurrent.data, ...parsedPlanned.data]
  if (new Set(allTitleIds).size !== allTitleIds.length) {
    return { ok: false, error: "A title can only be added to one onboarding list" }
  }

  return {
    ok: true,
    value: {
      favoriteGenres: parsedGenres.data,
      finishedTitleIds: parsedFinished.data,
      currentTitleIds: parsedCurrent.data,
      plannedTitleIds: parsedPlanned.data,
      followProfileIds: Array.from(new Set(parsedFollows.data)),
    },
  }
}

export function parseOnboardingTitleIds(input: unknown): string[] | null {
  if (!isBoundedArray(input, MAX_ONBOARDING_TITLES)) return null
  const parsed = titleIdsSchema.safeParse(input)
  return parsed.success ? Array.from(new Set(parsed.data)) : null
}
