"use server"

import { createServerClient } from "@/lib/supabase-server"
import { extractPlainTextFromHtml, sanitizeRichTextHtml } from "@/lib/sanitize"
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
      id,
      rating,
      review_text,
      created_at,
      user_id
    `)
    .eq("title_id", titleId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching reviews:", JSON.stringify(error))
    return []
  }

  const rows = reviews ?? []
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean))) as string[]
  if (userIds.length === 0) return rows

  const { data: profiles, error: profileError } = await supabase
    .from("user_profiles")
    .select("id,username,avatar_url")
    .in("id", userIds)

  if (profileError) {
    console.error("Error fetching review profiles:", JSON.stringify(profileError))
    return rows
  }

  const profileMap = new Map<string, { id: string; username: string | null; avatar_url: string | null }>()
  for (const profile of profiles ?? []) {
    if (!profile?.id) continue
    profileMap.set(profile.id as string, {
      id: profile.id as string,
      username: profile.username ?? null,
      avatar_url: profile.avatar_url ?? null,
    })
  }

  return rows.map((row) => ({
    ...row,
    user_profiles: row.user_id ? profileMap.get(row.user_id) ?? null : null,
  }))
}

export async function getMyReview(titleId: string) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { data, error } = await supabase
    .from("reviews")
    .select("id,rating,review_text")
    .eq("user_id", profileId)
    .eq("title_id", titleId)
    .maybeSingle()

  if (error) {
    console.error("Error fetching user review:", JSON.stringify(error))
    throw new Error("Failed to load review")
  }

  return data ?? null
}

export async function submitReview(titleId: string, rating: number, reviewText: string) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)
  await requireTitleRead(supabase, profileId, titleId)

  const cleanedReview = sanitizeRichTextHtml(reviewText)

  // Check if review already exists
  const { data, error } = await supabase
    .from("reviews")
    .upsert(
      {
        user_id: profileId,
        book_id: null,
        title_id: titleId,
        rating,
        review_text: cleanedReview,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,title_id" }
    )
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

  const reviewPlainText = extractPlainTextFromHtml(cleanedReview)
  const { data: title } = await supabase
    .from("titles")
    .select("id, title, cover_image_url")
    .eq("id", titleId)
    .maybeSingle()

  const metadata = {
    title: {
      id: titleId,
      title: title?.title ?? "a title",
      cover: (title as any)?.cover_image_url ?? null,
    },
    rating,
    reviewText: reviewPlainText,
  }

  const { data: existingEvent } = await supabase
    .from("activity_events")
    .select("id")
    .eq("user_profile_id", profileId)
    .eq("event_type", "review_posted")
    .eq("title_id", titleId)
    .maybeSingle()

  if (existingEvent?.id) {
    await supabase
      .from("activity_events")
      .update({ metadata })
      .eq("id", existingEvent.id)
  } else {
    await supabase.from("activity_events").insert({
      user_profile_id: profileId,
      title_id: titleId,
      event_type: "review_posted",
      metadata,
    })
  }

  revalidatePath(`/titles/${titleId}`)
}
