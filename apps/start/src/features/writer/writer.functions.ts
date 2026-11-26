import { createServerFn } from "@tanstack/react-start"
import { createRequestSupabaseClient } from "../../server/supabase.server"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const id = (value: unknown) => typeof value === "string" && UUID.test(value) ? value : null

async function viewer(supabase: ReturnType<typeof createRequestSupabaseClient>, clubId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle()
  if (!profile?.id) return null
  const { data: club } = await supabase.from("clubs").select("id,name,type,owner_user_id").eq("id", clubId).maybeSingle()
  if (!club || club.type !== "writer") return null
  if (club.owner_user_id === profile.id) return { profileId: profile.id as string, club }
  const { data: member } = await supabase.from("club_members").select("id").eq("club_id", clubId).eq("user_id", profile.id).maybeSingle()
  return member ? { profileId: profile.id as string, club } : null
}

export const getWriterWorkspace = createServerFn({ method: "GET" })
  .validator((input: unknown) => ({ clubId: id(input && typeof input === "object" && "clubId" in input ? input.clubId : null) }))
  .handler(async ({ data }) => {
    if (!data.clubId) return { status: "not-found" as const }
    const supabase = createRequestSupabaseClient()
    const access = await viewer(supabase, data.clubId)
    if (!access) return { status: "forbidden" as const }
    const { data: works } = await supabase.from("club_writer_works").select("id,title,content_text,is_public,is_completed,updated_at").eq("club_id", data.clubId).eq("author_user_id", access.profileId).order("updated_at", { ascending: false }).limit(100)
    return { status: "ok" as const, club: { id: access.club.id, name: access.club.name }, works: works ?? [] }
  })

export const getWriterWork = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const source = input && typeof input === "object" ? input as Record<string, unknown> : {}
    return { clubId: id(source.clubId), workId: id(source.workId) }
  })
  .handler(async ({ data }) => {
    if (!data.clubId || !data.workId) return null
    const supabase = createRequestSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle()
    if (!profile?.id) return null
    const { data: club } = await supabase.from("clubs").select("id,type,owner_user_id").eq("id", data.clubId).maybeSingle()
    if (!club || club.type !== "writer") return null
    const { data: work } = await supabase.from("club_writer_works").select("id,club_id,author_user_id,title,content_text,is_public,is_completed,updated_at").eq("id", data.workId).eq("club_id", data.clubId).maybeSingle()
    if (!work) return null
    const isAuthor = work.author_user_id === profile.id
    const { data: member } = !isAuthor && club.owner_user_id !== profile.id
      ? await supabase.from("club_members").select("id").eq("club_id", data.clubId).eq("user_id", profile.id).maybeSingle()
      : { data: null }
    const isParticipant = club.owner_user_id === profile.id || Boolean(member)
    if (!isAuthor && (!work.is_public || !isParticipant)) return null
    const [{ data: author }, likesResult, { data: liked }] = await Promise.all([
      supabase.from("public_profiles").select("username").eq("id", work.author_user_id).maybeSingle(),
      supabase.from("club_writer_work_likes").select("id", { count: "exact", head: true }).eq("work_id", work.id),
      supabase.from("club_writer_work_likes").select("id").eq("work_id", work.id).eq("user_id", profile.id).maybeSingle(),
    ])
    return { ...work, authorName: author?.username ?? "Unknown author", likesCount: likesResult.count ?? 0, viewerLiked: Boolean(liked), viewerCanEdit: isAuthor && isParticipant }
  })
