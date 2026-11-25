import { createServerFn } from "@tanstack/react-start"
import { safePublicImageUrl } from "../../server/images.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"
import { normalizeCommunitySearch } from "./search"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validId(input: unknown) {
  if (typeof input !== "string" || !UUID.test(input)) return null
  return input
}

export const getCommunityClubs = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const search = normalizeCommunitySearch(input)
    return {
      q: search.q,
      types: search.t ? search.t.split(",") : [],
      genres: search.genres ? search.genres.split(",") : [],
    }
  })
  .handler(async ({ data }) => {
    const supabase = createRequestSupabaseClient()
    let query = supabase
      .from("clubs")
      .select("id,name,description,type,categories,join_policy,avatar_url,current_title_id,created_at")
      .order("created_at", { ascending: false })
      .limit(60)
    if (data.types.length) query = query.in("type", data.types)
    if (data.genres.length) query = query.contains("categories", data.genres)
    if (data.q) query = query.ilike("name", `%${data.q}%`)

    const { data: clubs, error } = await query
    if (error) throw new Error("Could not load clubs")
    const boundedClubs = clubs ?? []
    if (!boundedClubs.length) return []

    const titleIds = boundedClubs.map((club) => club.current_title_id).filter((id): id is string => Boolean(id))
    const { data: titles } = titleIds.length
      ? await supabase.from("titles").select("id,title").in("id", titleIds)
      : { data: [] as Array<{ id: string; title: string }> }
    const titleNames = new Map((titles ?? []).map((title) => [title.id, title.title]))

    return boundedClubs.map((club) => ({
      id: club.id,
      name: club.name,
      description: club.description,
      type: club.type,
      categories: club.categories ?? [],
      joinPolicy: club.join_policy,
      avatarUrl: safePublicImageUrl(club.avatar_url),
      memberCount: null,
      currentReading: club.current_title_id ? titleNames.get(club.current_title_id) ?? null : null,
    }))
  })

export const getPublicClub = createServerFn({ method: "GET" })
  .validator((input: unknown) => ({
    id: validId(input && typeof input === "object" && "id" in input ? input.id : null),
  }))
  .handler(async ({ data }) => {
    if (!data.id) return null
    const supabase = createRequestSupabaseClient()
    const { data: club, error } = await supabase
      .from("clubs")
      .select("id,name,description,type,categories,join_policy,owner_user_id,avatar_url,current_title_id")
      .eq("id", data.id)
      .maybeSingle()
    if (error) throw new Error("Could not load club")
    if (!club) return null

    const [{ data: owner }, memberResult, { data: readingRows }] = await Promise.all([
      supabase.from("public_profiles").select("id,username,avatar_url").eq("id", club.owner_user_id).maybeSingle(),
      supabase.from("club_members").select("user_id", { count: "exact" }).eq("club_id", club.id).limit(100),
      club.type === "book"
        ? supabase.from("club_reading_items").select("id,title_id,title,author").eq("club_id", club.id).order("created_at", { ascending: false }).limit(50)
        : Promise.resolve({ data: [] as Array<{ id: string; title_id: string | null; title: string | null; author: string | null }> }),
    ])
    const memberRows = memberResult.data
    const memberIds = [...new Set([club.owner_user_id, ...(memberRows ?? []).map((row) => row.user_id)])]
    const { data: members } = await supabase.from("public_profiles").select("id,username,avatar_url").in("id", memberIds)
    const titleIds = (readingRows ?? []).map((row) => row.title_id).filter((id): id is string => Boolean(id))
    const { data: titles } = titleIds.length
      ? await supabase.from("titles").select("id,title,author,cover_image_url").in("id", titleIds)
      : { data: [] as Array<{ id: string; title: string; author: string | null; cover_image_url: string | null }> }
    const titleMap = new Map((titles ?? []).map((title) => [title.id, title]))
    const reading = (readingRows ?? []).map((row) => {
      const title = row.title_id ? titleMap.get(row.title_id) : null
      return { id: row.id, titleId: title?.id ?? row.title_id, title: title?.title ?? row.title ?? "Untitled", author: title?.author ?? row.author, coverUrl: safePublicImageUrl(title?.cover_image_url) }
    })
    return {
      id: club.id, name: club.name, description: club.description, type: club.type,
      categories: club.categories ?? [], joinPolicy: club.join_policy, avatarUrl: safePublicImageUrl(club.avatar_url),
      owner: owner ? { id: owner.id, username: owner.username } : null,
      memberCount: memberResult.count ?? (members ?? []).length,
      members: (members ?? []).map((member) => ({ id: member.id, username: member.username, avatarUrl: safePublicImageUrl(member.avatar_url) })),
      reading,
    }
  })

export const getPublicUser = createServerFn({ method: "GET" })
  .validator((input: unknown) => ({
    id: validId(input && typeof input === "object" && "id" in input ? input.id : null),
  }))
  .handler(async ({ data }) => {
    if (!data.id) return null
    const supabase = createRequestSupabaseClient()
    const { data: profile, error } = await supabase
      .from("public_profiles").select("id,username,avatar_url,bio").eq("id", data.id).maybeSingle()
    if (error) throw new Error("Could not load public profile")
    if (!profile) return null

    const [{ data: list }, { data: points }] = await Promise.all([
      supabase.from("title_lists").select("id").eq("user_profile_id", profile.id).eq("list_type", "finished-reading").maybeSingle(),
      supabase.from("user_genre_points").select("genre,points").eq("user_profile_id", profile.id).order("points", { ascending: false }).limit(50),
    ])
    const { data: readRows } = list?.id
      ? await supabase.from("title_list_items").select("title_id,created_at").eq("list_id", list.id).order("created_at", { ascending: false }).limit(100)
      : { data: [] as Array<{ title_id: string; created_at: string | null }> }
    const titleIds = (readRows ?? []).map((row) => row.title_id)
    const { data: titles } = titleIds.length
      ? await supabase.from("titles").select("id,title,author,cover_image_url").in("id", titleIds)
      : { data: [] as Array<{ id: string; title: string; author: string | null; cover_image_url: string | null }> }
    const titleMap = new Map((titles ?? []).map((title) => [title.id, title]))
    return {
      profile: { id: profile.id, username: profile.username, avatarUrl: safePublicImageUrl(profile.avatar_url), bio: profile.bio },
      points: (points ?? []).map((point) => ({ genre: point.genre, points: point.points })),
      readTitles: (readRows ?? []).flatMap((row) => {
        const title = titleMap.get(row.title_id)
        return title ? [{ id: title.id, title: title.title, author: title.author, coverUrl: safePublicImageUrl(title.cover_image_url) }] : []
      }),
    }
  })
