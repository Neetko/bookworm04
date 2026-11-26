import { readBoundedJson } from "../../server/bounded-json.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const json = (body: unknown, status: number) => Response.json(body, { status })
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />")

async function participant(clubId: string) {
  const supabase = createRequestSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle()
  if (!profile?.id) return null
  const { data: club } = await supabase.from("clubs").select("id,type,owner_user_id").eq("id", clubId).maybeSingle()
  if (!club || club.type !== "writer") return null
  if (club.owner_user_id === profile.id) return { supabase, profileId: profile.id as string }
  const { data: member } = await supabase.from("club_members").select("id").eq("club_id", clubId).eq("user_id", profile.id).maybeSingle()
  return member ? { supabase, profileId: profile.id as string } : null
}

export async function saveWriterWork(request: Request, clubId: string) {
  if (!UUID.test(clubId)) return json({ error: "Club not found" }, 404)
  const body = await readBoundedJson(request, 120_000)
  if (!body.ok) return json({ error: body.error }, body.status)
  const input = body.value && typeof body.value === "object" ? body.value as Record<string, unknown> : {}
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 200) : ""
  const content = typeof input.content === "string" ? input.content.trim().slice(0, 100_000) : ""
  if (input.workId != null && (typeof input.workId !== "string" || !UUID.test(input.workId))) return json({ error: "Invalid work" }, 400)
  const workId = typeof input.workId === "string" && UUID.test(input.workId) ? input.workId : null
  if (!title || !content) return json({ error: "Title and content are required" }, 400)
  const access = await participant(clubId)
  if (!access) return json({ error: "Forbidden" }, 403)
  const payload = { title, content_text: content, content_html: `<p>${escapeHtml(content)}</p>`, is_public: input.isPublic === true, is_completed: input.isCompleted === true, updated_at: new Date().toISOString() }
  if (workId) {
    const { data: existing } = await access.supabase.from("club_writer_works").select("id,author_user_id").eq("id", workId).eq("club_id", clubId).maybeSingle()
    if (!existing || existing.author_user_id !== access.profileId) return json({ error: "Work not found" }, 404)
    const { error } = await access.supabase.from("club_writer_works").update(payload).eq("id", workId).eq("club_id", clubId).eq("author_user_id", access.profileId)
    return error ? json({ error: "Could not save work" }, 500) : json({ id: workId }, 200)
  }
  const { data, error } = await access.supabase.from("club_writer_works").insert({ club_id: clubId, author_user_id: access.profileId, ...payload }).select("id").single()
  return error || !data ? json({ error: "Could not save work" }, 500) : json({ id: data.id }, 201)
}

export async function toggleWriterLike(clubId: string, workId: string) {
  if (!UUID.test(clubId) || !UUID.test(workId)) return json({ error: "Work not found" }, 404)
  const access = await participant(clubId)
  if (!access) return json({ error: "Forbidden" }, 403)
  const { data: work } = await access.supabase.from("club_writer_works").select("id,is_public").eq("id", workId).eq("club_id", clubId).maybeSingle()
  if (!work?.is_public) return json({ error: "Work not found" }, 404)
  const { data: existing } = await access.supabase.from("club_writer_work_likes").select("id").eq("work_id", workId).eq("user_id", access.profileId).maybeSingle()
  const result = existing
    ? await access.supabase.from("club_writer_work_likes").delete().eq("id", existing.id)
    : await access.supabase.from("club_writer_work_likes").insert({ work_id: workId, user_id: access.profileId })
  return result.error ? json({ error: "Could not update like" }, 409) : json({ liked: !existing }, 200)
}
