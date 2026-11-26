import { safePublicImageUrl } from "../../server/images.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"
import { sanitizeActivityMetadata } from "./validation"

export async function loadOwnProfile() {
  const supabase = createRequestSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { status: "unauthorized" as const }

  const { data: profile, error: profileError } = await supabase.from("user_profiles")
    .select("id,auth_user_id,username,email,bio,avatar_url,created_at,favorite_genres,onboarding_completed_at")
    .eq("auth_user_id", user.id)
    .maybeSingle()
  if (profileError) throw new Error("Could not load profile")
  if (!profile?.id) return { status: "not-found" as const }

  const { data: lists, error: listError } = await supabase.from("title_lists")
    .select("id,name,list_type,is_public,is_default,created_at")
    .eq("user_profile_id", profile.id)
    .order("created_at", { ascending: true })
    .limit(50)
  if (listError) throw new Error("Could not load profile lists")
  const listIds = (lists ?? []).map((list) => list.id as string)
  const finishedListId = (lists ?? []).find((list) => list.list_type === "finished-reading")?.id as string | undefined

  const [reviewCount, finishedCount, itemResult, likesResult, pointsResult, activityResult] = await Promise.all([
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
    finishedListId
      ? supabase.from("title_list_items").select("id", { count: "exact", head: true }).eq("list_id", finishedListId)
      : Promise.resolve({ count: 0, error: null }),
    listIds.length
      ? supabase.from("title_list_items").select("list_id,title_id,created_at")
        .in("list_id", listIds).order("created_at", { ascending: false }).limit(500)
      : Promise.resolve({ data: [], error: null }),
    listIds.length
      ? supabase.from("title_list_likes").select("list_id").in("list_id", listIds).limit(2_000)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("user_genre_points").select("genre,points")
      .eq("user_profile_id", profile.id).order("points", { ascending: false }).limit(50),
    supabase.from("activity_events").select("id,event_type,metadata,created_at")
      .eq("user_profile_id", profile.id).order("created_at", { ascending: false }).limit(5),
  ])
  if (reviewCount.error || finishedCount.error || itemResult.error || likesResult.error || pointsResult.error || activityResult.error) {
    throw new Error("Could not load profile details")
  }

  const itemRows = itemResult.data ?? []
  const titleIds = [...new Set(itemRows.map((item) => item.title_id as string))]
  const { data: titles, error: titleError } = titleIds.length
    ? await supabase.from("titles").select("id,title,author,cover_image_url").in("id", titleIds).limit(500)
    : { data: [], error: null }
  if (titleError) throw new Error("Could not load profile titles")

  const titleMap = new Map((titles ?? []).map((title) => [title.id as string, title]))
  const itemsByList = new Map<string, Array<{
    titleId: string
    title: string
    author: string | null
    coverUrl: string | null
  }>>()
  for (const item of itemRows) {
    const title = titleMap.get(item.title_id as string)
    if (!title) continue
    const listId = item.list_id as string
    const entries = itemsByList.get(listId) ?? []
    entries.push({
      titleId: title.id as string,
      title: String(title.title),
      author: title.author ? String(title.author) : null,
      coverUrl: safePublicImageUrl(title.cover_image_url),
    })
    itemsByList.set(listId, entries)
  }

  const likes = new Map<string, number>()
  for (const row of likesResult.data ?? []) {
    const id = row.list_id as string
    likes.set(id, (likes.get(id) ?? 0) + 1)
  }
  const mappedLists = (lists ?? []).map((list) => ({
    id: list.id as string,
    name: String(list.name),
    type: String(list.list_type),
    isPublic: Boolean(list.is_public),
    isDefault: Boolean(list.is_default),
    likes: likes.get(list.id as string) ?? 0,
    items: itemsByList.get(list.id as string) ?? [],
  }))
  return {
    status: "ok" as const,
    profile: {
      id: profile.id as string,
      username: profile.username ? String(profile.username) : "",
      email: profile.email ? String(profile.email) : user.email ?? "",
      bio: profile.bio ? String(profile.bio) : "",
      avatarUrl: safePublicImageUrl(profile.avatar_url),
      createdAt: String(profile.created_at),
      favoriteGenres: Array.isArray(profile.favorite_genres)
        ? profile.favorite_genres.filter((genre): genre is string => typeof genre === "string").slice(0, 20)
        : [],
    },
    stats: {
      booksRead: finishedCount.count ?? 0,
      reviewsWritten: reviewCount.count ?? 0,
    },
    points: (pointsResult.data ?? []).map((point) => ({
      genre: String(point.genre),
      points: Number(point.points) || 0,
    })),
    lists: mappedLists,
    activity: (activityResult.data ?? []).map((event) => ({
      id: event.id as string,
      type: String(event.event_type),
      createdAt: String(event.created_at),
      metadata: sanitizeActivityMetadata(event.metadata),
    })),
  }
}
