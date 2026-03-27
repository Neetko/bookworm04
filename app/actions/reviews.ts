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
  const finishedListId = await ensureFinishedReadingListForProfile(supabase, profileId)
  if (!finishedListId) throw new Error("Forbidden")
  const { data, error } = await supabase
    .from("title_list_items")
    .select("title_id")
    .eq("list_id", finishedListId)
    .eq("title_id", titleId)
    .maybeSingle()

  if (error) {
    console.error("Failed to check title read status", error)
    throw new Error("Failed to check access")
  }

  if (!data?.title_id) throw new Error("Forbidden")
}

async function ensureFinishedReadingListForProfile(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string
) {
  const { data: existing } = await supabase
    .from("title_lists")
    .select("id")
    .eq("user_profile_id", profileId)
    .eq("list_type", "finished-reading")
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const { data: created, error } = await supabase
    .from("title_lists")
    .insert({
      user_profile_id: profileId,
      name: "Finished Reading",
      list_type: "finished-reading",
      is_public: false,
      is_default: true,
    })
    .select("id")
    .single()

  if (error || !created?.id) {
    console.error("Failed to create finished reading list", error)
    return null
  }

  return created.id as string
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
