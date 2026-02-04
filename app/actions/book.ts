"use server"

import { createServerClient } from "@/lib/supabase-server"
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

export async function toggleBookReadStatus(token: string, bookId: string, isRead: boolean) {
  const user = await getUser(token)

  if (!user || !user.id) {
    throw new Error("Unauthorized")
  }

  const supabase = await createServerClient()

  // 1. Get user profile id
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single()

  if (profileError || !profile) {
    throw new Error("Profile not found")
  }

  // 2. Check if progress exists
  const { data: progress, error: progressError } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_profile_id", profile.id)
    .eq("book_id", bookId)
    .single()

  if (progressError && progressError.code !== "PGRST116") { // PGRST116 is "no rows returned"
    console.error("Error fetching progress:", progressError)
    throw new Error("Failed to fetch progress")
  }

  if (progress) {
    // Update existing
    const { error: updateError } = await supabase
      .from("user_progress")
      .update({ is_completed: isRead, last_read_at: new Date().toISOString() })
      .eq("id", progress.id)

    if (updateError) {
      console.error("Error updating progress:", updateError)
      throw new Error("Failed to update progress")
    }
  } else {
    // Insert new
    const { error: insertError } = await supabase
      .from("user_progress")
      .insert({
        user_profile_id: profile.id,
        book_id: bookId,
        is_completed: isRead,
        current_page: 0,
        last_read_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error("Error inserting progress:", insertError)
      throw new Error("Failed to insert progress")
    }
  }

  revalidatePath(`/titles/${bookId}`)
}

export async function getReadStatus(token: string, bookId: string) {
  const user = await getUser(token)

  if (!user || !user.id) {
    return false
  }

  const supabase = await createServerClient()

  // 1. Get user profile id
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single()

  if (profileError || !profile) {
    return false
  }

  // 2. Check if progress exists
  const { data: progress, error: progressError } = await supabase
    .from("user_progress")
    .select("is_completed")
    .eq("user_profile_id", profile.id)
    .eq("book_id", bookId)
    .single()

  if (progressError || !progress) {
    return false
  }

  return progress.is_completed
}
