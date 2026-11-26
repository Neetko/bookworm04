import { createServerFn } from "@tanstack/react-start"
import { safePublicImageUrl } from "../../server/images.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"

export const getPublicHome = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createRequestSupabaseClient()
  const [titles, reviews, clubs, recent] = await Promise.all([
    supabase.from("titles").select("id", { count: "exact", head: true }),
    supabase.from("reviews").select("id", { count: "exact", head: true }),
    supabase.from("clubs").select("id", { count: "exact", head: true }),
    supabase.from("titles").select("id,title,author,cover_image_url").order("created_at", { ascending: false }).limit(4),
  ])
  return {
    counts: { titles: titles.error ? 0 : titles.count ?? 0, reviews: reviews.error ? 0 : reviews.count ?? 0, clubs: clubs.error ? 0 : clubs.count ?? 0 },
    recentTitles: recent.error ? [] : (recent.data ?? []).map((title) => ({
      id: title.id as string,
      title: title.title as string,
      author: title.author as string,
      coverUrl: safePublicImageUrl(title.cover_image_url as string | null),
    })),
  }
})
