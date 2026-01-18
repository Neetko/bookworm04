"use server"

import { createServerClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"

export async function getReviews(bookId: string) {
  const supabase = await createServerClient()

  const { data: reviews, error } = await supabase
    .from("reviews")
    .select(`
      *,
      user_profiles (
        username,
        avatar_url
      )
    `)
    .eq("book_id", bookId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching reviews:", error)
    return []
  }

  return reviews
}

export async function submitReview(bookId: string, rating: number, reviewText: string) {
  const supabase = await createServerClient()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error("Unauthorized")
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single()

  if (profileError || !profile) {
    throw new Error("Profile not found")
  }

  // Check if review already exists
  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id")
    .eq("user_id", profile.id)
    .eq("book_id", bookId)
    .single()

  if (existingReview) {
    // Update existing review
    const { error } = await supabase
      .from("reviews")
      .update({
        rating,
        review_text: reviewText,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingReview.id)

    if (error) throw new Error("Failed to update review")
  } else {
    // Insert new review
    const { error } = await supabase
      .from("reviews")
      .insert({
        user_id: profile.id,
        book_id: bookId,
        rating,
        review_text: reviewText,
      })

    if (error) throw new Error("Failed to submit review")
  }

  revalidatePath(`/books/${bookId}`)
}
