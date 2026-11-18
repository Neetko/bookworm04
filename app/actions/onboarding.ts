"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { followUser } from "@/app/actions/follow"
import {
  ensureCurrentReadingList,
  ensureFinishedReadingList,
  ensureToReadList,
} from "@/app/actions/lists"
import { getInitialTitles, searchTitles } from "@/app/actions/search-titles"
import { createAdminClient, createServerClient } from "@/lib/supabase-server"
import {
  isPlaceholderUsername,
  normalizeUsernameLookup,
  sanitizeUsernameInput,
  validateUsernameInput,
} from "@/lib/onboarding"
import type { SearchTitleResult } from "@/lib/types"
import { getSupabaseServiceRoleEnv } from "@/lib/supabase-config"
import { isPostgresUniqueViolation } from "@/lib/server/postgres-errors"
import { genreListSchema } from "@/lib/validation/primitives"

type ProfileRow = {
  id: string
  auth_user_id: string | null
  username: string | null
  onboarding_completed_at: string | null
  favorite_genres: string[] | null
}

export type OnboardingFollowSuggestion = {
  profileId: string
  username: string
  avatarUrl: string | null
  overlapCount: number
  matchedTitles: string[]
}

function getProfileClient(serverClient: Awaited<ReturnType<typeof createServerClient>>) {
  const { isConfigured } = getSupabaseServiceRoleEnv()
  return isConfigured ? createAdminClient() : serverClient
}

async function requireAuthedUser() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error("Unauthorized")
  }

  return { supabase, user }
}

async function findUsernameCollision(client: any, username: string, excludeAuthUserId?: string | null) {
  const normalized = normalizeUsernameLookup(username)

  const { data, error } = await client
    .from("user_profiles")
    .select("id, auth_user_id, username")
    .ilike("username", username)

  if (error) {
    console.error("Failed to check username availability", error)
    throw new Error("Failed to check username availability")
  }

  return (data ?? []).find((row: any) => {
    const rowUsername = normalizeUsernameLookup(row.username)
    if (!rowUsername || rowUsername !== normalized) return false
    if (excludeAuthUserId && row.auth_user_id === excludeAuthUserId) return false
    return true
  })
}

async function generatePlaceholderUsername(client: any) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = Math.floor(1000 + Math.random() * 9000)
    const candidate = `Bookworm${suffix}`
    const collision = await findUsernameCollision(client, candidate)
    if (!collision) return candidate
  }

  return `Bookworm${randomUUID().replace(/-/g, "").slice(0, 8)}`
}

async function ensureAuthedProfile() {
  const { supabase, user } = await requireAuthedUser()
  const client = getProfileClient(supabase)

  const { data: existing, error: existingError } = await client
    .from("user_profiles")
    .select("id, auth_user_id, username, onboarding_completed_at, favorite_genres")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (existingError) {
    console.error("Failed to load onboarding profile", existingError)
    throw new Error("Failed to load onboarding profile")
  }

  if (existing?.id) {
    return { supabase, user, profile: existing as ProfileRow }
  }

  const placeholderUsername = await generatePlaceholderUsername(client)
  const { data: created, error: createError } = await client
    .from("user_profiles")
    .upsert(
      {
        auth_user_id: user.id,
        email: user.email ?? null,
        username: placeholderUsername,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "auth_user_id" }
    )
    .select("id, auth_user_id, username, onboarding_completed_at, favorite_genres")
    .single()

  if (createError || !created?.id) {
    console.error("Failed to create onboarding profile", createError)
    throw new Error("Failed to create onboarding profile")
  }

  return { supabase, user, profile: created as ProfileRow }
}

function uniqueIds(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

export async function getOnboardingBootstrapData() {
  const { profile } = await ensureAuthedProfile()
  const initialTitles = profile.onboarding_completed_at ? [] : await getInitialTitles()
  const favoriteGenres = genreListSchema.safeParse(profile.favorite_genres)

  return {
    profile: {
      id: profile.id,
      username: profile.username,
      onboardingCompletedAt: profile.onboarding_completed_at,
      favoriteGenres: favoriteGenres.success ? favoriteGenres.data : [],
      needsOnboarding: !profile.onboarding_completed_at,
      hasPlaceholderUsername: isPlaceholderUsername(profile.username),
    },
    initialTitles,
  }
}

export async function checkUsernameAvailability(username: string) {
  const { user, supabase } = await requireAuthedUser()
  const validationError = validateUsernameInput(username)
  const sanitized = sanitizeUsernameInput(username)

  if (validationError) {
    return {
      available: false,
      sanitized,
      message: validationError,
    }
  }

  const client = getProfileClient(supabase)
  const collision = await findUsernameCollision(client, sanitized, user.id)

  return {
    available: !collision,
    sanitized,
    message: collision ? "That username is already taken" : "Username available",
  }
}

export async function completeOnboardingUsername(username: string) {
  const { user, supabase, profile } = await ensureAuthedProfile()
  const sanitized = sanitizeUsernameInput(username)
  const validationError = validateUsernameInput(sanitized)

  if (validationError) {
    return { error: validationError }
  }

  const client = getProfileClient(supabase)
  const collision = await findUsernameCollision(client, sanitized, user.id)

  if (collision) {
    return { error: "That username is already taken" }
  }

  const { error } = await client
    .from("user_profiles")
    .update({
      username: sanitized,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id)

  if (error) {
    if (isPostgresUniqueViolation(error)) {
      return { error: "That username is already taken" }
    }

    console.error("Failed to save onboarding username", error)
    return { error: "Failed to save username" }
  }

  revalidatePath("/")
  revalidatePath("/onboarding")
  revalidatePath("/profile")
  return { success: true, username: sanitized }
}

export async function searchOnboardingTitles(query: string, excludedTitleIds: string[] = []) {
  const sanitizedQuery = query.trim()
  const excluded = new Set(uniqueIds(excludedTitleIds))

  const results = sanitizedQuery ? await searchTitles({ raw: sanitizedQuery, includeExternal: false }) : await getInitialTitles()

  return results.filter((result) => result.source === "local" && !excluded.has(result.id))
}

export async function getOnboardingFollowSuggestions(selectedTitleIds: string[]) {
  const uniqueTitleIds = uniqueIds(selectedTitleIds)
  if (uniqueTitleIds.length === 0) return [] as OnboardingFollowSuggestion[]

  const { supabase, profile } = await ensureAuthedProfile()

  const { data: items, error: itemsError } = await supabase
    .from("title_list_items")
    .select("list_id, title_id")
    .in("title_id", uniqueTitleIds)

  if (itemsError) {
    console.error("Failed to load onboarding title overlaps", itemsError)
    return []
  }

  const listIds = uniqueIds((items ?? []).map((row) => row.list_id as string))
  if (listIds.length === 0) return []

  const { data: lists, error: listsError } = await supabase
    .from("title_lists")
    .select("id, user_profile_id, list_type")
    .in("id", listIds)
    .in("list_type", ["to-read", "current-reading", "finished-reading"])

  if (listsError) {
    console.error("Failed to load onboarding list overlaps", listsError)
    return []
  }

  const { data: follows } = await supabase
    .from("user_follows")
    .select("followed_profile_id")
    .eq("follower_profile_id", profile.id)

  const followedIds = new Set(
    (follows ?? []).map((row) => row.followed_profile_id).filter(Boolean) as string[]
  )

  const listOwners = new Map<string, { profileId: string; listType: string }>()
  for (const list of lists ?? []) {
    if (!list.id || !list.user_profile_id) continue
    listOwners.set(list.id as string, {
      profileId: list.user_profile_id as string,
      listType: list.list_type as string,
    })
  }

  const overlapMap = new Map<string, Set<string>>()
  for (const item of items ?? []) {
    const owner = listOwners.get(item.list_id as string)
    const titleId = item.title_id as string | null
    if (!owner?.profileId || !titleId) continue
    if (owner.profileId === profile.id) continue
    if (followedIds.has(owner.profileId)) continue
    if (!overlapMap.has(owner.profileId)) overlapMap.set(owner.profileId, new Set())
    overlapMap.get(owner.profileId)!.add(titleId)
  }

  const candidateProfileIds = Array.from(overlapMap.keys())
  if (candidateProfileIds.length === 0) return []

  const [profilesResult, titlesResult] = await Promise.all([
    supabase
      .from("public_profiles")
      .select("id, username, avatar_url")
      .in("id", candidateProfileIds),
    supabase.from("titles").select("id, title").in("id", uniqueTitleIds),
  ])

  if (profilesResult.error) {
    console.error("Failed to load onboarding profile suggestions", profilesResult.error)
    return []
  }

  const titleMap = new Map<string, string>()
  for (const row of titlesResult.data ?? []) {
    if (!row.id) continue
    titleMap.set(row.id as string, row.title ?? "Untitled")
  }

  return (profilesResult.data ?? [])
    .map((row) => {
      const matchedIds = Array.from(overlapMap.get(row.id as string) ?? [])
      return {
        profileId: row.id as string,
        username: row.username?.trim() || "Reader",
        avatarUrl: row.avatar_url ?? null,
        overlapCount: matchedIds.length,
        matchedTitles: matchedIds.map((titleId) => titleMap.get(titleId) ?? "Untitled").slice(0, 3),
      }
    })
    .sort((a, b) => {
      if (b.overlapCount !== a.overlapCount) return b.overlapCount - a.overlapCount
      return a.username.localeCompare(b.username)
    })
    .slice(0, 8)
}

export async function saveOnboardingSelections(input: {
  favoriteGenres: string[]
  finishedTitleIds: string[]
  currentTitleIds: string[]
  plannedTitleIds: string[]
  followProfileIds: string[]
}) {
  const parsedGenres = genreListSchema.safeParse(input.favoriteGenres)
  if (!parsedGenres.success) {
    return { error: parsedGenres.error.issues[0]?.message ?? "Select at least one genre" }
  }

  const { supabase, profile } = await ensureAuthedProfile()

  const finishedTitleIds = uniqueIds(input.finishedTitleIds)
  const currentTitleIds = uniqueIds(input.currentTitleIds)
  const plannedTitleIds = uniqueIds(input.plannedTitleIds)
  const followProfileIds = uniqueIds(input.followProfileIds).filter((profileId) => profileId !== profile.id)
  const favoriteGenres = parsedGenres.data

  const combined = [...finishedTitleIds, ...currentTitleIds, ...plannedTitleIds]
  if (new Set(combined).size !== combined.length) {
    return { error: "A title can only be added to one onboarding list" }
  }

  const [finishedListId, currentListId, plannedListId] = await Promise.all([
    ensureFinishedReadingList(profile.id),
    ensureCurrentReadingList(profile.id),
    ensureToReadList(profile.id),
  ])

  const allListIds = [finishedListId, currentListId, plannedListId]
  if (combined.length > 0) {
    const { error: deleteError } = await supabase
      .from("title_list_items")
      .delete()
      .in("list_id", allListIds)
      .in("title_id", combined)

    if (deleteError) {
      console.error("Failed to clear onboarding list selections", deleteError)
      return { error: "Failed to save onboarding selections" }
    }
  }

  const rows = [
    ...finishedTitleIds.map((titleId) => ({ list_id: finishedListId, title_id: titleId })),
    ...currentTitleIds.map((titleId) => ({ list_id: currentListId, title_id: titleId })),
    ...plannedTitleIds.map((titleId) => ({ list_id: plannedListId, title_id: titleId })),
  ]

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("title_list_items")
      .upsert(rows, { onConflict: "list_id,title_id" })

    if (insertError) {
      console.error("Failed to insert onboarding list selections", insertError)
      return { error: "Failed to save onboarding selections" }
    }
  }

  await Promise.allSettled(followProfileIds.map((profileId) => followUser(profileId)))

  const { error: completeError } = await createAdminClient()
    .from("user_profiles")
    .update({
      favorite_genres: favoriteGenres,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id)

  if (completeError) {
    console.error("Failed to complete onboarding", completeError)
    return { error: "Failed to finish onboarding" }
  }

  revalidatePath("/")
  revalidatePath("/community")
  revalidatePath("/onboarding")
  revalidatePath("/profile")

  return { success: true }
}
