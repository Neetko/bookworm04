import { z } from "zod"
import { readBoundedJson } from "../../server/bounded-json.server"
import { createAdminSupabaseClient } from "../../server/supabase-admin.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"
import { sanitizeTitleRichText, titleRichTextPlainText } from "./social-content"

const uuid = z.string().uuid()
const mutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save-review"),
    rating: z.number().int().min(1).max(10),
    contentHtml: z.string().max(50_000),
  }).strict(),
  z.object({ action: z.literal("toggle-review-like"), reviewId: uuid }).strict(),
  z.object({
    action: z.literal("create-discussion-post"),
    contentHtml: z.string().max(50_000),
  }).strict(),
  z.object({ action: z.literal("toggle-discussion-like"), postId: uuid }).strict(),
])

type Supabase = ReturnType<typeof createRequestSupabaseClient>

class SocialError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

function json(body: unknown, status: number) {
  return Response.json(body, { status })
}

async function identity() {
  const supabase = createRequestSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase.from("user_profiles")
    .select("id,username").eq("auth_user_id", user.id).maybeSingle()
  return profile?.id
    ? { supabase, profileId: profile.id as string, username: profile.username as string | null }
    : null
}

async function requireTitleRead(supabase: Supabase, profileId: string, titleId: string) {
  const { data: list, error: listError } = await supabase.from("title_lists")
    .select("id").eq("user_profile_id", profileId).eq("list_type", "finished-reading").maybeSingle()
  if (listError) throw new SocialError("Could not check reading status", 500)
  if (!list?.id) throw new SocialError("Mark this title as read first", 403)
  const { data: item, error: itemError } = await supabase.from("title_list_items")
    .select("title_id").eq("list_id", list.id).eq("title_id", titleId).maybeSingle()
  if (itemError) throw new SocialError("Could not check reading status", 500)
  if (!item?.title_id) throw new SocialError("Mark this title as read first", 403)
}

async function titleMetadata(supabase: Supabase, titleId: string) {
  const { data } = await supabase.from("titles")
    .select("id,title,cover_image_url").eq("id", titleId).maybeSingle()
  return data ? {
    id: data.id,
    title: data.title,
    coverUrl: data.cover_image_url ?? null,
  } : null
}

async function saveReview(
  actor: NonNullable<Awaited<ReturnType<typeof identity>>>,
  titleId: string,
  rating: number,
  contentHtml: string,
) {
  await requireTitleRead(actor.supabase, actor.profileId, titleId)
  const reviewHtml = sanitizeTitleRichText(contentHtml)
  const { data: review, error } = await actor.supabase.from("reviews").upsert({
    user_id: actor.profileId,
    title_id: titleId,
    rating,
    review_text: reviewHtml,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,title_id" }).select("id").single()
  if (error || !review) throw new SocialError("Could not save review", 500)

  const title = await titleMetadata(actor.supabase, titleId)
  const metadata = {
    title: {
      id: titleId,
      title: title?.title ?? "a title",
      cover: title?.coverUrl ?? null,
    },
    rating,
    reviewText: titleRichTextPlainText(reviewHtml),
  }
  const { data: existingEvent } = await actor.supabase.from("activity_events")
    .select("id").eq("user_profile_id", actor.profileId)
    .eq("event_type", "review_posted").eq("title_id", titleId).maybeSingle()
  const activityWrite = existingEvent?.id
    ? await actor.supabase.from("activity_events").update({ metadata }).eq("id", existingEvent.id)
    : await actor.supabase.from("activity_events").insert({
        user_profile_id: actor.profileId,
        title_id: titleId,
        event_type: "review_posted",
        metadata,
      })
  if (activityWrite.error) console.error("Could not record review activity", activityWrite.error)
  return { id: review.id as string }
}

async function createDiscussionPost(
  actor: NonNullable<Awaited<ReturnType<typeof identity>>>,
  titleId: string,
  contentHtml: string,
) {
  await requireTitleRead(actor.supabase, actor.profileId, titleId)
  const html = sanitizeTitleRichText(contentHtml)
  if (!titleRichTextPlainText(html)) throw new SocialError("Write something before posting", 400)
  const { data, error } = await actor.supabase.from("discussion_posts").insert({
    title_id: titleId,
    user_id: actor.profileId,
    content: html,
    likes_count: 0,
  }).select("id").single()
  if (error || !data) throw new SocialError("Could not publish discussion post", 500)
  return { id: data.id as string }
}

async function notifyLike(input: {
  actor: NonNullable<Awaited<ReturnType<typeof identity>>>
  recipientId: string | null
  titleId: string
  eventType: "review_like" | "discussion_post_like"
  reviewId?: string
  postId?: string
}) {
  if (!input.recipientId || input.recipientId === input.actor.profileId) return
  const admin = createAdminSupabaseClient()
  if (!admin) throw new SocialError("Notification service is not configured", 503)
  const title = await titleMetadata(input.actor.supabase, input.titleId)
  const { error } = await admin.from("notifications").insert({
    recipient_profile_id: input.recipientId,
    actor_profile_id: input.actor.profileId,
    title_id: input.titleId,
    review_id: input.reviewId ?? null,
    post_id: input.postId ?? null,
    event_type: input.eventType,
    metadata: {
      actor: { id: input.actor.profileId, username: input.actor.username },
      title,
    },
  })
  if (error) throw new SocialError("Could not send like notification", 500)
}

async function toggleReviewLike(
  actor: NonNullable<Awaited<ReturnType<typeof identity>>>,
  titleId: string,
  reviewId: string,
) {
  const admin = createAdminSupabaseClient()
  if (!admin) throw new SocialError("Like service is not configured", 503)
  const { data: review, error: reviewError } = await actor.supabase.from("reviews")
    .select("id,user_id").eq("id", reviewId).eq("title_id", titleId).maybeSingle()
  if (reviewError || !review) throw new SocialError("Review not found", 404)
  const { data: existing, error: existingError } = await actor.supabase.from("review_likes")
    .select("id").eq("review_id", reviewId).eq("user_id", actor.profileId).maybeSingle()
  if (existingError) throw new SocialError("Could not update like", 500)

  let liked = false
  if (existing?.id) {
    const { error } = await actor.supabase.from("review_likes").delete().eq("id", existing.id)
    if (error) throw new SocialError("Could not remove like", 500)
  } else {
    const { error } = await actor.supabase.from("review_likes")
      .insert({ review_id: reviewId, user_id: actor.profileId })
    if (error) throw new SocialError("Could not like review", error.code === "23505" ? 409 : 500)
    liked = true
    try {
      await notifyLike({
        actor,
        recipientId: review.user_id as string | null,
        titleId,
        reviewId,
        eventType: "review_like",
      })
    } catch (error) {
      await admin.from("review_likes").delete().eq("review_id", reviewId).eq("user_id", actor.profileId)
      throw error
    }
  }
  const { count, error: countError } = await admin.from("review_likes")
    .select("id", { count: "exact", head: true }).eq("review_id", reviewId)
  if (countError) throw new SocialError("Could not refresh like count", 500)
  return { liked, likesCount: count ?? 0 }
}

async function syncDiscussionLikeCount(postId: string) {
  const admin = createAdminSupabaseClient()
  if (!admin) throw new SocialError("Like service is not configured", 503)
  const { count, error: countError } = await admin.from("post_likes")
    .select("id", { count: "exact", head: true }).eq("post_id", postId)
  if (countError) throw new SocialError("Could not refresh like count", 500)
  const likesCount = count ?? 0
  const { error: updateError } = await admin.from("discussion_posts")
    .update({ likes_count: likesCount }).eq("id", postId)
  if (updateError) throw new SocialError("Could not refresh like count", 500)
  return likesCount
}

async function toggleDiscussionLike(
  actor: NonNullable<Awaited<ReturnType<typeof identity>>>,
  titleId: string,
  postId: string,
) {
  await requireTitleRead(actor.supabase, actor.profileId, titleId)
  const admin = createAdminSupabaseClient()
  if (!admin) throw new SocialError("Like service is not configured", 503)
  const { data: post, error: postError } = await actor.supabase.from("discussion_posts")
    .select("id,user_id").eq("id", postId).eq("title_id", titleId).maybeSingle()
  if (postError || !post) throw new SocialError("Discussion post not found", 404)
  const { data: existing, error: existingError } = await actor.supabase.from("post_likes")
    .select("id").eq("post_id", postId).eq("user_id", actor.profileId).maybeSingle()
  if (existingError) throw new SocialError("Could not update like", 500)

  let liked = false
  if (existing?.id) {
    const { error } = await actor.supabase.from("post_likes").delete().eq("id", existing.id)
    if (error) throw new SocialError("Could not remove like", 500)
  } else {
    const { error } = await actor.supabase.from("post_likes")
      .insert({ post_id: postId, user_id: actor.profileId })
    if (error) throw new SocialError("Could not like discussion post", error.code === "23505" ? 409 : 500)
    liked = true
    try {
      await notifyLike({
        actor,
        recipientId: post.user_id as string | null,
        titleId,
        postId,
        eventType: "discussion_post_like",
      })
    } catch (error) {
      await admin.from("post_likes").delete().eq("post_id", postId).eq("user_id", actor.profileId)
      await syncDiscussionLikeCount(postId)
      throw error
    }
  }
  return { liked, likesCount: await syncDiscussionLikeCount(postId) }
}

export async function handleTitleSocial(request: Request, rawTitleId: string): Promise<Response> {
  const titleId = uuid.safeParse(rawTitleId)
  if (!titleId.success) return json({ error: "Title not found" }, 404)
  const body = await readBoundedJson(request, 64_000)
  if (!body.ok) return json({ error: body.error }, body.status)
  const parsed = mutationSchema.safeParse(body.value)
  if (!parsed.success) return json({ error: "Invalid title activity" }, 400)
  const actor = await identity()
  if (!actor) return json({ error: "Sign in to continue" }, 401)
  const { data: title } = await actor.supabase.from("titles")
    .select("id").eq("id", titleId.data).maybeSingle()
  if (!title) return json({ error: "Title not found" }, 404)

  try {
    switch (parsed.data.action) {
      case "save-review":
        return json(await saveReview(actor, titleId.data, parsed.data.rating, parsed.data.contentHtml), 200)
      case "toggle-review-like":
        return json(await toggleReviewLike(actor, titleId.data, parsed.data.reviewId), 200)
      case "create-discussion-post":
        return json(await createDiscussionPost(actor, titleId.data, parsed.data.contentHtml), 201)
      case "toggle-discussion-like":
        return json(await toggleDiscussionLike(actor, titleId.data, parsed.data.postId), 200)
    }
  } catch (error) {
    console.error("Title social action failed", error)
    return json({ error: error instanceof Error ? error.message : "Could not update title activity" }, error instanceof SocialError ? error.status : 500)
  }
}
