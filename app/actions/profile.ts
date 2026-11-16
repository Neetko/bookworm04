"use server"

import { createServerClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-server"
import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { resizeAvatarImage } from "@/lib/avatar-image"
import { normalizeUsernameLookup, sanitizeUsernameInput, validateUsernameInput } from "@/lib/onboarding"
import { GENRES, type Genre } from "@/lib/types"
import { summarizeGenrePoints } from "@/app/actions/rewards"
import { getSupabasePublicEnv, getSupabaseServiceRoleEnv } from "@/lib/supabase-config"
import { isPostgresUniqueViolation } from "@/lib/server/postgres-errors"

const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabasePublicEnv()
const { isConfigured: hasServiceRoleKey } = getSupabaseServiceRoleEnv()

async function findUsernameCollision(client: any, username: string, excludeAuthUserId?: string | null) {
  const normalized = normalizeUsernameLookup(username)

  const { data, error } = await client
    .from("user_profiles")
    .select("id, auth_user_id, username")
    .ilike("username", username)

  if (error) {
    console.error("Error checking username availability", error)
    throw new Error("Failed to check username availability")
  }

  return (data ?? []).find((row: any) => {
    const rowUsername = normalizeUsernameLookup(row.username)
    if (!rowUsername || rowUsername !== normalized) return false
    if (excludeAuthUserId && row.auth_user_id === excludeAuthUserId) return false
    return true
  })
}

// Helper to verify user
async function getUser(token: string) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

async function ensureUserProfile(user: { id: string; email?: string | null }, token: string) {
  const client = hasServiceRoleKey
    ? createAdminClient()
    : createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      })

  // Try fetch first.
  const { data: existing, error: existingError } = await client
    .from("user_profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .single()

  if (existing) return existing

  // If it's "no rows", create; otherwise, bubble a clearer error.
  if (existingError && existingError.code !== "PGRST116") {
    console.error("Error fetching profile:", existingError)
    throw new Error("Failed to fetch profile")
  }

  const fallbackEmail = user.email ?? null

  const generateUniqueUsername = async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const suffix = Math.floor(1000 + Math.random() * 9000)
      const candidate = `Bookworm${suffix}`

      const collision = await findUsernameCollision(client, candidate)

      if (!collision) return candidate
    }

    const fallback = `Bookworm${randomUUID().replace(/-/g, "").slice(0, 8)}`
    return fallback
  }

  const placeholderUsername = await generateUniqueUsername()

  const { data: created, error: createError } = await client
    .from("user_profiles")
    .upsert(
      {
        auth_user_id: user.id,
        email: fallbackEmail,
        username: placeholderUsername,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "auth_user_id" }
    )
    .select("*")
    .single()

  if (createError || !created) {
    console.error("Error creating profile:", createError)
    throw new Error("Failed to create profile")
  }

  return created
}

export async function getProfileData(token: string) {
  const user = await getUser(token)
  if (!user) throw new Error("Unauthorized")

  // Ensure the profile row exists (helps after DB reset, or if a row was deleted).
  const profile = await ensureUserProfile({ id: user.id, email: user.email }, token)

  const supabase = await createServerClient()

  // Fetch stats
  const { count: reviewsCount } = await supabase
    .from("reviews")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.id)

  // Fetch recent reviews
  const { data: recentReviews } = await supabase
    .from("reviews")
    .select("*, titles(title)")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(10)

  const ensureToReadList = async () => {
    const { data: existing } = await supabase
      .from("title_lists")
      .select("id")
      .eq("user_profile_id", profile.id)
      .eq("list_type", "to-read")
      .maybeSingle()

    if (existing?.id) return existing.id as string

    const { data: created } = await supabase
      .from("title_lists")
      .insert({
        user_profile_id: profile.id,
        name: "Planned Reading",
        list_type: "to-read",
        is_public: false,
        is_default: true,
      })
      .select("id")
      .single()

    return created?.id ?? null
  }

  const ensureCurrentReadingList = async () => {
    const { data: existing } = await supabase
      .from("title_lists")
      .select("id")
      .eq("user_profile_id", profile.id)
      .eq("list_type", "current-reading")
      .maybeSingle()

    if (existing?.id) return existing.id as string

    const { data: created } = await supabase
      .from("title_lists")
      .insert({
        user_profile_id: profile.id,
        name: "Current Reading",
        list_type: "current-reading",
        is_public: false,
        is_default: true,
      })
      .select("id")
      .single()

    return created?.id ?? null
  }

  const ensureFinishedReadingList = async () => {
    const { data: existing } = await supabase
      .from("title_lists")
      .select("id")
      .eq("user_profile_id", profile.id)
      .eq("list_type", "finished-reading")
      .maybeSingle()

    if (existing?.id) return existing.id as string

    const { data: created } = await supabase
      .from("title_lists")
      .insert({
        user_profile_id: profile.id,
        name: "Finished Reading",
        list_type: "finished-reading",
        is_public: false,
        is_default: true,
      })
      .select("id")
      .single()

    return created?.id ?? null
  }

  const toReadListId = await ensureToReadList()
  const currentReadingListId = await ensureCurrentReadingList()
  const finishedReadingListId = await ensureFinishedReadingList()

  const { count: booksReadCount } = await supabase
    .from("title_list_items")
    .select("*", { count: "exact", head: true })
    .eq("list_id", finishedReadingListId)
  const { data: toReadItems } = await supabase
    .from("title_list_items")
    .select("title_id, created_at, titles ( id, title, author, cover_image_url )")
    .eq("list_id", toReadListId)
    .order("created_at", { ascending: false })

  const { data: currentReadingItems } = await supabase
    .from("title_list_items")
    .select("title_id, created_at, titles ( id, title, author, cover_image_url )")
    .eq("list_id", currentReadingListId)
    .order("created_at", { ascending: false })

  const { data: finishedReadingItems } = await supabase
    .from("title_list_items")
    .select("title_id, created_at, titles ( id, title, author, cover_image_url )")
    .eq("list_id", finishedReadingListId)
    .order("created_at", { ascending: false })

  const { data: customLists } = await supabase
    .from("title_lists")
    .select("id,name,is_public,is_default,list_type")
    .eq("user_profile_id", profile.id)
    .eq("list_type", "custom")
    .order("created_at", { ascending: false })

  const customListIds = (customLists ?? []).map((list) => list.id)
  const { data: customItems } = await supabase
    .from("title_list_items")
    .select("list_id, title_id, titles ( id, title, author, cover_image_url )")
    .in("list_id", customListIds)

  const { data: customLikes } = await supabase
    .from("title_list_likes")
    .select("list_id")
    .in("list_id", customListIds)

  const likesCountMap = new Map<string, number>()
  for (const row of customLikes ?? []) {
    const listId = (row as any).list_id as string
    likesCountMap.set(listId, (likesCountMap.get(listId) ?? 0) + 1)
  }

  const itemsByList = new Map<string, Array<any>>()
  for (const row of customItems ?? []) {
    const listId = (row as any).list_id as string
    const title = (row as any).titles
    if (!itemsByList.has(listId)) itemsByList.set(listId, [])
    itemsByList.get(listId)!.push({
      title_id: title?.id ?? (row as any).title_id,
      titles: title,
    })
  }

  const { data: pointRows } = await supabase
    .from("user_genre_points")
    .select("genre, points")
    .eq("user_profile_id", profile.id)

  const { data: recentActivity } = await supabase
    .from("activity_events")
    .select("id,event_type,metadata,created_at")
    .eq("user_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(3)

  const totals = await summarizeGenrePoints((pointRows ?? []) as Array<{ genre: string | null; points: number | null }>)
  const pointsByGenre = GENRES.reduce<Record<Genre, number>>((acc, genre) => {
    acc[genre] = totals.get(genre) ?? 0
    return acc
  }, {} as Record<Genre, number>)

  // Map snake_case to camelCase for frontend compatibility
  const mappedProfile = {
    ...profile,
    avatarUrl: profile.avatar_url,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
    authUserId: profile.auth_user_id,
  }

  return {
    profile: mappedProfile,
    stats: {
      booksRead: booksReadCount || 0,
      reviewsWritten: reviewsCount || 0,
      genrePoints: pointsByGenre,
    },
    recentReviews: recentReviews || [],
    recentActivity: recentActivity || [],
    finishedReadingTitles: finishedReadingItems || [],
    toReadTitles: toReadItems || [],
    toReadListId,
    currentReadingTitles: currentReadingItems || [],
    currentReadingListId,
    finishedReadingListId,
    customLists: (customLists ?? []).map((list) => ({
      id: list.id as string,
      name: list.name as string,
      isPublic: Boolean((list as any).is_public),
      likesCount: likesCountMap.get(list.id) ?? 0,
      items: itemsByList.get(list.id) ?? [],
    })),
    pointsByGenre,
  }
}

export async function updateUserProfile(token: string, formData: FormData) {
  const user = await getUser(token)
  if (!user) return { error: "Unauthorized" }

  await ensureUserProfile({ id: user.id, email: user.email }, token)

  const username = sanitizeUsernameInput(formData.get("username") as string)
  const bio = formData.get("bio") as string
  const avatarUrl = formData.get("avatarUrl") as string

  const supabase = await createServerClient()

  const usernameError = validateUsernameInput(username)
  if (usernameError) {
    return { error: usernameError }
  }

  try {
    const collision = await findUsernameCollision(supabase, username, user.id)
    if (collision) {
      return { error: "That username is already taken" }
    }

    const { error } = await supabase
      .from("user_profiles")
      .update({ 
        username, 
        bio, 
        avatar_url: avatarUrl, 
        updated_at: new Date().toISOString() 
      })
      .eq("auth_user_id", user.id)
    
    if (error) {
      if (isPostgresUniqueViolation(error)) {
        return { error: "That username is already taken" }
      }

      throw error
    }

    revalidatePath("/profile")
    revalidatePath("/onboarding")
    return { success: true }
  } catch (e) {
    console.error(e)
    return { error: "Failed to update profile" }
  }
}

export async function uploadUserAvatar(token: string, formData: FormData) {
  const user = await getUser(token)
  if (!user) return { error: "Unauthorized" as const }

  await ensureUserProfile({ id: user.id, email: user.email }, token)

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) return { error: "No file selected" as const }
  if (!file.type.startsWith("image/")) return { error: "File must be an image" as const }

  const MAX_BYTES = 2 * 1024 * 1024
  if (file.size > MAX_BYTES) return { error: "Avatar too large (max 2MB)" as const }

  let resized
  try {
    resized = await resizeAvatarImage(file, 200)
  } catch (error) {
    console.error(error)
    return { error: "Unsupported image type" as const }
  }

  // Use the user's JWT so Storage RLS can enforce auth.uid() folder rules.
  const authed = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const path = `${user.id}/${randomUUID()}.${resized.ext}`

  const { error: uploadError } = await authed.storage
    .from("user-avatars")
    .upload(path, resized.buffer, { upsert: true, contentType: resized.contentType })

  if (uploadError) {
    console.error(uploadError)
    return { error: "Failed to upload avatar" as const }
  }

  const { data: publicUrlData } = authed.storage.from("user-avatars").getPublicUrl(path)
  const publicUrl = publicUrlData.publicUrl

  const supabase = await createServerClient()

  const { error: updateError } = await supabase
    .from("user_profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("auth_user_id", user.id)

  if (updateError) {
    console.error(updateError)
    return { error: "Failed to save avatar" as const }
  }

  revalidatePath("/profile")
  return { url: publicUrl }
}
