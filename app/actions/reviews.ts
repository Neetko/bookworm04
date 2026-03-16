"use server"

import { createServerClient } from "@/lib/supabase-server"
import { sanitizeRichTextHtml } from "@/lib/sanitize"
import { revalidatePath } from "next/cache"
import { awardPointsForTitleAction } from "@/app/actions/rewards"

async function requireAuthedProfileId(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new Error("Unauthorized")

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single()

  if (profileError || !profile) throw new Error("Profile not found")

  return profile.id as string
}

async function requireTitleRead(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string,
  titleId: string
) {
  const { data, error } = await supabase
    .from("title_reads")
    .select("title_id")
    .eq("user_profile_id", profileId)
    .eq("title_id", titleId)
    .maybeSingle()

  if (error) {
    console.error("Failed to check title read status", error)
    throw new Error("Failed to check access")
  }

  if (!data?.title_id) throw new Error("Forbidden")
}

export async function getReviews(titleId: string) {
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
    .eq("title_id", titleId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching reviews:", error)
    return []
  }

  return reviews
}

export async function submitReview(titleId: string, rating: number, reviewText: string) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)
  await requireTitleRead(supabase, profileId, titleId)

  const cleanedReview = sanitizeRichTextHtml(reviewText)

  // Check if review already exists
  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id")
    .eq("user_id", profileId)
    .eq("title_id", titleId)
    .single()

  if (existingReview) {
    // Update existing review
    const { error } = await supabase
      .from("reviews")
      .update({
        rating,
        review_text: cleanedReview,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingReview.id)

    if (error) throw new Error("Failed to update review")
  } else {
    // Insert new review
    const { data, error } = await supabase
      .from("reviews")
      .insert({
        user_id: profileId,
        book_id: null,
        title_id: titleId,
        rating,
        review_text: cleanedReview,
      })
      .select("id")
      .single()

    if (error) throw new Error("Failed to submit review")

    if (data?.id) {
      await awardPointsForTitleAction({
        supabase,
        profileId,
        titleId,
        sourceType: "review",
        sourceId: data.id,
        basePoints: 1,
        reason: "review_submitted",
      })
    }
  }

  revalidatePath(`/titles/${titleId}`)
}
