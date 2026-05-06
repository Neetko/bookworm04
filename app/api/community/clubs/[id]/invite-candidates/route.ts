import { NextResponse } from "next/server"

import { createServerClient } from "@/lib/supabase-server"

type InviteRelationship = "friend" | "following" | "follows_you"

const RELATIONSHIP_PRIORITY: Record<InviteRelationship, number> = {
  friend: 0,
  following: 1,
  follows_you: 2,
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clubId } = await params
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

  const candidateIds = Array.from(relationshipById.keys())
  if (candidateIds.length === 0) {
    return NextResponse.json({ results: [] })
  }

  const baseQuery = supabase
    .from("public_profiles")
    .select("id, username, avatar_url")
    .in("id", candidateIds)

  const filteredQuery = q ? baseQuery.ilike("username", `%${q}%`) : baseQuery
  const { data: profiles } = await filteredQuery.limit(12)

  const results = ((profiles ?? []) as Array<{ id: string; username: string | null; avatar_url: string | null }>)
    .map((profileRow) => ({
      ...profileRow,
      relationship: relationshipById.get(profileRow.id) ?? "following",
    }))
    .sort((a, b) => {
      const relationshipDelta = RELATIONSHIP_PRIORITY[a.relationship] - RELATIONSHIP_PRIORITY[b.relationship]
      if (relationshipDelta !== 0) return relationshipDelta
      return (a.username ?? "").localeCompare(b.username ?? "", undefined, { sensitivity: "base" })
    })
    .slice(0, 8)

  return NextResponse.json({ results })
}