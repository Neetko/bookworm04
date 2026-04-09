import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ notifications: 0, messages: 0, total: 0 })
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (!profile?.id) {
    return NextResponse.json({ notifications: 0, messages: 0, total: 0 })
  }

  const { count: notifications } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_profile_id", profile.id)
    .eq("is_read", false)

  const { count: messages } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_profile_id", profile.id)
    .eq("status", "sent")
    .eq("is_read", false)
    .eq("recipient_deleted", false)

  const safeNotifications = notifications ?? 0
  const safeMessages = messages ?? 0

  return NextResponse.json({
    notifications: safeNotifications,
    messages: safeMessages,
    total: safeNotifications + safeMessages,
  })
}
