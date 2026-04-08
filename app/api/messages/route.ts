import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"

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
    return NextResponse.json({ results: [], counts: { inbox: 0, sent: 0, drafts: 0 } })
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
    return NextResponse.json({ results: [], counts: { inbox: 0, sent: 0, drafts: 0 } })
  }

  const profileIds = Array.from(
    new Set(
      (rows ?? [])
        .flatMap((row) => [row.sender_profile_id, row.recipient_profile_id])
        .filter(Boolean)
    )
  ) as string[]

  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, username, avatar_url, email")
    .in("id", profileIds.length > 0 ? profileIds : ["00000000-0000-0000-0000-000000000000"])

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id as string, profile])
  )

  const results = (rows ?? []).map((row: any) => {
    const sender = profileMap.get(row.sender_profile_id) as any
    const recipient = row.recipient_profile_id ? (profileMap.get(row.recipient_profile_id) as any) : null
    const senderName = sender?.username ?? sender?.email ?? "Unknown"
    const recipientName = recipient?.username ?? recipient?.email ?? row.recipient_username ?? "Unknown"

    return {
      id: row.id as string,
      subject: row.subject as string,
      body: row.body as string,
      date: row.created_at as string,
      read: Boolean(row.is_read),
      type: row.status === "draft" ? "draft" : folder === "sent" ? "sent" : "inbox",
      from: {
        name: senderName,
        email: sender?.email ?? senderName,
        avatarUrl: sender?.avatar_url ?? null,
      },
      to: {
        name: recipientName,
        email: recipient?.email ?? recipientName,
        avatarUrl: recipient?.avatar_url ?? null,
      },
      replyTo: row.reply_to as string | null,
    }
  })

  const counts = await buildCounts(supabase, profileId)

  return NextResponse.json({ results, counts })
}

export async function POST(request: Request) {
  const payload = await request.json()
  const title = (payload?.title ?? "").trim()
  const recipient = (payload?.recipient ?? "").trim()
  const body = (payload?.body ?? "").trim()
  const status = (payload?.status ?? "sent").toLowerCase()
  const replyTo = payload?.replyTo ?? null

  if (!title || !body) {
    return NextResponse.json({ error: "Title and body are required" }, { status: 400 })
  }

  if (status !== "sent" && status !== "draft") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const { supabase, profileId } = await getProfileId()

  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let recipientProfileId: string | null = null
  let recipientUsername: string | null = null

  if (recipient) {
    const { data: recipientProfile } = await supabase
      .from("user_profiles")
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

  const { data, error } = await supabase
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
