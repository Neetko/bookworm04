import { NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase-server"
import { sanitizeMessageBody } from "@/lib/message-content"

const getProfileId = async () => {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { supabase, profileId: null }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  return { supabase, profileId: (profile?.id as string | null) ?? null }
}

const buildCounts = async (supabase: Awaited<ReturnType<typeof createServerClient>>, profileId: string) => {
  const { count: inbox } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_profile_id", profileId)
    .eq("status", "sent")
    .eq("is_read", false)

  const { count: sent } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_profile_id", profileId)
    .eq("status", "sent")

  const { count: drafts } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_profile_id", profileId)
    .eq("status", "draft")

  return {
    inbox: inbox ?? 0,
    sent: sent ?? 0,
    drafts: drafts ?? 0,
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, profileId } = await getProfileId()

  if (!profileId) {
    return NextResponse.json({ message: null }, { status: 401 })
  }

  const { data: message, error } = await supabase
    .from("messages")
    .select("*")
    .eq("id", id)
    .or(`sender_profile_id.eq.${profileId},recipient_profile_id.eq.${profileId}`)
    .maybeSingle()

  if (error || !message) {
    return NextResponse.json({ message: null }, { status: 404 })
  }

  const isSender = message.sender_profile_id === profileId
  const isRecipient = message.recipient_profile_id === profileId

  if ((isSender && message.sender_deleted) || (isRecipient && message.recipient_deleted)) {
    return NextResponse.json({ message: null }, { status: 404 })
  }

  const profileIds = [message.sender_profile_id, message.recipient_profile_id].filter(Boolean) as string[]

  const { data: profiles } = await supabase
    .from("public_profiles")
    .select("id, username, avatar_url")
    .in("id", profileIds.length > 0 ? profileIds : ["00000000-0000-0000-0000-000000000000"])

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]))

  const sender = profileMap.get(message.sender_profile_id) as any
  const recipient = message.recipient_profile_id ? (profileMap.get(message.recipient_profile_id) as any) : null

  const senderName = sender?.username ?? "Unknown"
  const recipientName = recipient?.username ?? message.recipient_username ?? "Unknown"

  const normalized = {
    id: message.id as string,
    subject: message.subject as string,
    body: sanitizeMessageBody(message.body as string),
    date: message.created_at as string,
    read: Boolean(message.is_read),
    type: message.status === "draft" ? "draft" : message.recipient_profile_id === profileId ? "inbox" : "sent",
    from: {
      name: senderName,
      email: senderName,
      avatarUrl: sender?.avatar_url ?? null,
    },
    to: {
      name: recipientName,
      email: recipientName,
      avatarUrl: recipient?.avatar_url ?? null,
    },
    replyTo: message.reply_to as string | null,
  }

  const counts = await buildCounts(supabase, profileId)

  return NextResponse.json({ message: normalized, counts })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, profileId } = await getProfileId()
  const admin = createAdminClient()

  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = await request.json()
  const hasContentUpdate =
    typeof payload?.title === "string" ||
    typeof payload?.body === "string" ||
    typeof payload?.recipient === "string" ||
    typeof payload?.status === "string"

  const isReadOnlyUpdate = !hasContentUpdate && typeof payload?.isRead !== "undefined"

  const { data: message } = await supabase
    .from("messages")
    .select("sender_profile_id, recipient_profile_id, status")
    .eq("id", id)
    .maybeSingle()

  if (!message) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (isReadOnlyUpdate) {
    if (message.recipient_profile_id !== profileId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { error } = await admin
      .from("messages")
      .update({ is_read: Boolean(payload?.isRead), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("recipient_profile_id", profileId)

    if (error) {
      return NextResponse.json({ error: "Failed to update message" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  if (message.sender_profile_id !== profileId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (message.status !== "draft") {
    return NextResponse.json({ error: "Only drafts can be edited" }, { status: 403 })
  }

  const title = (payload?.title ?? "").trim()
  const body = typeof payload?.body === "string" ? sanitizeMessageBody(payload.body.trim()) : ""
  const recipient = (payload?.recipient ?? "").trim()
  const status = (payload?.status ?? "sent").toLowerCase()

  if (!title || !body) {
    return NextResponse.json({ error: "Title and body are required" }, { status: 400 })
  }

  if (status !== "sent" && status !== "draft") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  let recipientProfileId: string | null = null
  let recipientUsername: string | null = null

  if (recipient) {
    const { data: recipientProfile } = await supabase
      .from("public_profiles")
      .select("id, username")
      .eq("username", recipient)
      .maybeSingle()

    if (recipientProfile?.id) {
      recipientProfileId = recipientProfile.id as string
    } else if (status === "sent") {
      return NextResponse.json({ error: "Recipient not found" }, { status: 400 })
    } else {
      recipientUsername = recipient
    }
  } else if (status === "sent") {
    return NextResponse.json({ error: "Recipient required" }, { status: 400 })
  }

  const { error } = await admin
    .from("messages")
    .update({
      subject: title,
      body,
      status,
      recipient_profile_id: recipientProfileId,
      recipient_username: recipientProfileId ? null : recipientUsername,
      is_read: status !== "sent" ? true : false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("sender_profile_id", profileId)
    .eq("status", "draft")

  if (error) {
    return NextResponse.json({ error: "Failed to update message" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, profileId } = await getProfileId()
  const admin = createAdminClient()

  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: message } = await supabase
    .from("messages")
    .select("id, status, sender_profile_id, recipient_profile_id, sender_deleted, recipient_deleted")
    .eq("id", id)
    .maybeSingle()

  if (!message) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const isSender = message.sender_profile_id === profileId
  const isRecipient = message.recipient_profile_id === profileId

  if (!isSender && !isRecipient) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (message.status === "draft") {
    if (!isSender) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const { error } = await admin
      .from("messages")
      .delete()
      .eq("id", id)
      .eq("sender_profile_id", profileId)
    if (error) {
      return NextResponse.json({ error: "Failed to delete draft" }, { status: 500 })
    }
    return NextResponse.json({ deleted: true })
  }

  const senderDeleted = message.sender_deleted || false
  const recipientDeleted = message.recipient_deleted || false

  const nextSenderDeleted = isSender ? true : senderDeleted
  const nextRecipientDeleted = isRecipient ? true : recipientDeleted

  if (nextSenderDeleted && nextRecipientDeleted) {
    const { error } = await admin.from("messages").delete().eq("id", id)
    if (error) {
      return NextResponse.json({ error: "Failed to delete message" }, { status: 500 })
    }
    return NextResponse.json({ deleted: true })
  }

  const { error } = await admin
    .from("messages")
    .update({
      sender_deleted: nextSenderDeleted,
      recipient_deleted: nextRecipientDeleted,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
