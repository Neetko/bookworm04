"use server"

import { createAdminClient, createServerClient } from "@/lib/supabase-server"
import { getCoverChoicesForSelectedWorks } from "@/lib/cover-cache"
import { extractPlainTextFromHtml, sanitizeRichTextHtml } from "@/lib/sanitize"
import { fetchOpenLibraryWorkCandidatesByTitleAuthor, type OpenLibraryWorkCandidate } from "@/lib/open-library"
import { getLinkedTitlesByWorkId, getTitleReferenceWorkIds, type LinkedTitleSummary } from "@/lib/reference-data"
import { isExactTitleAuthorMatch, normalizeWorkIdList, normalizeWorkSnapshots, type WorkSnapshot } from "@/lib/suggestions"
import { finalizeSuggestionApproval } from "@/lib/server/suggestion-approval"
import { canReviewSuggestions, getCurrentUserAccess } from "@/lib/server/roles"
import { hasVerifiedStaffSession } from "@/lib/server/staff-mfa"
import { getAuthedProfileId, requireAuthedProfileId } from "@/lib/server/auth"
import {
  ensureFinishedReadingListForProfile,
  removeTitleFromDefaultList,
} from "@/lib/server/title-lists"
import { revalidatePath } from "next/cache"
import { awardPointsForTitleAction } from "@/lib/server/rewards"

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

async function backfillCompletedTitleProgress(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string,
  titleId: string
) {
  const { error } = await supabase.from("title_user_progress").upsert(
    {
      user_profile_id: profileId,
      title_id: titleId,
      progress_percent: 100,
      is_completed: true,
      last_read_at: new Date().toISOString(),
    },
    {
      onConflict: "user_profile_id,title_id",
    }
  )

  if (error) {
    console.error("Failed to backfill completed title progress", error)
    throw new Error("Failed to update read status")
  }
}

async function clearCompletedTitleProgress(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string,
  titleId: string
) {
  const { error } = await supabase
    .from("title_user_progress")
    .delete()
    .eq("user_profile_id", profileId)
    .eq("title_id", titleId)
    .eq("is_completed", true)

  if (error) {
    console.error("Failed to clear completed title progress", error)
    throw new Error("Failed to update read status")
  }
}

async function ensureTitleFinishedActivity(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string,
  titleId: string
) {
  const { data: existing } = await supabase
    .from("activity_events")
    .select("id")
    .eq("user_profile_id", profileId)
    .eq("title_id", titleId)
    .eq("event_type", "title_finished")
    .limit(1)
    .maybeSingle()

  if (existing?.id) return

  const title = await buildTitleMetadata(supabase, titleId)
  const { error } = await supabase.from("activity_events").insert({
    user_profile_id: profileId,
    title_id: titleId,
    event_type: "title_finished",
    metadata: {
      title: title
        ? { id: title.id, title: title.title, cover: title.coverUrl }
        : { id: titleId, title: "a title", cover: null },
    },
  })

  if (error) {
    console.error("Failed to record title completion activity", error)
  }
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

      await ensureTitleFinishedActivity(supabase, profileId, titleId)

    }

    await backfillCompletedTitleProgress(supabase, profileId, titleId)

    await removeTitleFromDefaultList(supabase, profileId, titleId, "current-reading")
    await removeTitleFromDefaultList(supabase, profileId, titleId, "to-read")
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

    await clearCompletedTitleProgress(supabase, profileId, titleId)
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
  const profileId = await getAuthedProfileId(supabase)

  const { data, error } = await supabase
    .from("discussion_posts")
    .select("id, content, likes_count, created_at, user_id")
    .eq("title_id", titleId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to fetch discussion posts", error)
    throw new Error("Failed to load discussion")
  }

  const rows = (data ?? []) as any[]
  const postIds = rows.map((row) => row.id).filter(Boolean) as string[]
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean))) as string[]
  const likedSet = new Set<string>()

  const { data: profiles } = userIds.length
    ? await supabase
        .from("public_profiles")
        .select("id,username,avatar_url,role,created_at")
        .in("id", userIds)
    : { data: [] as Array<{ id: string; username: string | null; avatar_url: string | null; role: string | null; created_at: string | null }> }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]))

  if (profileId && postIds.length > 0) {
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
    user_profiles: profileMap.get(row.user_id as string)
      ? {
          username: profileMap.get(row.user_id as string)?.username ?? null,
          avatar_url: profileMap.get(row.user_id as string)?.avatar_url ?? null,
          role: profileMap.get(row.user_id as string)?.role ?? null,
          joined_date: profileMap.get(row.user_id as string)?.created_at ?? null,
          signature: null,
          signature_image: null,
        }
      : null,
  }))
}

export async function createDiscussionPost(titleId: string, content: string) {
  const supabase = await createServerClient()
  const admin = createAdminClient()
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
      admin.from("title_bookmarks").select("user_profile_id").eq("title_id", titleId),
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
      await admin.from("notifications").insert(
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
  const admin = createAdminClient()
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

    await admin
      .from("discussion_posts")
      .update({ likes_count: Math.max(0, (post.likes_count ?? 0) - 1) })
      .eq("id", postId)

    return { liked: false }
  }

  const { error: insertError } = await supabase
    .from("post_likes")
    .insert({ post_id: postId, user_id: profileId })

  if (insertError) throw new Error("Failed to like post")

  await admin
    .from("discussion_posts")
    .update({ likes_count: (post.likes_count ?? 0) + 1 })
    .eq("id", postId)

  if (post.user_id && post.user_id !== profileId) {
    const [actorMeta, titleMeta] = await Promise.all([
      buildActorMetadata(supabase, profileId),
      post.title_id ? buildTitleMetadata(supabase, post.title_id as string) : Promise.resolve(null),
    ])

    await admin.from("notifications").insert({
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
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (!profile?.id) return false

  const { data, error } = await supabase
    .from("title_bookmarks")
    .select("id")
    .eq("user_profile_id", profile.id)
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

export type TitleDedupeCandidate = OpenLibraryWorkCandidate & {
  linkedElsewhereTitles?: LinkedTitleSummary[]
  alreadySelectedForReview?: boolean
}

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

async function getTitleWorkIds(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  core: {
    id: string
    work_id: string | null
    dupe_work_ids: string[] | null
  }
): Promise<string[]> {
  return getTitleReferenceWorkIds(supabase, {
    titleId: core.id,
    fallbackWorkIds: [core.work_id, ...(core.dupe_work_ids ?? [])],
  })
}

async function filterDedupedWorkCandidates(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  titleId: string,
  title: string,
  author: string,
  existingWorkIds: string[],
  pendingReviewWorkIds: string[],
  candidates: OpenLibraryWorkCandidate[]
) {
  if (candidates.length === 0) {
    return {
      candidates: [] as TitleDedupeCandidate[],
      linkedElsewhere: {} as Record<string, LinkedTitleSummary[]>,
    }
  }

  const existingWorkIdSet = new Set(existingWorkIds)
  const pendingReviewWorkIdSet = new Set(pendingReviewWorkIds)
  const remainingCandidates = candidates.filter((candidate) => {
    if (existingWorkIdSet.has(candidate.workId)) return false

    return !isExactTitleAuthorMatch({
      title,
      author,
      candidateTitle: candidate.title,
      candidateAuthor: candidate.author,
    })
  })

  if (remainingCandidates.length === 0) {
    return {
      candidates: [] as TitleDedupeCandidate[],
      linkedElsewhere: {} as Record<string, LinkedTitleSummary[]>,
    }
  }

  const linkedElsewhere = await getLinkedTitlesByWorkId(supabase, {
    workIds: remainingCandidates.map((candidate) => candidate.workId),
    excludeTitleId: titleId,
  })

  return {
    candidates: remainingCandidates.map((candidate) => ({
      ...candidate,
      linkedElsewhereTitles: linkedElsewhere[candidate.workId] ?? [],
      alreadySelectedForReview: pendingReviewWorkIdSet.has(candidate.workId),
    })),
    linkedElsewhere,
  }
}

async function getPendingSuggestedWorkIdsForTitle(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  titleId: string
): Promise<string[]> {
  if (!titleId.trim()) return []

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("suggestions")
    .select("suggested_selected_work_ids,admin_final_selected_work_ids")
    .eq("title_id", titleId)
    .eq("status", "pending")

  if (error) {
    console.error("Failed to load pending title dedupe suggestions", error)
    return []
  }

  const workIds = new Set<string>()
  for (const row of data ?? []) {
    for (const workId of normalizeWorkIdList((row as any)?.suggested_selected_work_ids)) {
      workIds.add(workId)
    }
    for (const workId of normalizeWorkIdList((row as any)?.admin_final_selected_work_ids)) {
      workIds.add(workId)
    }
  }

  return Array.from(workIds)
}

export async function getTitleEditionsAction(titleId: string): Promise<TitleEditionRow[]> {
  const supabase = await createServerClient()
  const core = await getTitleCore(titleId)
  if (!core) return []

  const workIds = await getTitleWorkIds(supabase, core)
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
  linkedElsewhere: Record<string, LinkedTitleSummary[]>
}> {
  const supabase = await createServerClient()
  await requireAuthedProfileId(supabase)
  const core = await getTitleCore(titleId)
  if (!core) return { candidates: [], selected: [], linkedElsewhere: {} }

  const existingWorkIds = await getTitleWorkIds(supabase, core)
  const pendingReviewWorkIds = await getPendingSuggestedWorkIdsForTitle(supabase, core.id)

  const baseCandidates = await fetchOpenLibraryWorkCandidatesByTitleAuthor({
    title: core.title,
    author: core.author,
    limit: 15,
  })

  const { candidates, linkedElsewhere } = await filterDedupedWorkCandidates(
    supabase,
    core.id,
    core.title,
    core.author,
    existingWorkIds,
    pendingReviewWorkIds,
    baseCandidates
  )

  return { candidates, selected: [], linkedElsewhere }
}

export async function submitTitleDedupeSuggestionAction(input: {
  titleId: string
  selectedWorks: WorkSnapshot[]
}) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)
  const access = await getCurrentUserAccess()

  const titleId = input.titleId.trim()

  const core = await getTitleCore(titleId)
  if (!core) throw new Error("Title not found")

  const existingWorkIds = await getTitleWorkIds(supabase, core)
  const existingWorkIdSet = new Set(existingWorkIds)
  const pendingReviewWorkIds = await getPendingSuggestedWorkIdsForTitle(supabase, titleId)
  const pendingReviewWorkIdSet = new Set(pendingReviewWorkIds)
  const selectedWorkIds = normalizeWorkIdList(input.selectedWorks.map((work) => work.workId))
  const selectedWorkSnapshots = normalizeWorkSnapshots(input.selectedWorks)
    .filter((snapshot) => selectedWorkIds.includes(snapshot.workId))
    .filter((snapshot) => !existingWorkIdSet.has(snapshot.workId))
    .filter((snapshot) => !pendingReviewWorkIdSet.has(snapshot.workId))
    .filter((snapshot) => !isExactTitleAuthorMatch({
      title: core.title,
      author: core.author,
      candidateTitle: snapshot.title,
      candidateAuthor: snapshot.author,
    }))

  const normalizedSelectedWorkIds = selectedWorkIds
    .filter((workId) => workId !== core.work_id)
    .filter((workId) => !existingWorkIdSet.has(workId))
    .filter((workId) => !pendingReviewWorkIdSet.has(workId))
    .filter((workId) => selectedWorkSnapshots.some((snapshot) => snapshot.workId === workId))

  if (normalizedSelectedWorkIds.length === 0) {
    throw new Error("Select at least one new work ID to submit for review")
  }

  const finalSnapshots = normalizedSelectedWorkIds.map((workId) => {
    return selectedWorkSnapshots.find((snapshot) => snapshot.workId === workId) ?? {
      workId,
      title: workId,
      author: "",
      firstPublishYear: null,
      editionCount: null,
      forSale: null,
      coverUrl: null,
      subjects: [],
      matchCategory: null,
      matchConfidence: null,
      matchReason: null,
    }
  })

  const { data: insertedSuggestion, error: suggestionError } = await supabase
    .from("suggestions")
    .insert({
      title_id: titleId,
      suggested_genres: null,
      algorithm_suggested_genres: null,
      suggested_selected_work_ids: normalizedSelectedWorkIds,
      suggested_selected_work_snapshots: finalSnapshots,
      suggested_by_profile_id: profileId,
    })
    .select("id")
    .single()

  if (suggestionError || !insertedSuggestion?.id) {
    console.error("Failed to submit title dedupe suggestion", suggestionError)
    throw new Error("Failed to submit dedupe suggestion")
  }

  if (normalizedSelectedWorkIds.length > 0) {
    const admin = createAdminClient()
    try {
      await getCoverChoicesForSelectedWorks(admin as any, {
        workIds: normalizedSelectedWorkIds,
        workSnapshots: finalSnapshots,
      })
    } catch (error) {
      console.warn("Failed to warm work cover cache during title dedupe suggestion creation", error)
    }
  }

  const autoApproved = canReviewSuggestions(access.role) && Boolean(access.profileId) && await hasVerifiedStaffSession()
  if (autoApproved) {
    const admin = createAdminClient()
    await finalizeSuggestionApproval({
      admin,
      suggestionId: insertedSuggestion.id,
      reviewerProfileId: access.profileId as string,
      titleId,
      suggestedSelectedWorkIds: normalizedSelectedWorkIds,
      adminFinalSelectedWorkIds: normalizedSelectedWorkIds,
      suggestedSelectedWorkSnapshots: finalSnapshots,
      adminFinalSelectedWorkSnapshots: finalSnapshots,
    })
  }

  revalidatePath("/admin/suggestions")
  revalidatePath(`/titles/${titleId}`)
  return {
    titleId,
    submittedWorkIds: normalizedSelectedWorkIds,
    autoApproved,
  }
}
