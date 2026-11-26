import { z } from "zod"
import { readBoundedJson } from "../../server/bounded-json.server"
import { createAdminSupabaseClient } from "../../server/supabase-admin.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"

const inputSchema = z.object({ action: z.enum(["follow", "unfollow"]) }).strict()
const uuid = z.string().uuid()
const json = (body: unknown, status: number) => Response.json(body, { status })

export async function handleFollow(request: Request, targetId: string) {
  if (!uuid.safeParse(targetId).success) return json({ error: "User not found" }, 404)
  const body = await readBoundedJson(request, 2_000)
  if (!body.ok) return json({ error: body.error }, body.status)
  const parsed = inputSchema.safeParse(body.value)
  if (!parsed.success) return json({ error: "Invalid follow action" }, 400)
  const supabase = createRequestSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: "Unauthorized" }, 401)
  const [{ data: profile }, { data: target }] = await Promise.all([
    supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle(),
    supabase.from("public_profiles").select("id").eq("id", targetId).maybeSingle(),
  ])
  if (!profile?.id) return json({ error: "Unauthorized" }, 401)
  if (!target) return json({ error: "User not found" }, 404)
  if (profile.id === targetId) return json({ error: "Cannot follow yourself" }, 400)
  const admin = createAdminSupabaseClient()
  if (!admin) return json({ error: "Follow service is not configured" }, 503)

  if (parsed.data.action === "unfollow") {
    const { error } = await admin.from("user_follows").delete().eq("follower_profile_id", profile.id).eq("followed_profile_id", targetId)
    if (error) return json({ error: "Could not unfollow user" }, 500)
    await admin.from("user_follows").update({ is_friend: false }).eq("follower_profile_id", targetId).eq("followed_profile_id", profile.id)
    return json({ isFollowing: false, isFriend: false }, 200)
  }

  const { data: transition, error } = await admin.rpc("insert_follow_with_quota", { p_follower_profile_id: profile.id, p_followed_profile_id: targetId })
  if (error) return json({ error: error.message.includes("follow_quota_exceeded") ? "Too many follows. Try again later" : "Could not follow user" }, error.message.includes("follow_quota_exceeded") ? 429 : 500)
  const value = transition && typeof transition === "object" && !Array.isArray(transition) ? transition as Record<string, unknown> : null
  if (!value || typeof value.inserted !== "boolean" || typeof value.notify !== "boolean") return json({ error: "Could not follow user" }, 500)
  if (value.notify) {
    const { data: actor } = await supabase.from("public_profiles").select("id,username,avatar_url").eq("id", profile.id).maybeSingle()
    await admin.from("notifications").insert({ recipient_profile_id: targetId, actor_profile_id: profile.id, event_type: "followed", metadata: { actor: actor ? { id: actor.id, username: actor.username, avatarUrl: actor.avatar_url } : null } })
  }
  const { data: reciprocal } = await supabase.from("user_follows").select("id").eq("follower_profile_id", targetId).eq("followed_profile_id", profile.id).maybeSingle()
  if (!reciprocal) return json({ isFollowing: true, isFriend: false }, 200)
  const { error: friendError } = await admin.from("user_follows").update({ is_friend: true }).or(`and(follower_profile_id.eq.${profile.id},followed_profile_id.eq.${targetId}),and(follower_profile_id.eq.${targetId},followed_profile_id.eq.${profile.id})`)
  if (friendError) return json({ error: "Could not update friendship" }, 500)
  return json({ isFollowing: true, isFriend: true }, 200)
}
