import { z } from "zod"
import { readBoundedJson } from "../../server/bounded-json.server"
import { GENRES } from "../titles/catalog"
import { getOnboardingIdentity } from "./profile.server"
import { normalizeUsername, sanitizeUsername, usernameError } from "./validation"

const maxRequestBytes = 16_000
const genreValues = [...GENRES] as [typeof GENRES[number], ...Array<typeof GENRES[number]>]
const inputSchema = z.object({
  username: z.string().max(100),
  favoriteGenres: z.array(z.enum(genreValues)).min(1).max(GENRES.length),
}).strict()

function json(body: unknown, status: number) {
  return Response.json(body, { status })
}

function escapeLikeLiteral(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

export async function handleOnboardingComplete(request: Request): Promise<Response> {
  const body = await readBoundedJson(request, maxRequestBytes)
  if (!body.ok) return json({ error: body.error }, body.status)
  const parsed = inputSchema.safeParse(body.value)
  if (!parsed.success) return json({ error: "Invalid onboarding details" }, 400)

  const username = sanitizeUsername(parsed.data.username)
  const validationError = usernameError(username)
  if (validationError) return json({ error: validationError }, 400)
  const favoriteGenres = [...new Set(parsed.data.favoriteGenres)]
  if (!favoriteGenres.length) return json({ error: "Select at least one favorite genre" }, 400)

  const identity = await getOnboardingIdentity()
  if (identity.status === "unauthorized") return json({ error: "Unauthorized" }, 401)
  if (identity.status === "unavailable") return json({ error: "Onboarding is unavailable" }, 503)
  if (identity.profile.onboarding_completed_at) return json({ error: "Setup is already complete" }, 409)

  const { data: matches, error: collisionError } = await identity.admin.from("user_profiles")
    .select("auth_user_id,username")
    .ilike("username", escapeLikeLiteral(username))
    .limit(5)
  if (collisionError) return json({ error: "Could not check username" }, 500)
  const wanted = normalizeUsername(username)
  if ((matches ?? []).some((row) => row.auth_user_id !== identity.user.id && normalizeUsername(row.username) === wanted)) {
    return json({ error: "That username is already taken" }, 409)
  }

  const lists = [
    { user_profile_id: identity.profile.id, name: "Planned Reading", list_type: "to-read", is_public: false, is_default: true },
    { user_profile_id: identity.profile.id, name: "Current Reading", list_type: "current-reading", is_public: false, is_default: true },
    { user_profile_id: identity.profile.id, name: "Finished Reading", list_type: "finished-reading", is_public: false, is_default: true },
  ]
  const { error: listError } = await identity.admin.from("title_lists")
    .upsert(lists, { onConflict: "user_profile_id,list_type", ignoreDuplicates: true })
  if (listError) return json({ error: "Could not create reading lists" }, 500)

  const now = new Date().toISOString()
  const { data: updated, error: updateError } = await identity.admin.from("user_profiles")
    .update({ username, favorite_genres: favoriteGenres, onboarding_completed_at: now, updated_at: now })
    .eq("id", identity.profile.id)
    .eq("auth_user_id", identity.user.id)
    .is("onboarding_completed_at", null)
    .select("id")
    .maybeSingle()
  if (updateError?.code === "23505") return json({ error: "That username is already taken" }, 409)
  if (updateError || !updated) return json({ error: "Could not finish setup" }, 409)
  return json({ success: true }, 200)
}
