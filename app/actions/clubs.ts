"use server"

import { createAdminClient, createServerClient } from "@/lib/supabase-server"
import { requireAuthedProfileId } from "@/lib/server/auth"
import { revalidatePath } from "next/cache"
import { normalizeGenres, type Genre } from "@/lib/types"
import { extractPlainTextFromHtml, sanitizeRichTextHtml } from "@/lib/sanitize"
import { randomUUID } from "crypto"
import { resizeAvatarImage } from "@/lib/avatar-image"
import { getOwnedAvatarObjectPath } from "@/lib/avatar-storage"

export type ClubType = "book" | "writer"
export type ClubJoinPolicy = "open" | "approval_required" | "invite_only"

export interface ClubBase {
  id: string
  type: ClubType
  join_policy: ClubJoinPolicy
  name: string
  description: string | null
  categories: Genre[] | null
  avatar_url: string | null
  current_title_id: string | null
  owner_user_id: string
  created_at: string
  updated_at: string
}

export interface ClubSummary extends ClubBase {
  memberCount: number
}

export interface ClubListItem extends ClubSummary {
  currentReading: string | null
  plannedReading: string[]
}

export interface ClubWithOwner extends ClubBase {
  owner: {
    username: string | null
    avatar_url: string | null
    role: string | null
    created_at: string | null
  } | null
}

export interface ClubApplicationListItem {
  id: string
  club_id: string
  user_id: string
  status: string
  created_at: string
  reviewed_at: string | null
  reviewed_by_user_id: string | null
  user: {
    id: string
    username: string | null
    avatar_url: string | null
    role: string | null
  } | null
}

export interface ClubInvitationListItem {
  id: string
  club_id: string
  inviter_user_id: string
  invitee_user_id: string
  status: string
  created_at: string
  responded_at: string | null
  invitee: {
    id: string
    username: string | null
    avatar_url: string | null
    role: string | null
  } | null
}

export interface ClubMemberProgressItem {
  user_id: string
  progress_percent: number
  current_page: number | null
  total_pages: number | null
  minutes_listened: number | null
  total_minutes: number | null
  is_completed: boolean
}

function normalizeJoinPolicy(value: string | null | undefined): ClubJoinPolicy {
  if (value === "open" || value === "invite_only") return value
  return "approval_required"
}

type ClubStatusRow = {
  id: string
  status: string | null
  created_at?: string | null
  responded_at?: string | null
}

function getStatusRowTimestamp(value: string | null | undefined) {
  if (!value) return 0
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function compareClubStatusRows<T extends ClubStatusRow>(a: T, b: T) {
  const pendingDelta = Number(b.status === "pending") - Number(a.status === "pending")
  if (pendingDelta !== 0) return pendingDelta

  const createdDelta = getStatusRowTimestamp(b.created_at) - getStatusRowTimestamp(a.created_at)
  if (createdDelta !== 0) return createdDelta

  return getStatusRowTimestamp(b.responded_at) - getStatusRowTimestamp(a.responded_at)
}

function pickPreferredClubStatusRow<T extends ClubStatusRow>(rows: T[] | null | undefined) {
  if (!rows?.length) return null
  return [...rows].sort(compareClubStatusRows)[0] ?? null
}

function dedupeClubStatusRows<T extends ClubStatusRow>(
  rows: T[] | null | undefined,
  getKey: (row: T) => string | null | undefined
) {
  if (!rows?.length) return [] as T[]

  const uniqueRows = new Map<string, T>()

  for (const row of [...rows].sort(compareClubStatusRows)) {
    const key = getKey(row)?.trim()
    if (!key || uniqueRows.has(key)) continue
    uniqueRows.set(key, row)
  }

  return Array.from(uniqueRows.values())
}

async function getAuthedProfileIdOrNull(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return null

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  return (profile?.id as string | null) ?? null
}

async function getClubViewerState(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  clubId: string,
  profileId: string | null
) {
  const { data: club, error } = await supabase
    .from("clubs")
    .select("id, owner_user_id, join_policy")
    .eq("id", clubId)
    .maybeSingle()

  if (error || !club) throw new Error("Club not found")

  if (!profileId) {
    return {
      club,
      isOwner: false,
      isMember: false,
      application: null as { id: string; status: string } | null,
      invitation: null as { id: string; status: string } | null,
    }
  }

  const isOwner = club.owner_user_id === profileId

  const [{ data: membership }, { data: application }, { data: invitation }] = await Promise.all([
    supabase
      .from("club_members")
      .select("id")
      .eq("club_id", clubId)
      .eq("user_id", profileId)
      .maybeSingle(),
    supabase
      .from("club_applications")
      .select("id, status, created_at, reviewed_at")
      .eq("club_id", clubId)
      .eq("user_id", profileId)
      .order("created_at", { ascending: false }),
    supabase
      .from("club_invitations")
      .select("id, status, created_at, responded_at")
      .eq("club_id", clubId)
      .eq("invitee_user_id", profileId)
      .order("created_at", { ascending: false }),
  ])

  const activeApplication = pickPreferredClubStatusRow(
    (application ?? []) as Array<{ id: string; status: string | null; created_at: string | null; reviewed_at: string | null }>
  )
  const activeInvitation = pickPreferredClubStatusRow(
    (invitation ?? []) as Array<{ id: string; status: string | null; created_at: string | null; responded_at: string | null }>
  )

  return {
    club,
    isOwner,
    isMember: isOwner || !!membership,
    application: activeApplication
      ? { id: activeApplication.id as string, status: activeApplication.status as string }
      : null,
    invitation: activeInvitation
      ? { id: activeInvitation.id as string, status: activeInvitation.status as string }
      : null,
  }
}

async function requireOwnerProfileId(supabase: Awaited<ReturnType<typeof createServerClient>>, clubId: string) {
  const profileId = await requireAuthedProfileId(supabase)

  const { data: club, error } = await supabase
    .from("clubs")
    .select("owner_user_id")
    .eq("id", clubId)
    .single()

  if (error || !club) throw new Error("Club not found")
  if (club.owner_user_id !== profileId) throw new Error("Forbidden")

  return profileId
}

const CLUB_RPC_ERROR_MESSAGES = [
  "Club not found",
  "User not found",
  "Application not found",
  "Invitation not found",
  "You are already a member of this club",
  "You already have a pending invitation",
  "This club is not accepting applications",
  "This club requires approval or an invitation",
  "This reader already manages the club",
  "This reader is already a member",
  "This reader already has a pending application",
  "Application is no longer pending",
  "Invitation is no longer pending",
  "Transfer ownership or delete the club before leaving",
  "Cannot remove the club owner",
] as const

function throwClubRpcError(error: { message?: string; code?: string }, fallback: string): never {
  const message = error.message?.trim() ?? ""
  const userMessage = CLUB_RPC_ERROR_MESSAGES.find((knownMessage) => message.includes(knownMessage))

  console.error("Club lifecycle operation failed", {
    code: error.code,
    message,
  })

  if (message.includes("Unauthorized")) throw new Error("Please sign in to continue")
  if (message.includes("Forbidden")) throw new Error("You do not have permission to do that")
  throw new Error(userMessage ?? fallback)
}

function revalidateClubLifecycle(clubId: string) {
  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
  revalidatePath("/community")
  revalidatePath("/notifications")
}

export async function getClubs() {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching clubs:", error)
    return [] as ClubListItem[]
  }

  const clubs = (data ?? []) as ClubBase[]

  const bookClubs = clubs.filter((club) => club.type === "book")
  const bookClubIds = bookClubs.map((club) => club.id)

  const currentTitleIds = bookClubs
    .map((club) => club.current_title_id)
    .filter(Boolean) as string[]

  const { data: currentTitles } = currentTitleIds.length
    ? await supabase.from("titles").select("id, title").in("id", currentTitleIds)
    : { data: [] as Array<{ id: string; title: string }> }

  const currentTitleMap = new Map((currentTitles ?? []).map((t) => [t.id, t.title]))

  let plannedItems: Array<{
    club_id: string
    title_id?: string | null
    title: string | null
    created_at?: string
  }> = []

  if (bookClubIds.length > 0) {
    const plannedRes = await supabase
      .from("club_reading_items")
      .select("club_id, title_id, title, created_at")
      .in("club_id", bookClubIds)
      .order("created_at", { ascending: false })

    if (plannedRes.error) {
      const message = `${plannedRes.error.message ?? ""}`
      const isMissingTitleId = plannedRes.error.code === "42703" || message.includes("column")

      if (isMissingTitleId) {
        const fallbackRes = await supabase
          .from("club_reading_items")
          .select("club_id, title, created_at")
          .in("club_id", bookClubIds)
          .order("created_at", { ascending: false })

        plannedItems = (fallbackRes.data ?? []) as typeof plannedItems
      } else {
        console.error("Error fetching planned reading items:", plannedRes.error)
      }
    } else {
      plannedItems = (plannedRes.data ?? []) as typeof plannedItems
    }
  }

  const plannedTitleIds = plannedItems
    .map((item) => item.title_id)
    .filter(Boolean) as string[]

  const plannedTitlesRes = plannedTitleIds.length
    ? await supabase.from("titles").select("id, title").in("id", plannedTitleIds)
    : { data: [] as any[] }

  const plannedTitleMap = new Map((plannedTitlesRes.data ?? []).map((t: any) => [t.id, t.title]))

  const plannedByClub = new Map<string, string[]>()
  for (const item of plannedItems) {
    const clubId = item.club_id
    const list = plannedByClub.get(clubId) ?? []
    if (list.length >= 4) continue

    const title =
      (item.title_id ? plannedTitleMap.get(item.title_id) : null) ??
      item.title ??
      "Untitled"

    list.push(title)
    plannedByClub.set(clubId, list)
  }

  const memberCounts = await Promise.all(
    clubs.map(async (club) => {
      const { count } = await supabase
        .from("club_members")
        .select("id", { count: "exact", head: true })
        .eq("club_id", club.id)

      return typeof count === "number" ? count : 0
    })
  )

  return clubs.map((club, idx) => ({
    ...(club as any),
    join_policy: normalizeJoinPolicy((club as any).join_policy),
    memberCount: memberCounts[idx] ?? 0,
    currentReading:
      club.type === "book" && club.current_title_id
        ? currentTitleMap.get(club.current_title_id) ?? null
        : null,
    plannedReading: club.type === "book" ? plannedByClub.get(club.id) ?? [] : [],
  })) as ClubListItem[]
}

export async function getClub(clubId: string) {
  const supabase = await createServerClient()

  const { data: club, error } = await supabase
    .from("clubs")
    .select("*")
    .eq("id", clubId)
    .single()

  if (error) {
    console.error("Error fetching club:", error)
    return null
  }

  const { data: owner } = await supabase
    .from("public_profiles")
    .select("username, avatar_url, role, created_at")
    .eq("id", club.owner_user_id)
    .maybeSingle()

  return {
    ...club,
    join_policy: normalizeJoinPolicy((club as any).join_policy),
    owner: owner ?? null,
  } as unknown as ClubWithOwner
}

async function requireMemberOrOwner(supabase: Awaited<ReturnType<typeof createServerClient>>, clubId: string) {
  const profileId = await requireAuthedProfileId(supabase)

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("owner_user_id")
    .eq("id", clubId)
    .single()

  if (clubError || !club) throw new Error("Club not found")
  if (club.owner_user_id === profileId) return profileId

  const { data: member } = await supabase
    .from("club_members")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", profileId)
    .maybeSingle()

  if (!member) throw new Error("Forbidden")
  return profileId
}

export async function setClubCurrentReading(clubId: string, titleId: string | null) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const { error } = await supabase
    .from("clubs")
    .update({ current_title_id: titleId, updated_at: new Date().toISOString() })
    .eq("id", clubId)

  if (error) {
    const message = `${error.message ?? ""}`
    const isMissingColumn = error.code === "42703" || (message.includes("column") && message.includes("current_title_id"))

    if (isMissingColumn) {
      const { error: fallbackError } = await supabase
        .from("clubs")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", clubId)

      if (fallbackError) {
        console.error("Failed to update current reading (fallback)", fallbackError)
        throw new Error("Failed to update current reading")
      }
    } else {
      console.error("Failed to update current reading", error)
      throw new Error("Failed to update current reading")
    }
  }

  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
}

export async function getClubCurrentReading(clubId: string) {
  const supabase = await createServerClient()
  const { data: club, error } = await supabase
    .from("clubs")
    .select("current_title_id")
    .eq("id", clubId)
    .single()

  if (error) {
    const message = `${error.message ?? ""}`
    const isMissingColumn = error.code === "42703" || (message.includes("column") && message.includes("current_title_id"))
    if (!isMissingColumn) {
      console.error("Error fetching current reading", error)
    }
    return null
  }

  if (!club?.current_title_id) return null

  const { data: title, error: titleError } = await supabase
    .from("titles")
    .select("id, title, author, cover_image_url")
    .eq("id", club.current_title_id)
    .maybeSingle()

  if (titleError || !title) return null
  return title
}

export async function getClubCurrentReadingComments(clubId: string) {
  const supabase = await createServerClient()

  const { data: club } = await supabase
    .from("clubs")
    .select("current_title_id")
    .eq("id", clubId)
    .maybeSingle()

  if (!club?.current_title_id) return []

  const { data, error } = await supabase
    .from("club_reading_comments")
    .select("id, content, likes_count, created_at, user_id")
    .eq("club_id", clubId)
    .eq("title_id", club.current_title_id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching club comments", error)
    return []
  }

  const userIds = Array.from(new Set((data ?? []).map((row: any) => row.user_id).filter(Boolean))) as string[]
  const { data: profiles } = userIds.length
    ? await supabase
        .from("public_profiles")
        .select("id, username, avatar_url")
        .in("id", userIds)
    : { data: [] as Array<{ id: string; username: string | null; avatar_url: string | null }> }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]))

  return (data ?? []).map((row: any) => ({
    ...row,
    user_profiles: profileMap.get(row.user_id as string) ?? null,
  }))
}

export async function addClubCurrentReadingComment(clubId: string, content: string) {
  const supabase = await createServerClient()
  const profileId = await requireMemberOrOwner(supabase, clubId)

  const { data: club } = await supabase
    .from("clubs")
    .select("current_title_id")
    .eq("id", clubId)
    .single()

  if (!club?.current_title_id) throw new Error("No current reading selected")

  const cleaned = sanitizeRichTextHtml(content)
  const plain = extractPlainTextFromHtml(cleaned)
  if (!plain) throw new Error("Message cannot be empty")

  const { error } = await supabase.from("club_reading_comments").insert({
    club_id: clubId,
    title_id: club.current_title_id,
    user_id: profileId,
    content: cleaned,
    likes_count: 0,
  })

  if (error) throw new Error("Failed to add comment")

  revalidatePath(`/community/clubs/${clubId}`)
}

export async function upvoteClubCurrentReadingComment(commentId: string) {
  const supabase = await createServerClient()
  const admin = createAdminClient()

  const { data: comment, error: commentError } = await supabase
    .from("club_reading_comments")
    .select("id, club_id, likes_count")
    .eq("id", commentId)
    .single()

  if (commentError || !comment) throw new Error("Comment not found")

  await requireMemberOrOwner(supabase, comment.club_id)

  const nextCount = (comment.likes_count ?? 0) + 1
  const { error } = await admin
    .from("club_reading_comments")
    .update({ likes_count: nextCount })
    .eq("id", commentId)

  if (error) throw new Error("Failed to upvote")

  revalidatePath(`/community/clubs/${comment.club_id}`)
}

export async function createClub(type: ClubType, name: string, description: string, categories: Genre[] = []) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const safeCategories = normalizeGenres(categories)

  const { data, error } = await supabase
    .from("clubs")
    .insert({
      type,
      name,
      description: description || null,
      categories: safeCategories.length ? safeCategories : null,
      owner_user_id: profileId,
    })
    .select("id")
    .single()

  if (error || !data) throw new Error("Failed to create club")

  await supabase.from("activity_events").insert({
    user_profile_id: profileId,
    event_type: "club_created",
    metadata: {
      club: {
        id: data.id as string,
        name,
        avatar_url: null,
      },
    },
  })

  revalidatePath("/community")
  revalidatePath(`/community/clubs/${data.id}`)

  return data.id as string
}

export async function updateClub(clubId: string, updates: { name: string; description: string; type: ClubType }) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const { error } = await supabase
    .from("clubs")
    .update({
      name: updates.name,
      description: updates.description || null,
      type: updates.type,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clubId)

  if (error) throw new Error("Failed to update club")

  revalidatePath("/community")
  revalidatePath(`/community/clubs/${clubId}`)
}

export async function updateClubSettings(
  clubId: string,
  updates: {
    name: string
    description: string
    avatarUrl: string
    categories: Genre[]
    joinPolicy: ClubJoinPolicy
  }
) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const safeCategories = normalizeGenres(updates.categories)
  const avatarUrl = updates.avatarUrl.trim() || null
  const joinPolicy = normalizeJoinPolicy(updates.joinPolicy)

  const { error } = await supabase
    .from("clubs")
    .update({
      name: updates.name.trim(),
      description: updates.description.trim() || null,
      avatar_url: avatarUrl,
      categories: safeCategories.length ? safeCategories : null,
      join_policy: joinPolicy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clubId)

  if (error) throw new Error("Failed to update club")

  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
  revalidatePath("/community")
}

export async function inviteMemberToClub(
  clubId: string,
  input: string | { profileId?: string | null; username?: string | null }
) {
  const supabase = await createServerClient()
  const ownerProfileId = await requireOwnerProfileId(supabase, clubId)

  const profileIdInput = typeof input === "string" ? null : input.profileId?.trim() || null
  const usernameInput = typeof input === "string" ? input.trim() : input.username?.trim() || ""

  if (!profileIdInput && !usernameInput) throw new Error("Username required")

  const profileLookup = profileIdInput
    ? await supabase
        .from("public_profiles")
        .select("id, username")
        .eq("id", profileIdInput)
        .maybeSingle()
    : await supabase
        .from("public_profiles")
        .select("id, username")
        .ilike("username", usernameInput)
        .limit(1)
        .maybeSingle()

  const { data: profile, error: profileError } = profileLookup

  if (profileError || !profile) throw new Error("User not found")
  if ((profile.id as string) === ownerProfileId) throw new Error("You already manage this club")

  const { error } = await supabase.rpc("invite_club_member", {
    target_club_id: clubId,
    target_invitee_profile_id: profile.id as string,
  })

  if (error) throwClubRpcError(error, "Failed to invite reader")

  revalidateClubLifecycle(clubId)
}

export async function revokeClubInvitation(clubId: string, invitationId: string) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const { error } = await supabase.rpc("revoke_club_invitation", {
    target_club_id: clubId,
    target_invitation_id: invitationId,
  })

  if (error) throwClubRpcError(error, "Failed to revoke invitation")

  revalidateClubLifecycle(clubId)
}

export async function removeMemberFromClub(clubId: string, memberProfileId: string) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const { error } = await supabase.rpc("remove_club_member", {
    target_club_id: clubId,
    target_member_profile_id: memberProfileId,
    removal_reason: null,
  })

  if (error) throwClubRpcError(error, "Failed to remove member")

  revalidateClubLifecycle(clubId)
}

export async function addClubReadingItem(
  clubId: string,
  input: { titleId?: string; title?: string; author?: string }
) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const titleId = input.titleId?.trim() || null
  const title = input.title?.trim() || null
  const author = input.author?.trim() || null

  if (!titleId && !title) throw new Error("Provide a title id or title")

  const payload: Record<string, any> = {
    club_id: clubId,
    title,
    author,
  }

  if (titleId) {
    payload.title_id = titleId
  }

  const { error } = await supabase.from("club_reading_items").insert(payload)

  if (error) {
    const message = `${error.message ?? ""}`
    const isMissingColumn = error.code === "42703" || message.includes("column") && message.includes("title_id")

    if (isMissingColumn) {
      const { error: fallbackError } = await supabase.from("club_reading_items").insert({
        club_id: clubId,
        title,
        author,
      })

      if (fallbackError) {
        console.error("Failed to add title (fallback)", fallbackError)
        throw new Error("Failed to add title")
      }
    } else {
      console.error("Failed to add title", error)
      throw new Error("Failed to add title")
    }
  }

  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
}

export async function removeClubReadingItem(clubId: string, itemId: string) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const { error } = await supabase
    .from("club_reading_items")
    .delete()
    .eq("id", itemId)
    .eq("club_id", clubId)

  if (error) throw new Error("Failed to remove title")

  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
}

export async function uploadClubAvatar(clubId: string, formData: FormData) {
  const supabase = await createServerClient()
  const ownerProfileId = await requireOwnerProfileId(supabase, clubId)
  const { data: existingClub, error: existingClubError } = await supabase
    .from("clubs")
    .select("avatar_url")
    .eq("id", clubId)
    .single()
  if (existingClubError || !existingClub) throw new Error("Club not found")

  const file = formData.get("file")
  if (!(file instanceof File)) throw new Error("Missing file")
  if (!file.type.startsWith("image/")) throw new Error("File must be an image")
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be <= 5MB")

  const admin = createAdminClient()
  const { data: withinQuota, error: quotaError } = await admin.rpc("consume_avatar_upload_quota", {
    p_profile_id: ownerProfileId,
  })
  if (quotaError) throw new Error("Failed to check avatar upload limit")
  if (!withinQuota) throw new Error("Avatar upload limit reached for today")

  let resized
  try {
    resized = await resizeAvatarImage(file, 200)
  } catch (error) {
    console.error(error)
    throw new Error("Unsupported or invalid image")
  }

  const path = `clubs/${clubId}/${randomUUID()}.${resized.ext}`

  const { error: uploadError } = await admin.storage
    .from("club-avatars")
    .upload(path, resized.buffer, { upsert: false, contentType: resized.contentType })

  if (uploadError) throw new Error("Failed to upload avatar")

  const { data: publicUrlData } = admin.storage.from("club-avatars").getPublicUrl(path)
  const publicUrl = publicUrlData.publicUrl

  const { error: updateError } = await supabase
    .from("clubs")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", clubId)

  if (updateError) {
    const { error: cleanupError } = await admin.storage.from("club-avatars").remove([path])
    if (cleanupError) console.error("Failed to remove unsaved club avatar", cleanupError)
    throw new Error("Failed to save avatar")
  }

  const oldPath = getOwnedAvatarObjectPath(existingClub.avatar_url, "club-avatars", `clubs/${clubId}`)
  if (oldPath && oldPath !== path) {
    const { error: cleanupError } = await admin.storage.from("club-avatars").remove([oldPath])
    if (cleanupError) console.error("Failed to remove replaced club avatar", cleanupError)
  }

  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
  revalidatePath("/community")

  return publicUrl
}


export async function getMyMembership(clubId: string) {
  const supabase = await createServerClient()
  const profileId = await getAuthedProfileIdOrNull(supabase)

  if (!profileId) {
    return {
      isMember: false,
      isOwner: false,
      profileId: null as string | null,
      joinPolicy: null as ClubJoinPolicy | null,
      pendingApplication: false,
      pendingInvitation: false,
      invitationId: null as string | null,
    }
  }

  const state = await getClubViewerState(supabase, clubId, profileId)

  return {
    isMember: state.isMember,
    isOwner: state.isOwner,
    profileId,
    joinPolicy: normalizeJoinPolicy(state.club.join_policy as string | null),
    pendingApplication: state.application?.status === "pending",
    pendingInvitation: state.invitation?.status === "pending",
    invitationId: state.invitation?.status === "pending" ? state.invitation.id : null,
  }
}

export async function getMyProfile() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { profileId: null as string | null, role: null as string | null }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single()

  if (!profile) return { profileId: null as string | null, role: null as string | null }

  return { profileId: profile.id as string, role: (profile.role as string | null) ?? null }
}

export async function getClubMembers(clubId: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("club_members")
    .select("user_id, created_at")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching club members:", error)
    return [] as Array<{ id: string; username: string | null; avatar_url: string | null; role: string | null }>
  }

  const memberIds = Array.from(
    new Set((data ?? []).map((row: any) => row.user_id).filter(Boolean) as string[])
  )

  const { data: memberProfiles } = memberIds.length
    ? await supabase
        .from("public_profiles")
        .select("id,username,avatar_url,role")
        .in("id", memberIds)
    : { data: [] as Array<{ id: string; username: string | null; avatar_url: string | null; role: string | null }> }

  const memberMap = new Map(
    (memberProfiles ?? []).map((member) => [member.id as string, member])
  )

  const members = (data ?? [])
    .map((row: any) => memberMap.get(row.user_id as string))
    .filter(Boolean) as Array<{ id: string; username: string | null; avatar_url: string | null; role: string | null }>

  const { data: club } = await supabase
    .from("clubs")
    .select("owner_user_id")
    .eq("id", clubId)
    .maybeSingle()

  const { data: owner } = club?.owner_user_id
    ? await supabase
        .from("public_profiles")
        .select("id,username,avatar_url,role")
        .eq("id", club.owner_user_id)
        .maybeSingle()
    : { data: null as { id: string; username: string | null; avatar_url: string | null; role: string | null } | null }

  if (owner && !members.some((m) => m.id === owner.id)) {
    return [owner, ...members]
  }

  return members
}

export async function getClubMemberCurrentProgress(clubId: string) {
  const supabase = await createServerClient()

  await requireMemberOrOwner(supabase, clubId)

  const { data, error } = await supabase.rpc("get_club_member_current_progress", {
    target_club_id: clubId,
  })

  if (error) {
    console.error("Error fetching club member progress:", error)
    return [] as ClubMemberProgressItem[]
  }

  return (data ?? [])
    .map((row: any) => {
      const userId = typeof row.user_id === "string" ? row.user_id : null
      if (!userId) return null

    const pagePercent =
        typeof row.current_page === "number" && typeof row.total_pages === "number" && row.total_pages > 0
          ? Math.round((row.current_page / row.total_pages) * 100)
          : null
      const minutePercent =
        typeof row.minutes_listened === "number" && typeof row.total_minutes === "number" && row.total_minutes > 0
          ? Math.round((row.minutes_listened / row.total_minutes) * 100)
          : null
      const normalizedPercent =
        typeof row.progress_percent === "number"
          ? row.progress_percent
          : pagePercent ?? minutePercent ?? (row.is_completed ? 100 : 0)

      return {
        user_id: userId,
        progress_percent: Math.max(0, Math.min(100, normalizedPercent)),
        current_page: typeof row.current_page === "number" ? row.current_page : null,
        total_pages: typeof row.total_pages === "number" ? row.total_pages : null,
        minutes_listened: typeof row.minutes_listened === "number" ? row.minutes_listened : null,
        total_minutes: typeof row.total_minutes === "number" ? row.total_minutes : null,
        is_completed: Boolean(row.is_completed),
      }
    })
    .filter(Boolean) as ClubMemberProgressItem[]
}

export async function getClubApplications(clubId: string) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const { data, error } = await supabase
    .from("club_applications")
    .select("id, club_id, user_id, status, created_at, reviewed_at, reviewed_by_user_id")
    .eq("club_id", clubId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching club applications:", error)
    return [] as ClubApplicationListItem[]
  }

  const profileIds = Array.from(new Set((data ?? []).map((row: any) => row.user_id).filter(Boolean)))
  const { data: profiles } = profileIds.length
    ? await supabase.from("public_profiles").select("id, username, avatar_url, role").in("id", profileIds)
    : { data: [] as Array<{ id: string; username: string | null; avatar_url: string | null; role: string | null }> }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]))

  const uniqueRows = dedupeClubStatusRows(
    (data ?? []) as Array<{ id: string; user_id: string | null; status: string | null; created_at: string | null }>,
    (row) => row.user_id
  )

  return uniqueRows.map((row: any) => ({
    ...row,
    user: profileMap.get(row.user_id as string) ?? null,
  })) as ClubApplicationListItem[]
}

export async function getClubInvitations(clubId: string) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const { data, error } = await supabase
    .from("club_invitations")
    .select("id, club_id, inviter_user_id, invitee_user_id, status, created_at, responded_at")
    .eq("club_id", clubId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching club invitations:", error)
    return [] as ClubInvitationListItem[]
  }

  const profileIds = Array.from(new Set((data ?? []).map((row: any) => row.invitee_user_id).filter(Boolean)))
  const { data: profiles } = profileIds.length
    ? await supabase.from("public_profiles").select("id, username, avatar_url, role").in("id", profileIds)
    : { data: [] as Array<{ id: string; username: string | null; avatar_url: string | null; role: string | null }> }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]))

  const uniqueRows = dedupeClubStatusRows(
    (data ?? []) as Array<{ id: string; invitee_user_id: string | null; status: string | null; created_at: string | null; responded_at: string | null }>,
    (row) => row.invitee_user_id
  )

  return uniqueRows.map((row: any) => ({
    ...row,
    invitee: profileMap.get(row.invitee_user_id as string) ?? null,
  })) as ClubInvitationListItem[]
}

export async function getClubReadingItems(clubId: string) {
  const supabase = await createServerClient()

  const { data: items, error } = await supabase
    .from("club_reading_items")
    .select("id, title_id, title, author, created_at")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching club reading items:", error)
    return [] as Array<{
      id: string
      title_id: string | null
      title: string | null
      author: string | null
      created_at: string
      title_data?: { id: string; title: string; author: string; cover_image_url: string | null } | null
    }>
  }

  const titleIds = (items ?? []).map((i) => i.title_id).filter(Boolean) as string[]

  const titlesRes = titleIds.length
    ? await supabase
        .from("titles")
        .select("id, title, author, cover_image_url")
        .in("id", titleIds)
    : { data: [] as any[] }

  const titleMap = new Map((titlesRes.data ?? []).map((t: any) => [t.id, t]))

  return (items ?? []).map((item: any) => ({
    ...item,
    title_data: item.title_id ? titleMap.get(item.title_id) ?? null : null,
  }))
}

export async function applyToClub(clubId: string) {
  const supabase = await createServerClient()
  await requireAuthedProfileId(supabase)

  const { error } = await supabase.rpc("submit_club_application", {
    target_club_id: clubId,
  })

  if (error) throwClubRpcError(error, "Failed to submit application")

  revalidateClubLifecycle(clubId)
}

export async function withdrawClubApplication(clubId: string) {
  const supabase = await createServerClient()
  await requireAuthedProfileId(supabase)

  const { error } = await supabase.rpc("withdraw_club_application", {
    target_club_id: clubId,
  })

  if (error) throwClubRpcError(error, "Failed to withdraw application")

  revalidateClubLifecycle(clubId)
}

export async function joinClub(clubId: string) {
  const supabase = await createServerClient()
  await requireAuthedProfileId(supabase)

  const { error } = await supabase.rpc("join_open_club", {
    target_club_id: clubId,
  })

  if (error) throwClubRpcError(error, "Failed to join club")

  revalidateClubLifecycle(clubId)
}

export async function acceptClubApplication(clubId: string, applicationId: string) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const { error } = await supabase.rpc("review_club_application", {
    target_club_id: clubId,
    target_application_id: applicationId,
    approve_application: true,
  })

  if (error) throwClubRpcError(error, "Failed to approve application")

  revalidateClubLifecycle(clubId)
}

export async function declineClubApplication(clubId: string, applicationId: string) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const { error } = await supabase.rpc("review_club_application", {
    target_club_id: clubId,
    target_application_id: applicationId,
    approve_application: false,
  })

  if (error) throwClubRpcError(error, "Failed to decline application")

  revalidateClubLifecycle(clubId)
}

export async function acceptClubInvitation(invitationId: string) {
  const supabase = await createServerClient()
  await requireAuthedProfileId(supabase)

  const { data: clubId, error } = await supabase.rpc("respond_to_club_invitation", {
    target_invitation_id: invitationId,
    accept_invitation: true,
  })

  if (error) throwClubRpcError(error, "Failed to accept invitation")

  if (typeof clubId === "string") revalidateClubLifecycle(clubId)
  else revalidatePath("/notifications")
}

export async function declineClubInvitation(invitationId: string) {
  const supabase = await createServerClient()
  await requireAuthedProfileId(supabase)

  const { data: clubId, error } = await supabase.rpc("respond_to_club_invitation", {
    target_invitation_id: invitationId,
    accept_invitation: false,
  })

  if (error) throwClubRpcError(error, "Failed to decline invitation")

  if (typeof clubId === "string") revalidateClubLifecycle(clubId)
  else revalidatePath("/notifications")
}

export async function leaveClub(clubId: string) {
  const supabase = await createServerClient()
  await requireAuthedProfileId(supabase)

  const { error } = await supabase.rpc("leave_club", {
    target_club_id: clubId,
  })

  if (error) throwClubRpcError(error, "Failed to leave club")

  revalidateClubLifecycle(clubId)
}
