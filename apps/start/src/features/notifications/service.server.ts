import { createRequestSupabaseClient, type RequestSupabaseClient } from "../../server/supabase.server"
import {
  sanitizeNotificationMetadata,
  type InvitationResponse,
  type NotificationCursor,
  type NotificationReadCommand,
} from "./validation"

const pageSize = 25

export interface NotificationRow {
  id: string
  eventType: string
  isRead: boolean
  createdAt: string
  metadata: ReturnType<typeof sanitizeNotificationMetadata>
}

type NotificationIdentity =
  | { status: "unauthorized" }
  | { status: "ok"; supabase: RequestSupabaseClient; profileId: string }

async function getNotificationIdentity(): Promise<NotificationIdentity> {
  const supabase = createRequestSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { status: "unauthorized" }

  const { data: profile, error: profileError } = await supabase.from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()
  if (profileError) throw new Error("Could not load notification identity")
  if (!profile?.id) return { status: "unauthorized" }
  return { status: "ok", supabase, profileId: profile.id as string }
}

export async function loadNotificationPage(cursor: NotificationCursor | null) {
  const identity = await getNotificationIdentity()
  if (identity.status !== "ok") return identity

  let query = identity.supabase.from("notifications")
    .select("id,event_type,is_read,created_at,metadata")
    .eq("recipient_profile_id", identity.profileId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize + 1)

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  if (error) throw new Error("Could not load notifications")
  const rows = data ?? []
  const visibleRows = rows.slice(0, pageSize)
  const last = visibleRows.at(-1)
  return {
    status: "ok" as const,
    results: visibleRows.map((row) => ({
      id: row.id as string,
      eventType: String(row.event_type),
      isRead: Boolean(row.is_read),
      createdAt: String(row.created_at),
      metadata: sanitizeNotificationMetadata(row.metadata),
    } satisfies NotificationRow)),
    nextCursor: rows.length > pageSize && last
      ? { createdAt: String(last.created_at), id: String(last.id) }
      : null,
  }
}

export async function loadUnreadCounts() {
  const identity = await getNotificationIdentity()
  if (identity.status !== "ok") return identity

  const [notifications, messages] = await Promise.all([
    identity.supabase.from("notifications").select("id", { count: "exact", head: true })
      .eq("recipient_profile_id", identity.profileId).eq("is_read", false),
    identity.supabase.from("messages").select("id", { count: "exact", head: true })
      .eq("recipient_profile_id", identity.profileId).eq("status", "sent")
      .eq("is_read", false).eq("recipient_deleted", false),
  ])
  if (notifications.error || messages.error) throw new Error("Could not load unread counts")
  const notificationCount = notifications.count ?? 0
  const messageCount = messages.count ?? 0
  return {
    status: "ok" as const,
    notifications: notificationCount,
    messages: messageCount,
    total: notificationCount + messageCount,
  }
}

export async function markNotificationsRead(command: NotificationReadCommand) {
  const identity = await getNotificationIdentity()
  if (identity.status !== "ok") return identity
  const { data, error } = await identity.supabase.rpc("mark_notifications_read", {
    target_notification_id: command.kind === "one" ? command.id : null,
    mark_all: command.kind === "all",
  })
  if (error) throw new Error("Could not update notifications")
  return { status: "ok" as const, updated: typeof data === "number" ? data : 0 }
}

export async function respondToClubInvitation(command: InvitationResponse) {
  const identity = await getNotificationIdentity()
  if (identity.status !== "ok") return identity
  const { data, error } = await identity.supabase.rpc("respond_to_club_invitation", {
    target_invitation_id: command.invitationId,
    accept_invitation: command.action === "accept",
  })
  if (error) return { status: "rejected" as const }
  return { status: "ok" as const, clubId: typeof data === "string" ? data : null }
}
