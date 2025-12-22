"use server"

import { createServerClient } from "@/lib/supabase"
import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

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

export async function getProfileData(token: string) {
  const user = await getUser(token)
  if (!user) throw new Error("Unauthorized")

  const supabase = createServerClient()

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .single()

  if (profileError || !profile) {
    console.error("Error fetching profile:", profileError)
    return null
  }

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

  const username = formData.get("username") as string
  const bio = formData.get("bio") as string
  const avatarUrl = formData.get("avatarUrl") as string

  const supabase = createServerClient()

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
