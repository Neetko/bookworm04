import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim()

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ results: [] })
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (!profile?.id) {
    return NextResponse.json({ results: [] })
  }

  const { data: followingRows } = await supabase
    .from("user_follows")
    .select("followed_profile_id")
    .eq("follower_profile_id", profile.id)

  const { data: followerRows } = await supabase
    .from("user_follows")
    .select("follower_profile_id")
    .eq("followed_profile_id", profile.id)

  const followingIds = new Set((followingRows ?? []).map((row: any) => row.followed_profile_id as string))
  const followerIds = new Set((followerRows ?? []).map((row: any) => row.follower_profile_id as string))
  const friendIds = Array.from(followingIds).filter((id) => followerIds.has(id))

  const results: Array<{ id: string; username: string | null; avatar_url: string | null; isFriend: boolean }> = []

  const addProfiles = (profiles: Array<{ id: string; username: string | null; avatar_url: string | null }>, isFriend: boolean) => {
    profiles.forEach((profileRow) => {
      if (results.length >= 3) return
      results.push({ ...profileRow, isFriend })
    })
  }

  const friendsQuery = supabase
    .from("user_profiles")
    .select("id, username, avatar_url")
    .in("id", friendIds.length > 0 ? friendIds : ["00000000-0000-0000-0000-000000000000"])
    .neq("id", profile.id)

  const friendsFiltered = q ? friendsQuery.ilike("username", `%${q}%`) : friendsQuery
  const { data: friendProfiles } = await friendsFiltered.limit(3)

  addProfiles((friendProfiles ?? []) as Array<{ id: string; username: string | null; avatar_url: string | null }>, true)

  if (results.length < 3) {
    const excludedIds = [profile.id, ...results.map((item) => item.id)]
    const otherQuery = supabase
      .from("user_profiles")
      .select("id, username, avatar_url")
      .not("id", "in", `(${excludedIds.join(",")})`)

    const othersFiltered = q ? otherQuery.ilike("username", `%${q}%`) : otherQuery
    const { data: otherProfiles } = await othersFiltered.order("created_at", { ascending: false }).limit(3 - results.length)

    addProfiles((otherProfiles ?? []) as Array<{ id: string; username: string | null; avatar_url: string | null }>, false)
  }

  return NextResponse.json({ results })
}
