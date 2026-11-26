import { randomUUID } from "node:crypto"
import { MAX_AVATAR_INPUT_BYTES, resizeAvatarImage } from "../../server/avatar-image.server"
import { getOwnedAvatarObjectPath } from "../../server/avatar-storage.server"
import { readBoundedFormData } from "../../server/bounded-form-data.server"
import { createAdminSupabaseClient } from "../../server/supabase-admin.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"

const MAX_MULTIPART_BYTES = MAX_AVATAR_INPUT_BYTES + 64 * 1024

function json(body: unknown, status: number) {
  return Response.json(body, { status })
}

export async function handleAvatarUpload(request: Request): Promise<Response> {
  const form = await readBoundedFormData(request, MAX_MULTIPART_BYTES)
  if (!form.ok) return json({ error: form.error }, form.status)

  const file = form.value.get("file")
  if (!(file instanceof File) || file.size === 0) return json({ error: "No file selected" }, 400)
  if (file.size > MAX_AVATAR_INPUT_BYTES) return json({ error: "Avatar too large (max 2MB)" }, 413)

  const supabase = createRequestSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return json({ error: "Unauthorized" }, 401)
  const { data: profile, error: profileError } = await supabase.from("user_profiles")
    .select("id,auth_user_id,avatar_url")
    .eq("auth_user_id", user.id)
    .maybeSingle()
  if (profileError) return json({ error: "Could not load profile" }, 500)
  if (!profile?.id || profile.auth_user_id !== user.id) return json({ error: "Profile not found" }, 404)

  const admin = createAdminSupabaseClient()
  if (!admin) return json({ error: "Profile service is not configured" }, 503)
  const { data: withinQuota, error: quotaError } = await admin.rpc("consume_avatar_upload_quota", {
    p_profile_id: profile.id,
  })
  if (quotaError) return json({ error: "Could not check avatar upload limit" }, 500)
  if (!withinQuota) return json({ error: "Avatar upload limit reached for today" }, 429)

  let resized
  try {
    resized = await resizeAvatarImage(file, 200)
  } catch {
    return json({ error: "Unsupported or unsafe image" }, 400)
  }

  const path = `${user.id}/${randomUUID()}.${resized.ext}`
  const { error: uploadError } = await admin.storage.from("user-avatars").upload(
    path,
    resized.buffer,
    { upsert: false, contentType: resized.contentType, cacheControl: "31536000" },
  )
  if (uploadError) return json({ error: "Could not upload avatar" }, 500)

  const { data: publicUrlData } = admin.storage.from("user-avatars").getPublicUrl(path)
  const publicUrl = publicUrlData.publicUrl
  const { data: updated, error: updateError } = await admin.from("user_profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", profile.id)
    .eq("auth_user_id", user.id)
    .select("id")
    .maybeSingle()
  if (updateError || !updated) {
    const { error: cleanupError } = await admin.storage.from("user-avatars").remove([path])
    if (cleanupError) console.error("Could not remove unsaved avatar", cleanupError)
    return json({ error: "Could not save avatar" }, 500)
  }

  const oldPath = getOwnedAvatarObjectPath(profile.avatar_url, "user-avatars", user.id)
  if (oldPath && oldPath !== path) {
    const { error: cleanupError } = await admin.storage.from("user-avatars").remove([oldPath])
    if (cleanupError) console.error("Could not remove replaced avatar", cleanupError)
  }

  return json({ url: publicUrl }, 200)
}
