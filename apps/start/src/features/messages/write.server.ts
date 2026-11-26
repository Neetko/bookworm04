import { z } from "zod"
import { readBoundedJson } from "../../server/bounded-json.server"
import { createAdminSupabaseClient } from "../../server/supabase-admin.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"
import { messagePreviewText, sanitizeMessageBody } from "./content"

const maxRequestBytes = 100_000
const uuid = z.string().uuid()
const writeInput = z.object({
  title: z.string().trim().min(1).max(200),
  recipient: z.string().trim().max(100).default(""),
  body: z.string().trim().min(1).max(20_000),
  status: z.enum(["sent", "draft"]).default("sent"),
  replyTo: z.string().uuid().nullable().optional(),
}).strict()
const markReadInput = z.object({ isRead: z.boolean() }).strict()

function json(body: unknown, status: number) {
  return Response.json(body, { status })
}

async function identity() {
  const supabase = createRequestSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle()
  return profile?.id ? { supabase, profileId: profile.id as string } : null
}

function parseWrite(value: unknown) {
  const parsed = writeInput.safeParse(value)
  if (!parsed.success || (parsed.data.status === "sent" && !parsed.data.recipient)) return null
  const body = sanitizeMessageBody(parsed.data.body)
  if (!messagePreviewText(body) || body.length > 10_000) return null
  return { ...parsed.data, body, replyTo: parsed.data.replyTo ?? null }
}

async function recipientFor(supabase: ReturnType<typeof createRequestSupabaseClient>, username: string, status: "sent" | "draft") {
  if (!username) return status === "draft" ? { id: null, pending: null } : null
  const { data } = await supabase.from("public_profiles").select("id").eq("username", username).maybeSingle()
  if (data?.id) return { id: data.id as string, pending: null }
  return status === "draft" ? { id: null, pending: username } : null
}

async function validReply(supabase: ReturnType<typeof createRequestSupabaseClient>, replyTo: string | null, senderId: string, recipientId: string | null) {
  if (!replyTo) return true
  if (!recipientId) return false
  const { data } = await supabase.from("messages").select("sender_profile_id,recipient_profile_id").eq("id", replyTo).eq("status", "sent").maybeSingle()
  if (!data) return false
  const participants = [data.sender_profile_id, data.recipient_profile_id]
  return participants.includes(senderId) && participants.includes(recipientId)
}

async function consumeQuota(profileId: string, status: "sent" | "draft") {
  const admin = createAdminSupabaseClient()
  if (!admin) return { ok: false as const, response: json({ error: "Message service is not configured" }, 503) }
  const { data, error } = await admin.rpc("consume_message_write_quota", { p_profile_id: profileId, p_status: status })
  if (error) return { ok: false as const, response: json({ error: "Failed to check message quota" }, 500) }
  if (data !== true) return { ok: false as const, response: json({ error: "Message rate limit reached" }, 429) }
  return { ok: true as const, admin }
}

export async function handleMessageWrite(request: Request): Promise<Response> {
  const jsonBody = await readBoundedJson(request, maxRequestBytes)
  if (!jsonBody.ok) return json({ error: jsonBody.error }, jsonBody.status)
  const input = parseWrite(jsonBody.value)
  if (!input) return json({ error: "Invalid message" }, 400)
  const actor = await identity()
  if (!actor) return json({ error: "Unauthorized" }, 401)
  const recipient = await recipientFor(actor.supabase, input.recipient, input.status)
  if (!recipient) return json({ error: "Recipient not found" }, 400)
  if (!await validReply(actor.supabase, input.replyTo, actor.profileId, recipient.id)) return json({ error: "Invalid reply target" }, 400)
  const quota = await consumeQuota(actor.profileId, input.status)
  if (!quota.ok) return quota.response
  const { data, error } = await quota.admin.from("messages").insert({
    sender_profile_id: actor.profileId, recipient_profile_id: recipient.id, recipient_username: recipient.pending,
    subject: input.title, body: input.body, status: input.status, is_read: input.status !== "sent",
    sender_deleted: false, recipient_deleted: false, reply_to: input.replyTo, updated_at: new Date().toISOString(),
  }).select("id").single()
  return error || !data ? json({ error: "Failed to create message" }, 500) : json({ id: data.id }, 201)
}

export async function handleMessageUpdate(request: Request, id: string): Promise<Response> {
  if (!uuid.safeParse(id).success) return json({ error: "Not found" }, 404)
  const body = await readBoundedJson(request, maxRequestBytes)
  if (!body.ok) return json({ error: body.error }, body.status)
  const actor = await identity()
  if (!actor) return json({ error: "Unauthorized" }, 401)
  const { data: message } = await actor.supabase.from("messages").select("sender_profile_id,recipient_profile_id,status").eq("id", id).maybeSingle()
  if (!message) return json({ error: "Not found" }, 404)
  const admin = createAdminSupabaseClient()
  if (!admin) return json({ error: "Message service is not configured" }, 503)
  const markRead = markReadInput.safeParse(body.value)
  if (markRead.success) {
    if (message.recipient_profile_id !== actor.profileId || message.status !== "sent") return json({ error: "Forbidden" }, 403)
    const { data, error } = await admin.from("messages").update({ is_read: markRead.data.isRead, updated_at: new Date().toISOString() }).eq("id", id).eq("recipient_profile_id", actor.profileId).eq("status", "sent").select("id").maybeSingle()
    return error || !data ? json({ error: "Failed to update message" }, 500) : json({ success: true }, 200)
  }
  const input = parseWrite(body.value)
  if (!input) return json({ error: "Invalid message update" }, 400)
  if (message.sender_profile_id !== actor.profileId) return json({ error: "Forbidden" }, 403)
  if (message.status !== "draft") return json({ error: "Only drafts can be edited" }, 403)
  if (input.replyTo) return json({ error: "Reply target cannot be changed" }, 400)
  const recipient = await recipientFor(actor.supabase, input.recipient, input.status)
  if (!recipient) return json({ error: "Recipient not found" }, 400)
  const quota = await consumeQuota(actor.profileId, input.status)
  if (!quota.ok) return quota.response
  const { data, error } = await quota.admin.from("messages").update({
    subject: input.title, body: input.body, status: input.status, recipient_profile_id: recipient.id,
    recipient_username: recipient.pending, is_read: input.status !== "sent", updated_at: new Date().toISOString(),
  }).eq("id", id).eq("sender_profile_id", actor.profileId).eq("status", "draft").select("id").maybeSingle()
  return error || !data ? json({ error: "Failed to update message" }, 500) : json({ success: true, id }, 200)
}

export async function handleMessageDelete(id: string): Promise<Response> {
  if (!uuid.safeParse(id).success) return json({ error: "Not found" }, 404)
  const actor = await identity()
  if (!actor) return json({ error: "Unauthorized" }, 401)
  const { data: message } = await actor.supabase.from("messages").select("id,status,sender_profile_id,recipient_profile_id,sender_deleted,recipient_deleted").eq("id", id).maybeSingle()
  if (!message) return json({ error: "Not found" }, 404)
  const isSender = message.sender_profile_id === actor.profileId
  const isRecipient = message.recipient_profile_id === actor.profileId
  if (!isSender && !isRecipient) return json({ error: "Forbidden" }, 403)
  const admin = createAdminSupabaseClient()
  if (!admin) return json({ error: "Message service is not configured" }, 503)
  if (message.status === "draft") {
    if (!isSender) return json({ error: "Forbidden" }, 403)
    const { error } = await admin.from("messages").delete().eq("id", id).eq("sender_profile_id", actor.profileId)
    return error ? json({ error: "Failed to delete draft" }, 500) : json({ deleted: true }, 200)
  }
  const senderDeleted = isSender || Boolean(message.sender_deleted)
  const recipientDeleted = isRecipient || Boolean(message.recipient_deleted)
  const result = senderDeleted && recipientDeleted
    ? await admin.from("messages").delete().eq("id", id)
    : await admin.from("messages").update({ sender_deleted: senderDeleted, recipient_deleted: recipientDeleted, updated_at: new Date().toISOString() }).eq("id", id)
  return result.error ? json({ error: "Failed to delete message" }, 500) : json({ deleted: true }, 200)
}

export async function handleRecipientSearch(request: Request): Promise<Response> {
  const actor = await identity()
  if (!actor) return json({ results: [] }, 200)
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? ""
  const [{ data: following }, { data: followers }] = await Promise.all([
    actor.supabase.from("user_follows").select("followed_profile_id").eq("follower_profile_id", actor.profileId),
    actor.supabase.from("user_follows").select("follower_profile_id").eq("followed_profile_id", actor.profileId),
  ])
  const followerIds = new Set((followers ?? []).map((row) => row.follower_profile_id))
  const friendIds = new Set((following ?? []).map((row) => row.followed_profile_id).filter((id) => followerIds.has(id)))
  let profileQuery = actor.supabase.from("public_profiles").select("id,username,avatar_url").neq("id", actor.profileId).order("created_at", { ascending: false }).limit(12)
  if (query) profileQuery = profileQuery.ilike("username", `%${query.replace(/[\\%_]/g, "\\$&")}%`)
  const { data } = await profileQuery
  const results = (data ?? []).map((profile) => ({ ...profile, isFriend: friendIds.has(profile.id) })).sort((a, b) => Number(b.isFriend) - Number(a.isFriend)).slice(0, 3)
  return json({ results }, 200)
}
