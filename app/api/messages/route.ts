import { NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase-server"
import { sanitizeMessageBody } from "@/lib/message-content"
import { parseMessageWrite, readMessageJson } from "@/lib/message-write"

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
    .eq("recipient_deleted", false)

  const { count: sent } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_profile_id", profileId)
    .eq("status", "sent")
    .eq("sender_deleted", false)

  const { count: drafts } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_profile_id", profileId)
    .eq("status", "draft")
    .eq("sender_deleted", false)

  return {
    inbox: inbox ?? 0,
    sent: sent ?? 0,
    drafts: drafts ?? 0,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const folder = (searchParams.get("folder") ?? "inbox").toLowerCase()
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
  const pageSize = Math.min(50, Math.max(5, Number(searchParams.get("pageSize") ?? "20")))

  const { supabase, profileId } = await getProfileId()

  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let query = supabase.from("messages").select("*")

  if (folder === "sent") {
    query = query.eq("sender_profile_id", profileId).eq("status", "sent").eq("sender_deleted", false)
  } else if (folder === "drafts") {
    query = query.eq("sender_profile_id", profileId).eq("status", "draft").eq("sender_deleted", false)
  } else {
    query = query.eq("recipient_profile_id", profileId).eq("status", "sent").eq("recipient_deleted", false)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data: rows, error } = await query.order("created_at", { ascending: false }).range(from, to)

  if (error) {
    console.error("Failed to load messages", error)
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 })
  }

  const profileIds = Array.from(
    new Set(
      (rows ?? [])
        .flatMap((row) => [row.sender_profile_id, row.recipient_profile_id])
        .filter(Boolean)
    )
  ) as string[]

  const { data: profiles } = await supabase
    .from("public_profiles")
    .select("id, username, avatar_url")
    .in("id", profileIds.length > 0 ? profileIds : ["00000000-0000-0000-0000-000000000000"])

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id as string, profile])
  )

  const results = (rows ?? []).map((row: any) => {
    const sender = profileMap.get(row.sender_profile_id) as any
    const recipient = row.recipient_profile_id ? (profileMap.get(row.recipient_profile_id) as any) : null
    const senderName = sender?.username ?? "Unknown"
    const recipientName = recipient?.username ?? row.recipient_username ?? "Unknown"

    return {
      id: row.id as string,
      subject: row.subject as string,
      body: sanitizeMessageBody(row.body as string),
      date: row.created_at as string,
      read: Boolean(row.is_read),
      type: row.status === "draft" ? "draft" : folder === "sent" ? "sent" : "inbox",
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
      replyTo: row.reply_to as string | null,
    }
  })

  const counts = await buildCounts(supabase, profileId)

  return NextResponse.json({ results, counts })
}

export async function POST(request: Request) {
  const json = await readMessageJson(request)
  if (!json.ok) return NextResponse.json({ error: json.error }, { status: json.status })

  const message = parseMessageWrite(json.value)
  if (!message) return NextResponse.json({ error: "Invalid message" }, { status: 400 })

  const { title, recipient, body, status, replyTo } = message

  const { supabase, profileId } = await getProfileId()

  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

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

  if (replyTo) {
    const { data: original, error: originalError } = await supabase
      .from("messages")
      .select("sender_profile_id, recipient_profile_id")
      .eq("id", replyTo)
      .eq("status", "sent")
      .maybeSingle()

    const participants = [original?.sender_profile_id, original?.recipient_profile_id]
    if (originalError || !original || !participants.includes(profileId) || !recipientProfileId || !participants.includes(recipientProfileId)) {
      return NextResponse.json({ error: "Invalid reply target" }, { status: 400 })
    }
  }

  const { data: allowed, error: quotaError } = await admin.rpc("consume_message_write_quota", {
    p_profile_id: profileId,
    p_status: status,
  })

  if (quotaError) {
    console.error("Failed to check message quota", quotaError)
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 })
  }
  if (allowed !== true) return NextResponse.json({ error: "Message rate limit reached" }, { status: 429 })

  const { data, error } = await admin
    .from("messages")
    .insert({
      sender_profile_id: profileId,
      recipient_profile_id: recipientProfileId,
      recipient_username: recipientProfileId ? null : recipientUsername,
      subject: title,
      body,
      status,
      is_read: status !== "sent",
      sender_deleted: false,
      recipient_deleted: false,
      reply_to: replyTo,
      updated_at: new Date().toISOString(),
    })
    .select("id, created_at")
    .single()

  if (error) {
    console.error("Failed to create message", error)
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 })
  }

  return NextResponse.json({ id: data?.id, createdAt: data?.created_at })
}
