import { z } from "zod"
import { readBoundedJson } from "../../server/bounded-json.server"
import { createAdminSupabaseClient } from "../../server/supabase-admin.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"
import { messagePreviewText, sanitizeMessageBody } from "./content"

const maxRequestBytes = 100_000
const sendInput = z.object({
  title: z.string().trim().min(1).max(200),
  recipient: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(20_000),
  replyTo: z.string().uuid().nullable().optional(),
}).strict()

function json(body: unknown, status: number) {
  return Response.json(body, { status })
}

export async function handleMessageWrite(request: Request): Promise<Response> {
  const jsonBody = await readBoundedJson(request, maxRequestBytes)
  if (!jsonBody.ok) return json({ error: jsonBody.error }, jsonBody.status)

  const parsed = sendInput.safeParse(jsonBody.value)
  if (!parsed.success) return json({ error: "Invalid message" }, 400)
  const body = sanitizeMessageBody(parsed.data.body)
  if (!messagePreviewText(body) || body.length > 10_000) {
    return json({ error: "Invalid message" }, 400)
  }

  const supabase = createRequestSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return json({ error: "Unauthorized" }, 401)
  const { data: sender, error: senderError } = await supabase.from("user_profiles")
    .select("id").eq("auth_user_id", user.id).maybeSingle()
  if (senderError || !sender) return json({ error: "Unauthorized" }, 401)

  const { data: recipient, error: recipientError } = await supabase.from("public_profiles")
    .select("id").eq("username", parsed.data.recipient).maybeSingle()
  if (recipientError || !recipient) return json({ error: "Recipient not found" }, 400)

  if (parsed.data.replyTo) {
    const { data: original, error: originalError } = await supabase.from("messages")
      .select("sender_profile_id,recipient_profile_id")
      .eq("id", parsed.data.replyTo).eq("status", "sent").maybeSingle()
    const participants = [original?.sender_profile_id, original?.recipient_profile_id]
    if (originalError || !original || !participants.includes(sender.id) || !participants.includes(recipient.id)) {
      return json({ error: "Invalid reply target" }, 400)
    }
  }

  const admin = createAdminSupabaseClient()
  if (!admin) return json({ error: "Message service is not configured" }, 503)
  const { data: allowed, error: quotaError } = await admin.rpc("consume_message_write_quota", {
    p_profile_id: sender.id,
    p_status: "sent",
  })
  if (quotaError) return json({ error: "Failed to check message quota" }, 500)
  if (allowed !== true) return json({ error: "Message rate limit reached" }, 429)

  const { data: created, error: insertError } = await admin.from("messages")
    .insert({
      sender_profile_id: sender.id,
      recipient_profile_id: recipient.id,
      recipient_username: null,
      subject: parsed.data.title,
      body,
      status: "sent",
      is_read: false,
      sender_deleted: false,
      recipient_deleted: false,
      reply_to: parsed.data.replyTo ?? null,
      updated_at: new Date().toISOString(),
    })
    .select("id").single()
  if (insertError || !created) return json({ error: "Failed to send message" }, 500)
  return json({ id: created.id as string }, 201)
}
