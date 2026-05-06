import { NextResponse } from "next/server"

import { createServerClient } from "@/lib/supabase-server"

type InviteRelationship = "friend" | "following" | "follows_you" | "other"

const RELATIONSHIP_PRIORITY: Record<InviteRelationship, number> = {
  friend: 0,
  following: 1,
  follows_you: 2,
  other: 3,
}

function getMatchPriority(username: string | null, query: string) {
  const normalizedUsername = (username ?? "").toLocaleLowerCase()
  const normalizedQuery = query.toLocaleLowerCase()

  if (!normalizedQuery) return 3
  if (normalizedUsername === normalizedQuery) return 0
  if (normalizedUsername.startsWith(normalizedQuery)) return 1
  return 2
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clubId } = await params
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim()

  if (!q) {
    return NextResponse.json({ results: [] })
  }

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

  const { data: club } = await supabase
    .from("clubs")
    .select("owner_user_id")
    .eq("id", clubId)
    .maybeSingle()

  if (!club || club.owner_user_id !== profile.id) {
    return NextResponse.json({ results: [] }, { status: 403 })
  }

  const [{ data: followingRows }, { data: followerRows }, { data: memberRows }, { data: inviteRows }, { data: applicationRows }] =
    await Promise.all([
      supabase
        .from("user_follows")
        .select("followed_profile_id")
        .eq("follower_profile_id", profile.id),
      supabase
        .from("user_follows")
        .select("follower_profile_id")
        .eq("followed_profile_id", profile.id),
      supabase
        .from("club_members")
        .select("user_id")
        .eq("club_id", clubId),
      supabase
        .from("club_invitations")
        .select("invitee_user_id")
        .eq("club_id", clubId)
        .eq("status", "pending"),
      supabase
        .from("club_applications")
        .select("user_id")
        .eq("club_id", clubId)
        .eq("status", "pending"),
    ])

  const followingIds = new Set((followingRows ?? []).map((row: any) => row.followed_profile_id as string))
  const followerIds = new Set((followerRows ?? []).map((row: any) => row.follower_profile_id as string))

  const excludedIds = new Set<string>([
    profile.id as string,
    ...((memberRows ?? []).map((row: any) => row.user_id).filter(Boolean) as string[]),
    ...((inviteRows ?? []).map((row: any) => row.invitee_user_id).filter(Boolean) as string[]),
    ...((applicationRows ?? []).map((row: any) => row.user_id).filter(Boolean) as string[]),
  ])

  const relationshipById = new Map<string, InviteRelationship>()

  for (const followedId of followingIds) {
    if (excludedIds.has(followedId)) continue
    relationshipById.set(followedId, followerIds.has(followedId) ? "friend" : "following")
  }

  for (const followerId of followerIds) {
    if (excludedIds.has(followerId) || relationshipById.has(followerId)) continue
    relationshipById.set(followerId, "follows_you")
  }

  const { data: profiles } = await supabase
    .from("public_profiles")
    .select("id, username, avatar_url")
    .ilike("username", `%${q}%`)
    .limit(40)

  const results = ((profiles ?? []) as Array<{ id: string; username: string | null; avatar_url: string | null }>)
    .filter((profileRow) => {
      if (!profileRow.id || excludedIds.has(profileRow.id)) return false
      if (!(profileRow.username ?? "").trim()) return false
      return true
    })
    .map((profileRow) => ({
      ...profileRow,
      relationship: relationshipById.get(profileRow.id) ?? "other",
    }))
    .sort((a, b) => {
      const relationshipDelta = RELATIONSHIP_PRIORITY[a.relationship] - RELATIONSHIP_PRIORITY[b.relationship]
      if (relationshipDelta !== 0) return relationshipDelta

      const matchDelta = getMatchPriority(a.username, q) - getMatchPriority(b.username, q)
      if (matchDelta !== 0) return matchDelta

      return (a.username ?? "").localeCompare(b.username ?? "", undefined, { sensitivity: "base" })
    })
    .slice(0, 12)

  return NextResponse.json({ results })
}