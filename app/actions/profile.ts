"use server"

import { createServerClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-server"
import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"

// Helper to verify user
async function getUser(token: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

async function ensureUserProfile(user: { id: string; email?: string | null }, token: string) {
  const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const client = serviceKey
    ? createAdminClient()
    : createClient(anonUrl, anonKey, {
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

  const { data: created, error: createError } = await client
    .from("user_profiles")
    .upsert(
      {
        auth_user_id: user.id,
        email: fallbackEmail,
        username: fallbackEmail,
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

  const { count: favoritesCount } = await supabase
    .from("favorites")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.id)

  const { count: bookmarksCount } = await supabase
    .from("bookmarks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.id)

  const { count: booksReadCount } = await supabase
    .from("user_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_profile_id", profile.id)

  // Fetch recent reviews
  const { data: recentReviews } = await supabase
    .from("reviews")
    .select("*, books(title)")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(10)

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
      favorites: favoritesCount || 0,
      bookmarks: bookmarksCount || 0,
    },
    recentReviews: recentReviews || []
  }
}

export async function updateUserProfile(token: string, formData: FormData) {
  const user = await getUser(token)
  if (!user) return { error: "Unauthorized" }

  await ensureUserProfile({ id: user.id, email: user.email }, token)

  const username = formData.get("username") as string
  const bio = formData.get("bio") as string
  const avatarUrl = formData.get("avatarUrl") as string

  const supabase = await createServerClient()

  try {
    const { error } = await supabase
      .from("user_profiles")
      .update({ 
        username, 
        bio, 
        avatar_url: avatarUrl, 
        updated_at: new Date().toISOString() 
      })
      .eq("auth_user_id", user.id)
    
    if (error) throw error

    revalidatePath("/profile")
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

  const allowed = new Set(["image/png", "image/jpeg", "image/webp"])
  if (!allowed.has(file.type)) return { error: "Unsupported image type" as const }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg"

  const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // Use the user's JWT so Storage RLS can enforce auth.uid() folder rules.
  const authed = createClient(anonUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const path = `${user.id}/${randomUUID()}.${ext}`

  const { error: uploadError } = await authed.storage
    .from("user-avatars")
    .upload(path, file, { upsert: true, contentType: file.type })

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
