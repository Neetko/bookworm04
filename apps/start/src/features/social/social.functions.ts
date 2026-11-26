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

    const { data: { user } } = await supabase.auth.getUser()
    const { data: viewerProfile } = user
      ? await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle()
      : { data: null }
    const viewerId = viewerProfile?.id as string | undefined
    const [{ data: viewerMember }, { data: viewerApplication }] = viewerId
      ? await Promise.all([
          supabase.from("club_members").select("user_id").eq("club_id", club.id).eq("user_id", viewerId).maybeSingle(),
          supabase.from("club_applications").select("id,status").eq("club_id", club.id).eq("user_id", viewerId).eq("status", "pending").maybeSingle(),
        ])
      : [{ data: null }, { data: null }]

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
    const isParticipant = viewerId === club.owner_user_id || Boolean(viewerMember)
    const { data: writerRows } = club.type === "writer" && isParticipant
      ? await supabase.from("club_writer_works").select("id,author_user_id,title,content_text,is_completed,updated_at").eq("club_id", club.id).eq("is_public", true).order("updated_at", { ascending: false }).limit(50)
      : { data: [] as Array<{ id: string; author_user_id: string; title: string; content_text: string | null; is_completed: boolean; updated_at: string }> }
    const writerAuthorIds = [...new Set((writerRows ?? []).map((work) => work.author_user_id))]
    const { data: writerAuthors } = writerAuthorIds.length
      ? await supabase.from("public_profiles").select("id,username").in("id", writerAuthorIds)
      : { data: [] as Array<{ id: string; username: string | null }> }
    const writerAuthorMap = new Map((writerAuthors ?? []).map((author) => [author.id as string, author.username]))
    const writerWorks = (writerRows ?? []).map((work) => ({
      id: work.id,
      title: work.title,
      authorName: writerAuthorMap.get(work.author_user_id) ?? "Unknown author",
      excerpt: (work.content_text ?? "").length > 220 ? `${(work.content_text ?? "").slice(0, 217).trimEnd()}…` : (work.content_text ?? ""),
      isCompleted: Boolean(work.is_completed),
      updatedAt: work.updated_at,
    }))
    return {
      id: club.id, name: club.name, description: club.description, type: club.type,
      categories: club.categories ?? [], joinPolicy: club.join_policy, avatarUrl: safePublicImageUrl(club.avatar_url),
      owner: owner ? { id: owner.id, username: owner.username } : null,
      memberCount: memberResult.count ?? (members ?? []).length,
      members: (members ?? []).map((member) => ({ id: member.id, username: member.username, avatarUrl: safePublicImageUrl(member.avatar_url) })),
      reading,
      writerWorks,
      viewer: {
        signedIn: Boolean(viewerId),
        isOwner: viewerId === club.owner_user_id,
        isMember: isParticipant,
        hasPendingApplication: Boolean(viewerApplication),
      },
    }
  })

export const getClubManagement = createServerFn({ method: "GET" })
  .validator((input: unknown) => ({ id: validId(input && typeof input === "object" && "id" in input ? input.id : null) }))
  .handler(async ({ data }) => {
    if (!data.id) return { status: "not-found" as const }
    const supabase = createRequestSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { status: "unauthorized" as const }
    const { data: profile } = await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle()
    if (!profile?.id) return { status: "unauthorized" as const }
    const { data: club } = await supabase.from("clubs").select("id,name,description,type,categories,join_policy,owner_user_id,avatar_url,current_title_id").eq("id", data.id).maybeSingle()
    if (!club) return { status: "not-found" as const }
    if (club.owner_user_id !== profile.id) return { status: "forbidden" as const }

    const [memberResult, readingResult, applicationResult, invitationResult, catalogResult] = await Promise.all([
      supabase.from("club_members").select("user_id").eq("club_id", club.id).limit(500),
      supabase.from("club_reading_items").select("id,title_id,title,author,created_at").eq("club_id", club.id).order("created_at", { ascending: false }).limit(200),
      supabase.from("club_applications").select("id,user_id,created_at").eq("club_id", club.id).eq("status", "pending").order("created_at", { ascending: false }).limit(100),
      supabase.from("club_invitations").select("id,invitee_user_id,created_at").eq("club_id", club.id).eq("status", "pending").order("created_at", { ascending: false }).limit(100),
      supabase.from("titles").select("id,title,author").order("title").limit(200),
    ])
    const profileIds = [...new Set([
      ...(memberResult.data ?? []).map((row) => row.user_id),
      ...(applicationResult.data ?? []).map((row) => row.user_id),
      ...(invitationResult.data ?? []).map((row) => row.invitee_user_id),
    ])]
    const { data: profiles } = profileIds.length
      ? await supabase.from("public_profiles").select("id,username,avatar_url").in("id", profileIds)
      : { data: [] as Array<{ id: string; username: string | null; avatar_url: string | null }> }
    const profileMap = new Map((profiles ?? []).map((row) => [row.id as string, row]))
    return {
      status: "ok" as const,
      club: { id: club.id, ownerId: club.owner_user_id, name: club.name, description: club.description ?? "", type: club.type, categories: club.categories ?? [], joinPolicy: club.join_policy, avatarUrl: safePublicImageUrl(club.avatar_url), currentTitleId: club.current_title_id },
      reading: (readingResult.data ?? []).map((row) => ({ id: row.id, titleId: row.title_id, title: row.title ?? "Untitled", author: row.author })),
      members: (memberResult.data ?? []).flatMap((row) => { const item = profileMap.get(row.user_id); return item ? [{ id: item.id, username: item.username, avatarUrl: safePublicImageUrl(item.avatar_url) }] : [] }),
      applications: (applicationResult.data ?? []).flatMap((row) => { const item = profileMap.get(row.user_id); return item ? [{ id: row.id, username: item.username }] : [] }),
      invitations: (invitationResult.data ?? []).flatMap((row) => { const item = profileMap.get(row.invitee_user_id); return item ? [{ id: row.id, username: item.username }] : [] }),
      catalog: catalogResult.data ?? [],
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

    const { data: { user } } = await supabase.auth.getUser()
    const { data: viewerProfile } = user
      ? await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle()
      : { data: null }
    const viewerId = viewerProfile?.id as string | undefined
    const { data: follow } = viewerId && viewerId !== profile.id
      ? await supabase.from("user_follows").select("id,is_friend").eq("follower_profile_id", viewerId).eq("followed_profile_id", profile.id).maybeSingle()
      : { data: null }

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
      viewer: { signedIn: Boolean(viewerId), isSelf: viewerId === profile.id, isFollowing: Boolean(follow), isFriend: Boolean(follow?.is_friend) },
      points: (points ?? []).map((point) => ({ genre: point.genre, points: point.points })),
      readTitles: (readRows ?? []).flatMap((row) => {
        const title = titleMap.get(row.title_id)
        return title ? [{ id: title.id, title: title.title, author: title.author, coverUrl: safePublicImageUrl(title.cover_image_url) }] : []
      }),
    }
  })
