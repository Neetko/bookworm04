import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (profileError) {
    console.error("Failed to load profile for unread counts", profileError)
    return NextResponse.json({ error: "Failed to load unread counts" }, { status: 500 })
  }

  if (!profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [notificationResult, messageResult] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_profile_id", profile.id)
      .eq("is_read", false),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_profile_id", profile.id)
      .eq("status", "sent")
      .eq("is_read", false)
      .eq("recipient_deleted", false),
  ])

  if (notificationResult.error || messageResult.error) {
    console.error("Failed to load unread counts", {
      notificationError: notificationResult.error,
      messageError: messageResult.error,
    })
    return NextResponse.json({ error: "Failed to load unread counts" }, { status: 500 })
  }

  const safeNotifications = notificationResult.count ?? 0
  const safeMessages = messageResult.count ?? 0

  return NextResponse.json({
    notifications: safeNotifications,
    messages: safeMessages,
    total: safeNotifications + safeMessages,
  })
}
