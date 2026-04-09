"use server"

import { createServerClient } from "@/lib/supabase-server"
import { extractPlainTextFromHtml, sanitizeRichTextHtml } from "@/lib/sanitize"
import { fetchOpenLibraryWorkCandidatesByTitleAuthor, type OpenLibraryWorkCandidate } from "@/lib/open-library"
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

async function buildActorMetadata(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string
) {
  const { data } = await supabase
    .from("user_profiles")
    .select("id,username,avatar_url")
    .eq("id", profileId)
    .maybeSingle()

  if (!data) return null

  return {
    id: data.id,
    username: data.username,
    avatarUrl: data.avatar_url ?? null,
  }
}

async function buildTitleMetadata(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  titleId: string
) {
  const { data } = await supabase
    .from("titles")
    .select("id,title,cover_image_url")
    .eq("id", titleId)
    .maybeSingle()

  if (!data) return null

  return {
    id: data.id,
    title: data.title,
    coverUrl: (data as any).cover_image_url ?? null,
  }
}

async function ensureToReadListForProfile(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string
) {
  const { data: existing } = await supabase
    .from("title_lists")
    .select("id")
    .eq("user_profile_id", profileId)
    .eq("list_type", "to-read")
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const { data: created, error } = await supabase
    .from("title_lists")
    .insert({
      user_profile_id: profileId,
      name: "Planned Reading",
      list_type: "to-read",
      is_public: false,
      is_default: true,
    })
    .select("id")
    .single()

  if (error || !created?.id) {
    console.error("Failed to create to-read list", error)
    return null
  }

  return created.id as string
}

async function ensureCurrentReadingListForProfile(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string
) {
  const { data: existing } = await supabase
    .from("title_lists")
    .select("id")
    .eq("user_profile_id", profileId)
    .eq("list_type", "current-reading")
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const { data: created, error } = await supabase
    .from("title_lists")
    .insert({
      user_profile_id: profileId,
      name: "Current Reading",
      list_type: "current-reading",
      is_public: false,
      is_default: true,
    })
    .select("id")
    .single()

  if (error || !created?.id) {
    console.error("Failed to create current reading list", error)
    return null
  }

  return created.id as string
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

async function removeFromToReadList(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string,
  titleId: string
) {
  const listId = await ensureToReadListForProfile(supabase, profileId)
  if (!listId) return
  await supabase
    .from("title_list_items")
    .delete()
    .eq("list_id", listId)
    .eq("title_id", titleId)
}

async function removeFromCurrentReadingList(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string,
  titleId: string
) {
  const listId = await ensureCurrentReadingListForProfile(supabase, profileId)
  if (!listId) return
  await supabase
    .from("title_list_items")
    .delete()
    .eq("list_id", listId)
    .eq("title_id", titleId)
}

export async function getTitleReadStatus(titleId: string) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single()

  if (!profile?.id) return false

  const finishedListId = await ensureFinishedReadingListForProfile(supabase, profile.id)
  if (!finishedListId) return false

  const { data } = await supabase
    .from("title_list_items")
    .select("title_id")
    .eq("list_id", finishedListId)
    .eq("title_id", titleId)
    .maybeSingle()

  return Boolean(data?.title_id)
}

export async function setTitleReadStatus(titleId: string, isRead: boolean) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const finishedListId = await ensureFinishedReadingListForProfile(supabase, profileId)
  if (!finishedListId) throw new Error("Failed to update read status")

  if (isRead) {
    const { data: existing, error: existingError } = await supabase
      .from("title_list_items")
      .select("title_id")
      .eq("list_id", finishedListId)
      .eq("title_id", titleId)
      .maybeSingle()

    if (existingError) {
      console.error("Failed to check title read status", existingError)
      throw new Error("Failed to update read status")
    }

    if (!existing?.title_id) {
      const { error } = await supabase
        .from("title_list_items")
        .insert({ list_id: finishedListId, title_id: titleId })

      if (error) {
        console.error("Failed to mark title as read", error)
        throw new Error("Failed to update read status")
      }

      await awardPointsForTitleAction({
        supabase,
        profileId,
        titleId,
        sourceType: "title_read",
        sourceId: titleId,
        basePoints: 3,
        reason: "completed_reading",
      })

    }

    await removeFromCurrentReadingList(supabase, profileId, titleId)
    await removeFromToReadList(supabase, profileId, titleId)
  } else {
    const { error } = await supabase
      .from("title_list_items")
      .delete()
      .eq("list_id", finishedListId)
      .eq("title_id", titleId)

    if (error) {
      console.error("Failed to mark title as unread", error)
      throw new Error("Failed to update read status")
    }
  }

  revalidatePath(`/titles/${titleId}`)
  return { titleId }
}

export type DiscussionPostRow = {
  id: string
  content: string
  created_at: string
  likes_count: number
  viewer_has_liked?: boolean
  user_profiles: {
    username: string | null
    avatar_url: string | null
    role: string | null
    joined_date: string | null
    signature: string | null
    signature_image: string | null
  } | null
}

export async function getDiscussionPosts(titleId: string): Promise<DiscussionPostRow[]> {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)
  await requireTitleRead(supabase, profileId, titleId)

  const { data, error } = await supabase
    .from("discussion_posts")
    .select(
      `
      id,
      content,
      likes_count,
      created_at,
      user_profiles (
        username,
        avatar_url,
        role,
        created_at,
        signature,
        signature_image
      )
    `
    )
    .eq("title_id", titleId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to fetch discussion posts", error)
    throw new Error("Failed to load discussion")
  }

  const rows = (data ?? []) as any[]
  const postIds = rows.map((row) => row.id).filter(Boolean) as string[]
  const likedSet = new Set<string>()

  if (postIds.length > 0) {
    const { data: likedRows } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", profileId)
      .in("post_id", postIds)

    for (const row of likedRows ?? []) {
      likedSet.add((row as any).post_id as string)
    }
  }

  return rows.map((row) => ({
    ...row,
    likes_count: row.likes_count ?? 0,
    viewer_has_liked: likedSet.has(row.id),
    user_profiles: row.user_profiles
      ? {
          ...row.user_profiles,
          joined_date: row.user_profiles.created_at ?? null,
        }
      : null,
  }))
}

export async function createDiscussionPost(titleId: string, content: string) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)
  await requireTitleRead(supabase, profileId, titleId)

  const cleaned = sanitizeRichTextHtml(content)
  const plain = extractPlainTextFromHtml(cleaned)
  if (!plain) throw new Error("Message cannot be empty")

  const { data, error } = await supabase
    .from("discussion_posts")
    .insert({
    title_id: titleId,
    user_id: profileId,
    content: cleaned,
    likes_count: 0,
    })
    .select("id")
    .single()

  if (error) {
    console.error("Failed to create discussion post", error)
    throw new Error("Failed to publish post")
  }

  if (data?.id) {
    await awardPointsForTitleAction({
      supabase,
      profileId,
      titleId,
      sourceType: "discussion_post",
      sourceId: data.id,
      basePoints: 2,
      reason: "discussion_post",
    })

    const [{ data: bookmarks }, actorMeta, titleMeta] = await Promise.all([
      supabase.from("title_bookmarks").select("user_profile_id").eq("title_id", titleId),
      buildActorMetadata(supabase, profileId),
      buildTitleMetadata(supabase, titleId),
    ])

    const recipients = Array.from(
      new Set(
        (bookmarks ?? [])
          .map((row) => (row as any).user_profile_id as string)
          .filter((id) => id && id !== profileId)
      )
    )

    if (recipients.length > 0) {
      await supabase.from("notifications").insert(
        recipients.map((recipientId) => ({
          recipient_profile_id: recipientId,
          actor_profile_id: profileId,
          title_id: titleId,
          post_id: data.id,
          event_type: "bookmarked_discussion_post",
          metadata: {
            actor: actorMeta,
            title: titleMeta,
          },
        }))
      )
    }
  }

  revalidatePath(`/titles/${titleId}`)
  return { titleId }
}

export async function toggleDiscussionPostLike(postId: string) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { data: post, error: postError } = await supabase
    .from("discussion_posts")
    .select("id,user_id,title_id,likes_count")
    .eq("id", postId)
    .maybeSingle()

  if (postError || !post?.id) throw new Error("Post not found")

  const { data: existing } = await supabase
    .from("post_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", profileId)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("id", existing.id)

    if (error) throw new Error("Failed to remove like")

    await supabase
      .from("discussion_posts")
      .update({ likes_count: Math.max(0, (post.likes_count ?? 0) - 1) })
      .eq("id", postId)

    return { liked: false }
  }

  const { error: insertError } = await supabase
    .from("post_likes")
    .insert({ post_id: postId, user_id: profileId })

  if (insertError) throw new Error("Failed to like post")

  await supabase
    .from("discussion_posts")
    .update({ likes_count: (post.likes_count ?? 0) + 1 })
    .eq("id", postId)

  if (post.user_id && post.user_id !== profileId) {
    const [actorMeta, titleMeta] = await Promise.all([
      buildActorMetadata(supabase, profileId),
      post.title_id ? buildTitleMetadata(supabase, post.title_id as string) : Promise.resolve(null),
    ])

    await supabase.from("notifications").insert({
      recipient_profile_id: post.user_id,
      actor_profile_id: profileId,
      title_id: post.title_id ?? null,
      post_id: postId,
      event_type: "discussion_post_like",
      metadata: {
        actor: actorMeta,
        title: titleMeta,
      },
    })
  }

  return { liked: true }
}

export async function getTitleBookmarkStatus(titleId: string) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { data, error } = await supabase
    .from("title_bookmarks")
    .select("id")
    .eq("user_profile_id", profileId)
    .eq("title_id", titleId)
    .maybeSingle()

  if (error) throw new Error("Failed to load bookmark status")

  return Boolean(data?.id)
}

export async function toggleTitleBookmark(titleId: string) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { data: existing } = await supabase
    .from("title_bookmarks")
    .select("id")
    .eq("user_profile_id", profileId)
    .eq("title_id", titleId)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase
      .from("title_bookmarks")
      .delete()
      .eq("id", existing.id)

    if (error) throw new Error("Failed to remove bookmark")
    revalidatePath(`/titles/${titleId}`)
    return { bookmarked: false }
  }

  const { error } = await supabase
    .from("title_bookmarks")
    .insert({ user_profile_id: profileId, title_id: titleId })

  if (error) throw new Error("Failed to bookmark title")

  revalidatePath(`/titles/${titleId}`)
  return { bookmarked: true }
}

export type TitleEditionRow = {
  workId: string
  isbn10: string | null
  isbn13: string | null
  asin: string | null
  format: string | null
  saleability: string | null
}

export type TitleDedupeCandidate = OpenLibraryWorkCandidate

async function getTitleCore(titleId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("titles")
    .select("id,title,author,work_id,dupe_work_ids")
    .eq("id", titleId)
    .maybeSingle()

  if (error || !data) {
    console.error("Error fetching title core:", error)
    return null
  }

  return data as {
    id: string
    title: string
    author: string
    work_id: string | null
    dupe_work_ids: string[] | null
  }
}

async function filterDedupedWorkCandidates(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  candidates: OpenLibraryWorkCandidate[]
) {
  if (candidates.length === 0) return []
  const workIds = candidates.map((candidate) => candidate.workId)
  const orFilter = workIds.map((id) => `dupe_work_ids.cs.{${id}}`).join(",")

  const [{ data: titleWorkMatches }, { data: trackedWorkMatches }, { data: titleDupes }, { data: trackedDupes }] =
    await Promise.all([
      supabase.from("titles").select("work_id").in("work_id", workIds),
      supabase.from("tracked_books").select("work_id").in("work_id", workIds),
      orFilter
        ? supabase.from("titles").select("dupe_work_ids").or(orFilter)
        : Promise.resolve({ data: [] as any[] } as any),
      orFilter
        ? supabase.from("tracked_books").select("dupe_work_ids").or(orFilter)
        : Promise.resolve({ data: [] as any[] } as any),
    ])

  const deduped = new Set<string>()
  for (const row of titleWorkMatches ?? []) {
    if ((row as any).work_id) deduped.add((row as any).work_id as string)
  }
  for (const row of trackedWorkMatches ?? []) {
    if ((row as any).work_id) deduped.add((row as any).work_id as string)
  }

  const dupeRows = [...(titleDupes ?? []), ...(trackedDupes ?? [])]
  for (const row of dupeRows) {
    const values = (row as any).dupe_work_ids
    if (Array.isArray(values)) {
      for (const id of values) {
        if (typeof id === "string") deduped.add(id)
      }
    }
  }

  return candidates.filter((candidate) => !deduped.has(candidate.workId))
}

export async function getTitleEditionsAction(titleId: string): Promise<TitleEditionRow[]> {
  const supabase = await createServerClient()
  const core = await getTitleCore(titleId)
  if (!core) return []

  const workIds = [core.work_id, ...(core.dupe_work_ids ?? [])].filter(Boolean) as string[]
  if (workIds.length === 0) return []

  const { data, error } = await supabase
    .from("editions")
    .select("work_id,isbn_10,isbn_13,asin,format,saleability")
    .in("work_id", workIds)

  if (error) {
    console.error("Error fetching editions:", error)
    return []
  }

  const rows = (data ?? []) as any[]
  return rows
    .map((row) => ({
      workId: row.work_id as string,
      isbn10: row.isbn_10 ?? null,
      isbn13: row.isbn_13 ?? null,
      asin: row.asin ?? null,
      format: row.format ?? null,
      saleability: row.saleability ?? null,
    }))
    .sort((a, b) => {
      const aSale = a.saleability === "FOR_SALE" ? 1 : 0
      const bSale = b.saleability === "FOR_SALE" ? 1 : 0
      return bSale - aSale
    })
}

export async function getTitleDedupeCandidatesAction(titleId: string): Promise<{
  candidates: TitleDedupeCandidate[]
  selected: string[]
}> {
  const supabase = await createServerClient()
  const core = await getTitleCore(titleId)
  if (!core) return { candidates: [], selected: [] }

  const baseCandidates = await fetchOpenLibraryWorkCandidatesByTitleAuthor({
    title: core.title,
    author: core.author,
    limit: 15,
  })

  const candidates = await filterDedupedWorkCandidates(supabase, baseCandidates)
  const selected = (core.dupe_work_ids ?? []).filter((id) => id && id !== core.work_id)

  return { candidates, selected }
}

export async function updateTitleDedupeAction(titleId: string, dupeWorkIds: string[]) {
  const supabase = await createServerClient()
  await requireAuthedProfileId(supabase)

  const core = await getTitleCore(titleId)
  if (!core) throw new Error("Title not found")

  const normalized = Array.from(new Set(dupeWorkIds.filter(Boolean))).filter(
    (id) => id !== core.work_id
  )

  const { error: titleError } = await supabase
    .from("titles")
    .update({
      dupe_work_ids: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq("id", titleId)

  if (titleError) {
    console.error("Failed to update title dupes", titleError)
    throw new Error("Failed to update dedupe list")
  }

  const { error: trackedError } = await supabase
    .from("tracked_books")
    .update({
      dupe_work_ids: normalized,
      updated_at: new Date().toISOString(),
    })
    .or(`title_id.eq.${titleId},id.eq.${titleId}`)

  if (trackedError) {
    console.error("Failed to update tracked dupes", trackedError)
    throw new Error("Failed to update dedupe list")
  }

  revalidatePath(`/titles/${titleId}`)
  return { titleId }
}
