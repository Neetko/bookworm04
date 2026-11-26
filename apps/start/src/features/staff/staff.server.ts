import { z } from "zod"
import { readBoundedJson } from "../../server/bounded-json.server"
import { createAdminSupabaseClient } from "../../server/supabase-admin.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"
import { GENRES, normalizeGenres } from "../titles/catalog"

const uuid = z.string().uuid()
const json = (body: unknown, status = 200) => Response.json(body, { status })

async function staff(requireAdmin = false, requireAal2 = true) {
  const supabase = createRequestSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle()
  if (!role || (requireAdmin ? role.role !== "admin" : !["admin", "moderator"].includes(role.role))) return null
  if (requireAal2) { const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(); if (data?.currentLevel !== "aal2") return null }
  const { data: profile } = await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle()
  return profile?.id ? { supabase, user, role: role.role as "admin" | "moderator", profileId: profile.id as string } : null
}

export async function handleStaffMfa(request: Request) {
  const actor = await staff(false, false)
  if (!actor) return json({ error: "Forbidden" }, 403)
  if (request.method === "GET") {
    const { data, error } = await actor.supabase.auth.mfa.listFactors()
    if (error) return json({ error: "Could not load authenticator settings" }, 500)
    return json({ verifiedFactorId: data.totp.find((factor) => factor.status === "verified")?.id ?? null })
  }
  const body = await readBoundedJson(request, 8_000)
  if (!body.ok) return json({ error: body.error }, body.status)
  const source = body.value && typeof body.value === "object" ? body.value as Record<string, unknown> : {}
  if (source.action === "enroll") {
    const { data, error } = await actor.supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Bookworm staff" })
    if (error || !data.totp?.qr_code || !data.totp.secret) return json({ error: error?.message ?? "Could not start authenticator setup" }, 400)
    return json({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
  }
  const factorId = typeof source.factorId === "string" && uuid.safeParse(source.factorId).success ? source.factorId : null
  const code = typeof source.code === "string" && /^\d{6}$/.test(source.code) ? source.code : null
  if (source.action !== "verify" || !factorId || !code) return json({ error: "Enter a valid six-digit code" }, 400)
  const { data: challenge, error: challengeError } = await actor.supabase.auth.mfa.challenge({ factorId })
  if (challengeError || !challenge?.id) return json({ error: challengeError?.message ?? "Could not start verification" }, 400)
  const { error } = await actor.supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
  return error ? json({ error: error.message }, 400) : json({ verified: true })
}

export async function handleRoleChange(request: Request) {
  const actor = await staff(true)
  if (!actor) return json({ error: "Admin verification required" }, 403)
  const body = await readBoundedJson(request, 4_000)
  if (!body.ok) return json({ error: body.error }, body.status)
  const parsed = z.object({ authUserId: z.string().uuid(), makeModerator: z.boolean() }).strict().safeParse(body.value)
  if (!parsed.success) return json({ error: "Invalid role change" }, 400)
  const admin = createAdminSupabaseClient()
  if (!admin) return json({ error: "Role service is not configured" }, 503)
  const { data, error } = await admin.rpc("change_moderator_role", { p_actor_auth_user_id: actor.user.id, p_target_auth_user_id: parsed.data.authUserId, p_make_moderator: parsed.data.makeModerator })
  if (error || !Array.isArray(data) || data.length !== 1) return json({ error: "Could not change role" }, 500)
  return json({ changed: data[0].changed === true })
}

export async function handleSuggestionReview(request: Request) {
  const actor = await staff()
  if (!actor) return json({ error: "Staff verification required" }, 403)
  const body = await readBoundedJson(request, 12_000)
  if (!body.ok) return json({ error: body.error }, body.status)
  const parsed = z.object({ suggestionId: z.string().uuid(), action: z.enum(["approve", "dismiss"]), genres: z.array(z.enum(GENRES)).max(GENRES.length).optional() }).strict().safeParse(body.value)
  if (!parsed.success) return json({ error: "Invalid review" }, 400)
  const admin = createAdminSupabaseClient()
  if (!admin) return json({ error: "Review service is not configured" }, 503)
  const { data: suggestion } = await admin.from("suggestions").select("id,title_id,suggested_genres,suggested_selected_work_ids,suggested_selected_work_snapshots,admin_final_selected_work_ids,admin_final_selected_work_snapshots,admin_final_cover_selection,status").eq("id", parsed.data.suggestionId).maybeSingle()
  if (!suggestion || suggestion.status !== "pending") return json({ error: "Suggestion not found" }, 404)
  const now = new Date().toISOString()
  if (parsed.data.action === "dismiss") {
    const { error } = await admin.from("suggestions").update({ status: "dismissed", admin_reviewed_at: now, admin_reviewed_by_profile_id: actor.profileId, updated_at: now }).eq("id", suggestion.id).eq("status", "pending")
    return error ? json({ error: "Could not dismiss suggestion" }, 500) : json({ success: true })
  }
  const genres = normalizeGenres(parsed.data.genres?.join(",") ?? suggestion.suggested_genres?.join(",") ?? "")
  const workIds = Array.isArray(suggestion.admin_final_selected_work_ids) && suggestion.admin_final_selected_work_ids.length ? suggestion.admin_final_selected_work_ids : Array.isArray(suggestion.suggested_selected_work_ids) ? suggestion.suggested_selected_work_ids : []
  const cover = suggestion.admin_final_cover_selection && typeof suggestion.admin_final_cover_selection === "object" && !Array.isArray(suggestion.admin_final_cover_selection) && "imageUrl" in suggestion.admin_final_cover_selection && typeof suggestion.admin_final_cover_selection.imageUrl === "string" ? suggestion.admin_final_cover_selection.imageUrl : null
  const titleUpdate: Record<string, unknown> = { updated_at: now }
  if (genres.length) titleUpdate.genre = genres
  if (workIds.length) { titleUpdate.work_id = workIds[0]; titleUpdate.dupe_work_ids = workIds.slice(1) }
  if (cover) titleUpdate.cover_image_url = cover
  const [titleResult, suggestionResult] = await Promise.all([
    admin.from("titles").update(titleUpdate).eq("id", suggestion.title_id),
    admin.from("suggestions").update({ status: "approved", admin_final_genres: genres, admin_reviewed_at: now, admin_reviewed_by_profile_id: actor.profileId, updated_at: now }).eq("id", suggestion.id).eq("status", "pending"),
  ])
  return titleResult.error || suggestionResult.error ? json({ error: "Could not approve suggestion" }, 500) : json({ success: true })
}
