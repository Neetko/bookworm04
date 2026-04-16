import { NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase-server"

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

export async function GET() {
  const { supabase, profileId } = await getProfileId()

  if (!profileId) {
    return NextResponse.json({ results: [] })
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id,event_type,is_read,created_at,metadata,title_id,post_id,review_id")
    .eq("recipient_profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("Failed to load notifications", error)
    return NextResponse.json({ results: [] }, { status: 500 })
  }

  return NextResponse.json({ results: data ?? [] })
}

export async function PATCH(request: Request) {
  const { supabase, profileId } = await getProfileId()
  const admin = createAdminClient()

  if (!profileId) {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  const body = await request.json().catch(() => ({} as any))
  const notificationId = typeof body?.id === "string" ? body.id : null

  if (notificationId) {
    const { error } = await admin
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("recipient_profile_id", profileId)

    if (error) {
      console.error("Failed to mark notification read", error)
      return NextResponse.json({ success: false }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  const { error } = await admin
    .from("notifications")
    .update({ is_read: true })
    .eq("recipient_profile_id", profileId)
    .eq("is_read", false)

  if (error) {
    console.error("Failed to mark notifications read", error)
    return NextResponse.json({ success: false }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
