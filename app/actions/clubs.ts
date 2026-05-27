"use server"

import { createAdminClient, createServerClient } from "@/lib/supabase-server"
import { requireAuthedProfileId } from "@/lib/server/auth"
import { revalidatePath } from "next/cache"
import { normalizeGenres, type Genre } from "@/lib/types"
import { extractPlainTextFromHtml, sanitizeRichTextHtml } from "@/lib/sanitize"
import { randomUUID } from "crypto"
import { resizeAvatarImage } from "@/lib/avatar-image"

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

async function getActorNotificationMeta(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profileId: string
) {
  const { data } = await supabase
    .from("public_profiles")
    .select("id, username, avatar_url")
    .eq("id", profileId)
    .maybeSingle()

  if (!data) return null

  return {
    id: data.id as string,
    username: (data.username as string | null) ?? null,
    avatarUrl: (data.avatar_url as string | null) ?? null,
  }
}

async function getClubNotificationMeta(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  clubId: string
) {
  const { data } = await supabase
    .from("clubs")
    .select("id, name, avatar_url")
    .eq("id", clubId)
    .maybeSingle()

  if (!data) return null

  return {
    id: data.id as string,
    name: data.name as string,
    avatarUrl: (data.avatar_url as string | null) ?? null,
  }
}

async function createClubNotification(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  payload: {
    recipient_profile_id: string
    actor_profile_id?: string | null
    event_type: string
    metadata?: Record<string, unknown> | null
  }
) {
  const admin = createAdminClient()

  const { error } = await admin.from("notifications").insert({
    recipient_profile_id: payload.recipient_profile_id,
    actor_profile_id: payload.actor_profile_id ?? null,
    event_type: payload.event_type,
    metadata: payload.metadata ?? null,
  })

  if (error) {
    console.error("Failed to create club notification", {
      eventType: payload.event_type,
      recipientProfileId: payload.recipient_profile_id,
      actorProfileId: payload.actor_profile_id ?? null,
      error,
    })
    throw new Error("Failed to send notification")
  }
}

function isNotificationMetadataRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function resolveClubInvitationNotification(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  args: {
    recipientProfileId: string
    invitationId: string
    accepted: boolean
    respondedAt: string
  }
) {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, metadata, created_at")
    .eq("recipient_profile_id", args.recipientProfileId)
    .eq("event_type", "club_invited_to_club")

  if (error) {
    console.error("Failed to load club invitation notifications", {
      recipientProfileId: args.recipientProfileId,
      invitationId: args.invitationId,
      error,
    })
    return
  }

  const matchingNotifications = (data ?? []).filter((notification) => {
    if (!isNotificationMetadataRecord(notification.metadata)) return false
    const invitation = notification.metadata.invitation
    return isNotificationMetadataRecord(invitation) && invitation.id === args.invitationId
  })

  if (matchingNotifications.length === 0) return

  const unresolvedNotifications = matchingNotifications.filter((notification) => {
    if (!isNotificationMetadataRecord(notification.metadata)) return true

    const resolution = notification.metadata.resolution
    if (isNotificationMetadataRecord(resolution)) {
      const action = resolution.action
      if (action === "accepted" || action === "declined") return false
    }

    const invitation = notification.metadata.invitation
    if (isNotificationMetadataRecord(invitation)) {
      const status = invitation.status
      if (status === "accepted" || status === "declined") return false
    }

    return true
  })

  const notificationsToUpdate =
    unresolvedNotifications.length > 0
      ? unresolvedNotifications
      : [...matchingNotifications]
          .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
          .slice(0, 1)

  await Promise.all(
    notificationsToUpdate.map(async (notification) => {
      const existingMetadata = isNotificationMetadataRecord(notification.metadata) ? notification.metadata : {}
      const existingInvitation = isNotificationMetadataRecord(existingMetadata.invitation)
        ? existingMetadata.invitation
        : {}

      const metadata = {
        ...existingMetadata,
        invitation: {
          ...existingInvitation,
          id: args.invitationId,
          status: args.accepted ? "accepted" : "declined",
          respondedAt: args.respondedAt,
        },
        resolution: {
          action: args.accepted ? "accepted" : "declined",
          respondedAt: args.respondedAt,
        },
      }

      const { error: updateError } = await supabase
        .from("notifications")
        .update({
          is_read: true,
          metadata,
        })
        .eq("id", notification.id)
        .eq("recipient_profile_id", args.recipientProfileId)

      if (updateError) {
        console.error("Failed to update club invitation notification", {
          notificationId: notification.id,
          recipientProfileId: args.recipientProfileId,
          invitationId: args.invitationId,
          updateError,
        })
      }
    })
  )
}

async function notifyClubInvitee(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  args: {
    inviteeProfileId: string
    ownerProfileId: string
    clubId: string
    invitationId: string
  }
) {
  const [actorMeta, clubMeta] = await Promise.all([
    getActorNotificationMeta(supabase, args.ownerProfileId),
    getClubNotificationMeta(supabase, args.clubId),
  ])

  if (!clubMeta) throw new Error("Club not found")

  await createClubNotification(supabase, {
    recipient_profile_id: args.inviteeProfileId,
    actor_profile_id: args.ownerProfileId,
    event_type: "club_invited_to_club",
    metadata: {
      actor: actorMeta,
      club: clubMeta,
      invitation: {
        id: args.invitationId,
      },
    },
  })
}

async function notifyClubOwnerOfApplication(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  args: {
    ownerProfileId: string
    applicantProfileId: string
    clubId: string
    applicationId: string
    submittedAt: string
  }
) {
  const [actorMeta, clubMeta] = await Promise.all([
    getActorNotificationMeta(supabase, args.applicantProfileId),
    getClubNotificationMeta(supabase, args.clubId),
  ])

  if (!clubMeta) throw new Error("Club not found")

  await createClubNotification(supabase, {
    recipient_profile_id: args.ownerProfileId,
    actor_profile_id: args.applicantProfileId,
    event_type: "club_application_received",
    metadata: {
      actor: actorMeta,
      club: clubMeta,
      application: {
        id: args.applicationId,
        submittedAt: args.submittedAt,
      },
    },
  })
}

async function notifyClubOwnerOfInvitationResponse(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  args: {
    ownerProfileId: string
    inviteeProfileId: string
    clubId: string
    invitationId: string
    accepted: boolean
  }
) {
  const [actorMeta, clubMeta] = await Promise.all([
    getActorNotificationMeta(supabase, args.inviteeProfileId),
    getClubNotificationMeta(supabase, args.clubId),
  ])

  if (!clubMeta) throw new Error("Club not found")

  await createClubNotification(supabase, {
    recipient_profile_id: args.ownerProfileId,
    actor_profile_id: args.inviteeProfileId,
    event_type: args.accepted ? "club_invitation_accepted" : "club_invitation_declined",
    metadata: {
      actor: actorMeta,
      club: clubMeta,
      invitation: {
        id: args.invitationId,
      },
    },
  })
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

  const { data: existing } = await supabase
    .from("club_members")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", profile.id)
    .maybeSingle()

  if (existing) return

  const { data: applicationRows } = await supabase
    .from("club_applications")
    .select("id, status, created_at, reviewed_at")
    .eq("club_id", clubId)
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })

  const pendingApplication = pickPreferredClubStatusRow(
    (applicationRows ?? []) as Array<{ id: string; status: string | null; created_at: string | null; reviewed_at: string | null }>
  )

  if (pendingApplication?.status === "pending") {
    throw new Error("This reader already has a pending application")
  }

  const { data: invitationRows } = await supabase
    .from("club_invitations")
    .select("id, status, created_at, responded_at")
    .eq("club_id", clubId)
    .eq("invitee_user_id", profile.id)
    .order("created_at", { ascending: false })

  const existingInvitationRows = (invitationRows ?? []) as Array<{
    id: string
    status: string | null
    created_at: string | null
    responded_at: string | null
  }>
  const existingInvitation = pickPreferredClubStatusRow(existingInvitationRows)

  const now = new Date().toISOString()

  if (existingInvitation?.status === "pending") {
    return
  }

  const invitationMutation = existingInvitation?.id
    ? supabase
        .from("club_invitations")
        .update({
          inviter_user_id: ownerProfileId,
          status: "pending",
          responded_at: null,
          created_at: now,
        })
        .eq("id", existingInvitation.id)
    : supabase.from("club_invitations").insert({
        club_id: clubId,
        inviter_user_id: ownerProfileId,
        invitee_user_id: profile.id,
        status: "pending",
      })

  const { error } = await invitationMutation

  if (error) throw new Error("Failed to invite")

  const { data: pendingInvitations } = await supabase
    .from("club_invitations")
    .select("id")
    .eq("club_id", clubId)
    .eq("invitee_user_id", profile.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  const pendingInvitationId = (pendingInvitations?.[0]?.id as string | undefined) ?? undefined
  if (!pendingInvitationId) throw new Error("Failed to create invitation")

  await notifyClubInvitee(supabase, {
    inviteeProfileId: profile.id as string,
    ownerProfileId,
    clubId,
    invitationId: pendingInvitationId,
  })

  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
  revalidatePath("/notifications")
}

export async function kickMemberFromClub(clubId: string, memberProfileId: string) {
  const supabase = await createServerClient()
  await requireOwnerProfileId(supabase, clubId)

  const { data: club } = await supabase
    .from("clubs")
    .select("owner_user_id")
    .eq("id", clubId)
    .single()

  if (club?.owner_user_id === memberProfileId) throw new Error("Cannot remove owner")

  const { error } = await supabase
    .from("club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", memberProfileId)

  if (error) throw new Error("Failed to remove member")

  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
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
  await requireOwnerProfileId(supabase, clubId)

  const file = formData.get("file")
  if (!(file instanceof File)) throw new Error("Missing file")
  if (!file.type.startsWith("image/")) throw new Error("File must be an image")
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be <= 5MB")

  let resized
  try {
    resized = await resizeAvatarImage(file, 200)
  } catch (error) {
    console.error(error)
    throw new Error("Unsupported or invalid image")
  }

  const path = `clubs/${clubId}/${randomUUID()}.${resized.ext}`

  const { error: uploadError } = await supabase.storage
    .from("club-avatars")
    .upload(path, resized.buffer, { upsert: true, contentType: resized.contentType })

  if (uploadError) throw new Error("Failed to upload avatar")

  const { data: publicUrlData } = supabase.storage.from("club-avatars").getPublicUrl(path)
  const publicUrl = publicUrlData.publicUrl

  const { error: updateError } = await supabase
    .from("clubs")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", clubId)

  if (updateError) throw new Error("Failed to save avatar")

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
  const admin = createAdminClient()
  const profileId = await requireAuthedProfileId(supabase)

  const state = await getClubViewerState(supabase, clubId, profileId)
  const joinPolicy = normalizeJoinPolicy(state.club.join_policy as string | null)

  if (state.isOwner || state.isMember) return
  if (state.invitation?.status === "pending") {
    throw new Error("You already have a pending invitation")
  }
  if (joinPolicy === "open") throw new Error("This club is open to join directly")
  if (joinPolicy === "invite_only") throw new Error("This club is invite only")

  const now = new Date().toISOString()

  const mutation = state.application?.id
    ? admin
        .from("club_applications")
        .update({
          status: "pending",
          reviewed_at: null,
          reviewed_by_user_id: null,
        })
        .eq("id", state.application.id)
    : supabase.from("club_applications").insert({
        club_id: clubId,
        user_id: profileId,
        status: "pending",
        reviewed_at: null,
        reviewed_by_user_id: null,
      })

  const { error } = await mutation

  if (error) throw new Error("Failed to apply")

  const { data: pendingApplication } = await supabase
    .from("club_applications")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", profileId)
    .eq("status", "pending")
    .maybeSingle()

  const pendingApplicationId = pendingApplication?.id as string | undefined
  if (!pendingApplicationId) throw new Error("Failed to create application")

  if (state.club.owner_user_id !== profileId) {
    try {
      await notifyClubOwnerOfApplication(supabase, {
        ownerProfileId: state.club.owner_user_id as string,
        applicantProfileId: profileId,
        clubId,
        applicationId: pendingApplicationId,
        submittedAt: now,
      })
    } catch (notificationError) {
      console.error("Failed to notify club owner of application", {
        clubId,
        applicantProfileId: profileId,
        ownerProfileId: state.club.owner_user_id as string,
        applicationId: pendingApplicationId,
        notificationError,
      })
    }
  }

  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
  revalidatePath("/notifications")
}

export async function joinClub(clubId: string) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const state = await getClubViewerState(supabase, clubId, profileId)
  const joinPolicy = normalizeJoinPolicy(state.club.join_policy as string | null)

  if (state.isOwner || state.isMember) return
  if (joinPolicy !== "open") throw new Error("This club requires approval or an invitation")

  const { error } = await supabase.from("club_members").insert({
    club_id: clubId,
    user_id: profileId,
  })

  if (error) throw new Error("Failed to join club")

  await supabase.from("club_applications").delete().eq("club_id", clubId).eq("user_id", profileId)
  await supabase.from("club_invitations").delete().eq("club_id", clubId).eq("invitee_user_id", profileId)

  const { data: club } = await supabase
    .from("clubs")
    .select("id, name, avatar_url")
    .eq("id", clubId)
    .maybeSingle()

  await supabase.from("activity_events").insert({
    user_profile_id: profileId,
    event_type: "club_joined",
    metadata: {
      club: {
        id: clubId,
        name: club?.name ?? "a club",
        avatar_url: (club as any)?.avatar_url ?? null,
      },
    },
  })

  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
  revalidatePath("/notifications")
}

export async function acceptClubApplication(clubId: string, applicationId: string) {
  const supabase = await createServerClient()
  const reviewerProfileId = await requireOwnerProfileId(supabase, clubId)

  const { data: application, error: applicationError } = await supabase
    .from("club_applications")
    .select("id, user_id, status")
    .eq("id", applicationId)
    .eq("club_id", clubId)
    .single()

  if (applicationError || !application) throw new Error("Application not found")

  const now = new Date().toISOString()

  const { error: membershipError } = await supabase.from("club_members").insert({
    club_id: clubId,
    user_id: application.user_id,
  })

  if (membershipError) throw new Error("Failed to approve application")

  const { error } = await supabase
    .from("club_applications")
    .update({
      status: "accepted",
      reviewed_at: now,
      reviewed_by_user_id: reviewerProfileId,
    })
    .eq("id", applicationId)

  if (error) throw new Error("Failed to approve application")

  await supabase
    .from("club_invitations")
    .update({ status: "accepted", responded_at: now })
    .eq("club_id", clubId)
    .eq("invitee_user_id", application.user_id)
    .eq("status", "pending")

  const [actorMeta, clubMeta] = await Promise.all([
    getActorNotificationMeta(supabase, reviewerProfileId),
    getClubNotificationMeta(supabase, clubId),
  ])

  if (clubMeta) {
    await createClubNotification(supabase, {
      recipient_profile_id: application.user_id as string,
      actor_profile_id: reviewerProfileId,
      event_type: "club_application_approved",
      metadata: {
        actor: actorMeta,
        club: clubMeta,
        application: {
          id: applicationId,
        },
      },
    })
  }

  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
  revalidatePath("/notifications")
}

export async function declineClubApplication(clubId: string, applicationId: string) {
  const supabase = await createServerClient()
  const reviewerProfileId = await requireOwnerProfileId(supabase, clubId)

  const { data: application, error: applicationError } = await supabase
    .from("club_applications")
    .select("id, user_id")
    .eq("id", applicationId)
    .eq("club_id", clubId)
    .single()

  if (applicationError || !application) throw new Error("Application not found")

  const now = new Date().toISOString()
  const { error } = await supabase
    .from("club_applications")
    .update({
      status: "declined",
      reviewed_at: now,
      reviewed_by_user_id: reviewerProfileId,
    })
    .eq("id", applicationId)

  if (error) throw new Error("Failed to decline application")

  const [actorMeta, clubMeta] = await Promise.all([
    getActorNotificationMeta(supabase, reviewerProfileId),
    getClubNotificationMeta(supabase, clubId),
  ])

  if (clubMeta) {
    await createClubNotification(supabase, {
      recipient_profile_id: application.user_id as string,
      actor_profile_id: reviewerProfileId,
      event_type: "club_application_declined",
      metadata: {
        actor: actorMeta,
        club: clubMeta,
        application: {
          id: applicationId,
        },
      },
    })
  }

  revalidatePath(`/community/clubs/${clubId}`)
  revalidatePath(`/community/clubs/${clubId}/manage`)
  revalidatePath("/notifications")
}

export async function acceptClubInvitation(invitationId: string) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { data: invitation, error: invitationError } = await supabase
    .from("club_invitations")
    .select("id, club_id, inviter_user_id, invitee_user_id, status")
    .eq("id", invitationId)
    .single()

  if (invitationError || !invitation) throw new Error("Invitation not found")
  if (invitation.invitee_user_id !== profileId) throw new Error("Forbidden")
  if (invitation.status !== "pending") return

  const now = new Date().toISOString()

  const { error: membershipError } = await supabase.from("club_members").insert({
    club_id: invitation.club_id,
    user_id: profileId,
  })

  if (membershipError) throw new Error("Failed to accept invitation")

  const { error } = await supabase
    .from("club_invitations")
    .update({ status: "accepted", responded_at: now })
    .eq("id", invitationId)

  if (error) throw new Error("Failed to accept invitation")

  await resolveClubInvitationNotification(supabase, {
    recipientProfileId: profileId,
    invitationId,
    accepted: true,
    respondedAt: now,
  })

  await supabase.from("club_applications").delete().eq("club_id", invitation.club_id).eq("user_id", profileId)

  const clubMeta = await getClubNotificationMeta(supabase, invitation.club_id)
  await supabase.from("activity_events").insert({
    user_profile_id: profileId,
    event_type: "club_joined",
    metadata: {
      club: {
        id: invitation.club_id,
        name: clubMeta?.name ?? "a club",
        avatar_url: clubMeta?.avatarUrl ?? null,
      },
    },
  })

  await notifyClubOwnerOfInvitationResponse(supabase, {
    ownerProfileId: invitation.inviter_user_id as string,
    inviteeProfileId: profileId,
    clubId: invitation.club_id as string,
    invitationId,
    accepted: true,
  })

  revalidatePath(`/community/clubs/${invitation.club_id}`)
  revalidatePath(`/community/clubs/${invitation.club_id}/manage`)
  revalidatePath("/notifications")
}

export async function declineClubInvitation(invitationId: string) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { data: invitation, error: invitationError } = await supabase
    .from("club_invitations")
    .select("id, club_id, inviter_user_id, invitee_user_id, status")
    .eq("id", invitationId)
    .single()

  if (invitationError || !invitation) throw new Error("Invitation not found")
  if (invitation.invitee_user_id !== profileId) throw new Error("Forbidden")
  if (invitation.status !== "pending") return

  const respondedAt = new Date().toISOString()

  const { error } = await supabase
    .from("club_invitations")
    .update({ status: "declined", responded_at: respondedAt })
    .eq("id", invitationId)

  if (error) throw new Error("Failed to decline invitation")

  await resolveClubInvitationNotification(supabase, {
    recipientProfileId: profileId,
    invitationId,
    accepted: false,
    respondedAt,
  })

  await notifyClubOwnerOfInvitationResponse(supabase, {
    ownerProfileId: invitation.inviter_user_id as string,
    inviteeProfileId: profileId,
    clubId: invitation.club_id as string,
    invitationId,
    accepted: false,
  })

  revalidatePath(`/community/clubs/${invitation.club_id}`)
  revalidatePath(`/community/clubs/${invitation.club_id}/manage`)
  revalidatePath("/notifications")
}

export async function leaveClub(clubId: string) {
  const supabase = await createServerClient()
  const profileId = await requireAuthedProfileId(supabase)

  const { error } = await supabase
    .from("club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", profileId)

  if (error) throw new Error("Failed to leave club")

  revalidatePath(`/community/clubs/${clubId}`)
}
