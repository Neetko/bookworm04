import { z } from "zod"
import { safePublicImageUrl } from "../../server/images.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"

const uuid = z.string().uuid()
const json = (body: unknown, status = 200) => Response.json(body, { status })
type Relationship = "friend" | "following" | "follows_you" | "other"
const priority: Record<Relationship, number> = { friend: 0, following: 1, follows_you: 2, other: 3 }

export async function handleInviteCandidates(request: Request, clubId: string) {
  if (!uuid.safeParse(clubId).success) return json({ results: [] }, 404)
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100)
  if (!query) return json({ results: [] })
  const supabase = createRequestSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ results: [] }, 401)
  const { data: profile } = await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle()
  if (!profile?.id) return json({ results: [] }, 401)
  const { data: club } = await supabase.from("clubs").select("owner_user_id").eq("id", clubId).maybeSingle()
  if (!club || club.owner_user_id !== profile.id) return json({ results: [] }, 403)
  const [followingResult, followerResult, memberResult, inviteResult, applicationResult] = await Promise.all([
    supabase.from("user_follows").select("followed_profile_id").eq("follower_profile_id", profile.id),
    supabase.from("user_follows").select("follower_profile_id").eq("followed_profile_id", profile.id),
    supabase.from("club_members").select("user_id").eq("club_id", clubId),
    supabase.from("club_invitations").select("invitee_user_id").eq("club_id", clubId).eq("status", "pending"),
    supabase.from("club_applications").select("user_id").eq("club_id", clubId).eq("status", "pending"),
  ])
  const following = new Set((followingResult.data ?? []).map((row) => row.followed_profile_id))
  const followers = new Set((followerResult.data ?? []).map((row) => row.follower_profile_id))
  const excluded = new Set([profile.id, ...(memberResult.data ?? []).map((row) => row.user_id), ...(inviteResult.data ?? []).map((row) => row.invitee_user_id), ...(applicationResult.data ?? []).map((row) => row.user_id)])
  const { data } = await supabase.from("public_profiles").select("id,username,avatar_url").ilike("username", `%${query.replace(/[\\%_]/g, "\\$&")}%`).limit(40)
  const relationship = (id: string): Relationship => following.has(id) ? followers.has(id) ? "friend" : "following" : followers.has(id) ? "follows_you" : "other"
  const results = (data ?? []).filter((row) => row.username && !excluded.has(row.id)).map((row) => ({ id: row.id, username: row.username, avatar_url: safePublicImageUrl(row.avatar_url), relationship: relationship(row.id) })).sort((a, b) => priority[a.relationship] - priority[b.relationship] || a.username!.localeCompare(b.username!)).slice(0, 12)
  return json({ results })
}
