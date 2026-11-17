import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"
import { parseNotificationCursor, parseNotificationReadCommand } from "@/lib/notifications"

const PAGE_SIZE = 25

const getProfileId = async () => {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { supabase, profileId: null, profileError: null }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  return {
    supabase,
    profileId: (profile?.id as string | null) ?? null,
    profileError,
  }
}

export async function GET(request: Request) {
  const { supabase, profileId, profileError } = await getProfileId()

  if (profileError) {
    console.error("Failed to load profile for notifications", profileError)
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 })
  }

  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = new URL(request.url).searchParams
  const parsedCursor = parseNotificationCursor(
    searchParams.get("before"),
    searchParams.get("beforeId")
  )
  if (!parsedCursor) {
    return NextResponse.json({ error: "Invalid notification cursor" }, { status: 400 })
  }

  let query = supabase
    .from("notifications")
    .select("id,event_type,is_read,created_at,metadata,title_id,post_id,review_id")
    .eq("recipient_profile_id", profileId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1)

  if (parsedCursor.cursor) {
    const { createdAt, id } = parsedCursor.cursor
    query = query.or(
      `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`
    )
  }

  const { data, error } = await query

  if (error) {
    console.error("Failed to load notifications", error)
    return NextResponse.json({ results: [] }, { status: 500 })
  }

  const rows = data ?? []
  const hasMore = rows.length > PAGE_SIZE

  const results = rows.slice(0, PAGE_SIZE)
  const lastResult = results.at(-1)

  return NextResponse.json({
    results,
    nextCursor:
      hasMore && lastResult
        ? { createdAt: lastResult.created_at, id: lastResult.id }
        : null,
  })
}

export async function PATCH(request: Request) {
  const { supabase, profileId, profileError } = await getProfileId()

  if (profileError) {
    console.error("Failed to load profile for notification update", profileError)
    return NextResponse.json({ success: false }, { status: 500 })
  }

  if (!profileId) {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  const body: unknown = await request.json().catch(() => null)
  const command = parseNotificationReadCommand(body)

  if (!command) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 })
  }

  const { error } = await supabase.rpc("mark_notifications_read", {
    target_notification_id: command.kind === "one" ? command.id : null,
    mark_all: command.kind === "all",
  })

  if (error) {
    console.error("Failed to mark notification read state", error)
    return NextResponse.json({ success: false }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
