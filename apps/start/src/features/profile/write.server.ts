import { readBoundedJson } from "../../server/bounded-json.server"
import { createAdminSupabaseClient } from "../../server/supabase-admin.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"
import { normalizeUsername, sanitizeUsername, usernameError } from "../onboarding/validation"
import { parseProfileUpdate } from "./validation"

const maxRequestBytes = 8_192

function json(body: unknown, status: number) {
  return Response.json(body, { status })
}

function escapeLikeLiteral(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

export async function handleProfileUpdate(request: Request): Promise<Response> {
  const body = await readBoundedJson(request, maxRequestBytes)
  if (!body.ok) return json({ error: body.error }, body.status)
  const parsed = parseProfileUpdate(body.value)
  if (!parsed) return json({ error: "Invalid profile update" }, 400)

  const username = sanitizeUsername(parsed.username)
  const validationError = usernameError(username)
  if (validationError) return json({ error: validationError }, 400)

  const supabase = createRequestSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return json({ error: "Unauthorized" }, 401)
  const { data: profile, error: profileError } = await supabase.from("user_profiles")
    .select("id,auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle()
  if (profileError) return json({ error: "Could not load profile" }, 500)
  if (!profile?.id) return json({ error: "Profile not found" }, 404)

  const admin = createAdminSupabaseClient()
  if (!admin) return json({ error: "Profile service is not configured" }, 503)
  const { data: matches, error: collisionError } = await admin.from("user_profiles")
    .select("auth_user_id,username")
    .ilike("username", escapeLikeLiteral(username))
    .limit(5)
  if (collisionError) return json({ error: "Could not check username" }, 500)
  const wanted = normalizeUsername(username)
  if ((matches ?? []).some((row) => row.auth_user_id !== user.id && normalizeUsername(row.username) === wanted)) {
    return json({ error: "That username is already taken" }, 409)
  }

  const { data: updated, error: updateError } = await admin.from("user_profiles")
    .update({ username, bio: parsed.bio, updated_at: new Date().toISOString() })
    .eq("id", profile.id)
    .eq("auth_user_id", user.id)
    .select("id")
    .maybeSingle()
  if (updateError?.code === "23505") return json({ error: "That username is already taken" }, 409)
  if (updateError || !updated) return json({ error: "Could not update profile" }, 409)
  return json({ success: true }, 200)
}
