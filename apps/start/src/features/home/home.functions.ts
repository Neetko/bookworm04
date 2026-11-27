import { createServerFn } from "@tanstack/react-start"
import { safePublicImageUrl } from "../../server/images.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"

export type ActivityMetadata = {
  title?: { id?: string; title?: string; cover?: string }
  actor?: { username?: string; avatar_url?: string }
  club?: { name?: string; avatar_url?: string }
  list?: { name?: string }
  achievement?: { name?: string }
  reviewText?: string
  rating?: number
}

function activityMetadata(value: unknown): ActivityMetadata {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ActivityMetadata : {}
}

export type HomeDashboard = {
  stats: { booksThisYear: number; currentlyReading: number; reviewsWritten: number; following: number }
  suggestions: Array<{ id: string; username: string; avatarUrl: string | null }>
  activities: Array<{ id: string; actorId: string; actorName: string; avatarUrl: string | null; eventType: string; metadata: ActivityMetadata; createdAt: string | null }>
}

export const getPublicHome = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createRequestSupabaseClient()
  const [identity, titles, reviews, clubs] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("titles").select("id", { count: "exact", head: true }),
    supabase.from("reviews").select("id", { count: "exact", head: true }),
    supabase.from("clubs").select("id", { count: "exact", head: true }),
  ])
  const user = identity.error ? null : identity.data.user
  const { data: profile } = user
    ? await supabase.from("user_profiles").select("id,username,onboarding_completed_at").eq("auth_user_id", user.id).maybeSingle()
    : { data: null }
  const reader = user ? {
    name: profile?.username ?? user.user_metadata?.full_name ?? "Reader",
    onboarded: Boolean(profile?.onboarding_completed_at),
  } : null

  let dashboard: HomeDashboard | null = null

  if (reader?.onboarded && profile?.id) {
    const profileId = profile.id
    const [follows, books, current, written, suggested] = await Promise.all([
      supabase.from("user_follows").select("followed_profile_id").eq("follower_profile_id", profileId),
      supabase.from("reading_diary_entries").select("title_id", { count: "exact", head: true }).eq("user_profile_id", profileId).eq("is_completed", true).gte("entry_date", `${new Date().getFullYear()}-01-01`),
      supabase.from("title_user_progress").select("id", { count: "exact", head: true }).eq("user_profile_id", profileId).eq("is_completed", false).gt("progress_percent", 0),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", profileId),
      supabase.from("public_profiles").select("id,username,avatar_url").neq("id", profileId).limit(8),
    ])
    const followedIds = (follows.data ?? []).map((row) => row.followed_profile_id).filter((id): id is string => Boolean(id))
    const eventResult = followedIds.length
      ? await supabase.from("activity_events").select("id,user_profile_id,event_type,metadata,created_at").in("user_profile_id", followedIds).order("created_at", { ascending: false }).limit(50)
      : { data: [] }
    const rows = eventResult.data ?? []
    const actorIds = [...new Set(rows.map((row) => row.user_profile_id))]
    const actors = actorIds.length
      ? await supabase.from("public_profiles").select("id,username,avatar_url").in("id", actorIds)
      : { data: [] }
    const actorMap = new Map((actors.data ?? []).map((actor) => [actor.id, actor]))
    dashboard = {
      stats: { booksThisYear: books.count ?? 0, currentlyReading: current.count ?? 0, reviewsWritten: written.count ?? 0, following: followedIds.length },
      suggestions: (suggested.data ?? []).filter((person) => !followedIds.includes(person.id)).slice(0, 4).map((person) => ({ id: person.id, username: person.username ?? "Reader", avatarUrl: safePublicImageUrl(person.avatar_url) })),
      activities: rows.map((row) => {
        const metadata = activityMetadata(row.metadata)
        if (metadata.title?.cover) metadata.title.cover = safePublicImageUrl(metadata.title.cover) ?? undefined
        const actor = actorMap.get(row.user_profile_id)
        return {
          id: row.id,
          actorId: row.user_profile_id,
          actorName: actor?.username ?? metadata.actor?.username ?? "Someone",
          avatarUrl: safePublicImageUrl(actor?.avatar_url ?? metadata.actor?.avatar_url ?? null),
          eventType: row.event_type,
          metadata,
          createdAt: row.created_at,
        }
      }),
    }
  }

  return {
    reader,
    dashboard,
    counts: {
      titles: titles.error ? 0 : titles.count ?? 0,
      reviews: reviews.error ? 0 : reviews.count ?? 0,
      clubs: clubs.error ? 0 : clubs.count ?? 0,
    },
  }
})
