import { randomUUID } from "node:crypto"
import { MAX_AVATAR_INPUT_BYTES, resizeAvatarImage } from "../../server/avatar-image.server"
import { getOwnedAvatarObjectPath } from "../../server/avatar-storage.server"
import { readBoundedFormData } from "../../server/bounded-form-data.server"
import { readBoundedJson } from "../../server/bounded-json.server"
import { createAdminSupabaseClient } from "../../server/supabase-admin.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"
import { isUuid, parseClubCreate, parseClubMutation } from "./validation"

const json = (body: unknown, status: number) => Response.json(body, { status })
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&")

async function identity() {
  const supabase = createRequestSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle()
  return profile?.id ? { supabase, userId: user.id, profileId: profile.id as string } : null
}

async function owner(clubId: string) {
  const viewer = await identity()
  if (!viewer) return null
  const { data: club } = await viewer.supabase.from("clubs").select("id,owner_user_id,avatar_url").eq("id", clubId).maybeSingle()
  return club?.owner_user_id === viewer.profileId ? { ...viewer, club } : null
}

export async function handleClubCreate(request: Request) {
  const body = await readBoundedJson(request, 8_192)
  if (!body.ok) return json({ error: body.error }, body.status)
  const input = parseClubCreate(body.value)
  if (!input) return json({ error: "Invalid club" }, 400)
  const viewer = await identity()
  if (!viewer) return json({ error: "Unauthorized" }, 401)
  const admin = createAdminSupabaseClient()
  if (!admin) return json({ error: "Club service is not configured" }, 503)
  const { count } = await viewer.supabase.from("clubs").select("id", { count: "exact", head: true }).eq("owner_user_id", viewer.profileId)
  if ((count ?? 0) >= 20) return json({ error: "Club limit reached" }, 409)
  const { data: club, error } = await admin.from("clubs").insert({
    owner_user_id: viewer.profileId,
    type: input.type,
    name: input.name,
    description: input.description || null,
    categories: input.categories.length ? input.categories : null,
  }).select("id").single()
  if (error || !club) return json({ error: "Could not create club" }, 500)
  await admin.from("activity_events").insert({ user_profile_id: viewer.profileId, event_type: "club_created", metadata: { club: { id: club.id, name: input.name, avatar_url: null } } })
  return json({ id: club.id }, 201)
}

export async function handleClubMutation(request: Request, clubId: string) {
  if (!isUuid(clubId)) return json({ error: "Club not found" }, 404)
  const body = await readBoundedJson(request, 16_384)
  if (!body.ok) return json({ error: body.error }, body.status)
  const input = parseClubMutation(body.value)
  if (!input) return json({ error: "Invalid club update" }, 400)
  const viewer = await identity()
  if (!viewer) return json({ error: "Unauthorized" }, 401)

  if (["join", "apply", "withdraw", "leave"].includes(input.action)) {
    const rpc = input.action === "join" ? "join_open_club" : input.action === "apply" ? "submit_club_application" : input.action === "withdraw" ? "withdraw_club_application" : "leave_club"
    const { error } = await viewer.supabase.rpc(rpc, { target_club_id: clubId })
    return error ? json({ error: "Club membership could not be updated" }, 409) : json({ success: true }, 200)
  }

  const owned = await owner(clubId)
  if (!owned) return json({ error: "Forbidden" }, 403)
  const admin = createAdminSupabaseClient()
  if (!admin) return json({ error: "Club service is not configured" }, 503)

  if (input.action === "update") {
    const { error } = await admin.from("clubs").update({ name: input.name, description: input.description || null, categories: input.categories.length ? input.categories : null, join_policy: input.joinPolicy, updated_at: new Date().toISOString() }).eq("id", clubId).eq("owner_user_id", owned.profileId)
    return error ? json({ error: "Could not update club" }, 500) : json({ success: true }, 200)
  }
  if (input.action === "add-reading") {
    const { data: title } = await owned.supabase.from("titles").select("id,title,author").eq("id", input.titleId).maybeSingle()
    if (!title) return json({ error: "Title not found" }, 404)
    const { count } = await owned.supabase.from("club_reading_items").select("id", { count: "exact", head: true }).eq("club_id", clubId)
    if ((count ?? 0) >= 200) return json({ error: "Reading list limit reached" }, 409)
    const { error } = await admin.from("club_reading_items").insert({ club_id: clubId, title_id: title.id, title: title.title, author: title.author })
    return error ? json({ error: "Could not add title" }, 409) : json({ success: true }, 201)
  }
  if (input.action === "remove-reading") {
    const { error } = await admin.from("club_reading_items").delete().eq("id", input.itemId).eq("club_id", clubId)
    return error ? json({ error: "Could not remove title" }, 500) : json({ success: true }, 200)
  }
  if (input.action === "set-current") {
    if (input.titleId) {
      const { data: item } = await owned.supabase.from("club_reading_items").select("id").eq("club_id", clubId).eq("title_id", input.titleId).maybeSingle()
      if (!item) return json({ error: "Choose a title from this club's reading list" }, 400)
    }
    const { error } = await admin.from("clubs").update({ current_title_id: input.titleId, updated_at: new Date().toISOString() }).eq("id", clubId).eq("owner_user_id", owned.profileId)
    return error ? json({ error: "Could not update current reading" }, 500) : json({ success: true }, 200)
  }
  if (input.action === "invite") {
    const { data: invitee } = await owned.supabase.from("public_profiles").select("id").ilike("username", escapeLike(input.username)).limit(1).maybeSingle()
    if (!invitee) return json({ error: "Reader not found" }, 404)
    const { error } = await owned.supabase.rpc("invite_club_member", { target_club_id: clubId, target_invitee_profile_id: invitee.id })
    return error ? json({ error: "Could not invite reader" }, 409) : json({ success: true }, 200)
  }
  if (input.action === "revoke-invitation") {
    const { error } = await owned.supabase.rpc("revoke_club_invitation", { target_club_id: clubId, target_invitation_id: input.invitationId })
    return error ? json({ error: "Could not revoke invitation" }, 409) : json({ success: true }, 200)
  }
  if (input.action === "review-application") {
    const { error } = await owned.supabase.rpc("review_club_application", { target_club_id: clubId, target_application_id: input.applicationId, approve_application: input.approve })
    return error ? json({ error: "Could not review application" }, 409) : json({ success: true }, 200)
  }
  if (input.action === "remove-member") {
    const { error } = await owned.supabase.rpc("remove_club_member", { target_club_id: clubId, target_member_profile_id: input.profileId, removal_reason: null })
    return error ? json({ error: "Could not remove member" }, 409) : json({ success: true }, 200)
  }
  return json({ error: "Invalid club update" }, 400)
}

export async function handleClubAvatar(request: Request, clubId: string) {
  if (!isUuid(clubId)) return json({ error: "Club not found" }, 404)
  const form = await readBoundedFormData(request, MAX_AVATAR_INPUT_BYTES + 64 * 1024)
  if (!form.ok) return json({ error: form.error }, form.status)
  const file = form.value.get("file")
  if (!(file instanceof File) || !file.size) return json({ error: "No file selected" }, 400)
  if (file.size > MAX_AVATAR_INPUT_BYTES) return json({ error: "Avatar too large" }, 413)
  const owned = await owner(clubId)
  if (!owned) return json({ error: "Forbidden" }, 403)
  const admin = createAdminSupabaseClient()
  if (!admin) return json({ error: "Club service is not configured" }, 503)
  const { data: withinQuota } = await admin.rpc("consume_avatar_upload_quota", { p_profile_id: owned.profileId })
  if (!withinQuota) return json({ error: "Avatar upload limit reached" }, 429)
  let image
  try { image = await resizeAvatarImage(file, 200) } catch { return json({ error: "Unsupported or unsafe image" }, 400) }
  const path = `clubs/${clubId}/${randomUUID()}.${image.ext}`
  const { error: uploadError } = await admin.storage.from("club-avatars").upload(path, image.buffer, { upsert: false, contentType: image.contentType, cacheControl: "31536000" })
  if (uploadError) return json({ error: "Could not upload avatar" }, 500)
  const url = admin.storage.from("club-avatars").getPublicUrl(path).data.publicUrl
  const { error: updateError } = await admin.from("clubs").update({ avatar_url: url, updated_at: new Date().toISOString() }).eq("id", clubId).eq("owner_user_id", owned.profileId)
  if (updateError) { await admin.storage.from("club-avatars").remove([path]); return json({ error: "Could not save avatar" }, 500) }
  const oldPath = getOwnedAvatarObjectPath(owned.club.avatar_url, "club-avatars", `clubs/${clubId}`)
  if (oldPath) await admin.storage.from("club-avatars").remove([oldPath])
  return json({ url }, 200)
}
