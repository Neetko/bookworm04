import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { createRequestSupabaseClient } from "../../server/supabase.server"
import { messagePreviewText, sanitizeMessageBody } from "./content"

export type MessageFolder = "inbox" | "sent" | "drafts"

const listInput = z.object({
  folder: z.enum(["inbox", "sent", "drafts"]).default("inbox"),
  page: z.number().int().min(1).max(10_000).default(1),
}).strict()
const detailInput = z.object({ id: z.string().max(100) }).strict()
const uuid = z.string().uuid()
const pageSize = 20

async function getProfile() {
  const supabase = createRequestSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return null
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()
  if (profileError || !profile) return null
  return { supabase, profileId: profile.id as string }
}

async function getCounts(supabase: ReturnType<typeof createRequestSupabaseClient>, profileId: string) {
  const [inbox, sent, drafts] = await Promise.all([
    supabase.from("messages").select("id", { count: "exact", head: true })
      .eq("recipient_profile_id", profileId).eq("status", "sent")
      .eq("is_read", false).eq("recipient_deleted", false),
    supabase.from("messages").select("id", { count: "exact", head: true })
      .eq("sender_profile_id", profileId).eq("status", "sent").eq("sender_deleted", false),
    supabase.from("messages").select("id", { count: "exact", head: true })
      .eq("sender_profile_id", profileId).eq("status", "draft").eq("sender_deleted", false),
  ])
  return { inbox: inbox.count ?? 0, sent: sent.count ?? 0, drafts: drafts.count ?? 0 }
}

async function getPublicNames(
  supabase: ReturnType<typeof createRequestSupabaseClient>,
  rows: Array<{ sender_profile_id: string; recipient_profile_id: string | null }>,
) {
  const ids = [...new Set(rows.flatMap((row) => [row.sender_profile_id, row.recipient_profile_id]).filter((id): id is string => Boolean(id)))]
  if (!ids.length) return new Map<string, { username: string | null; avatar_url: string | null }>()
  const { data } = await supabase.from("public_profiles")
    .select("id,username,avatar_url").in("id", ids)
  return new Map((data ?? []).map((profile) => [profile.id as string, profile]))
}

export const getMessageList = createServerFn({ method: "GET" })
  .validator(listInput)
  .handler(async ({ data: { folder, page } }) => {
    const profile = await getProfile()
    if (!profile) return { status: "unauthorized" as const }
    const { supabase, profileId } = profile
    let query = supabase.from("messages")
      .select("id,sender_profile_id,recipient_profile_id,recipient_username,subject,body,created_at,is_read,status,reply_to")
    if (folder === "sent") {
      query = query.eq("sender_profile_id", profileId).eq("status", "sent").eq("sender_deleted", false)
    } else if (folder === "drafts") {
      query = query.eq("sender_profile_id", profileId).eq("status", "draft").eq("sender_deleted", false)
    } else {
      query = query.eq("recipient_profile_id", profileId).eq("status", "sent").eq("recipient_deleted", false)
    }
    const from = (page - 1) * pageSize
    const { data: rows, error } = await query.order("created_at", { ascending: false }).range(from, from + pageSize - 1)
    if (error) throw new Error("Failed to load messages")
    const names = await getPublicNames(supabase, rows ?? [])
    const counts = await getCounts(supabase, profileId)
    return {
      status: "ok" as const,
      folder, page, counts,
      results: (rows ?? []).map((row) => ({
        id: row.id as string,
        subject: row.subject as string,
        preview: messagePreviewText(row.body as string),
        date: row.created_at as string,
        read: Boolean(row.is_read),
        type: row.status as "draft" | "sent",
        from: names.get(row.sender_profile_id)?.username ?? "Unknown",
        to: row.recipient_profile_id
          ? names.get(row.recipient_profile_id)?.username ?? "Unknown"
          : row.recipient_username ?? "Unknown",
      })),
    }
  })

export const getMessageDetail = createServerFn({ method: "GET" })
  .validator(detailInput)
  .handler(async ({ data: { id } }) => {
    if (!uuid.safeParse(id).success) return { status: "not-found" as const }
    const profile = await getProfile()
    if (!profile) return { status: "unauthorized" as const }
    const { supabase, profileId } = profile
    const { data: row, error } = await supabase.from("messages")
      .select("id,sender_profile_id,recipient_profile_id,recipient_username,subject,body,created_at,is_read,status,reply_to,sender_deleted,recipient_deleted")
      .eq("id", id)
      .or(`sender_profile_id.eq.${profileId},recipient_profile_id.eq.${profileId}`)
      .maybeSingle()
    if (error) throw new Error("Failed to load message")
    if (!row) return { status: "not-found" as const }
    const isSender = row.sender_profile_id === profileId
    const isRecipient = row.recipient_profile_id === profileId
    if ((isSender && row.sender_deleted) || (isRecipient && row.recipient_deleted)) {
      return { status: "not-found" as const }
    }
    const names = await getPublicNames(supabase, [row])
    return {
      status: "ok" as const,
      id: row.id as string,
      subject: row.subject as string,
      body: sanitizeMessageBody(row.body as string),
      date: row.created_at as string,
      read: Boolean(row.is_read),
      type: row.status === "draft" ? "draft" as const : isRecipient ? "inbox" as const : "sent" as const,
      from: names.get(row.sender_profile_id)?.username ?? "Unknown",
      to: row.recipient_profile_id
        ? names.get(row.recipient_profile_id)?.username ?? "Unknown"
        : row.recipient_username ?? "Unknown",
      replyTo: row.reply_to as string | null,
    }
  })
