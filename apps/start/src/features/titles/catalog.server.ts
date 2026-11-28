import { notFound } from "@tanstack/react-router"
import { createRequestSupabaseClient } from "../../server/supabase.server"
import { safePublicImageUrl } from "../../server/images.server"
import {
  isGenre,
  normalizeCatalogSearch,
  normalizeGenres,
  type CatalogDetail,
  type CatalogSearch,
  type CatalogTitle,
  type CatalogDiscussionPost,
  type CatalogReview,
} from "./catalog"
import { sanitizeTitleRichText } from "./social-content"

type TitleRow = {
  id: string
  title: string
  author: string
  description: string | null
  cover_image_url: string | null
  published_year: number | null
  genre: unknown
}

// Canonical identity lives on titles/work mappings. ISBNs and ASINs identify
// editions only and must never become title identity or title-page metadata.
const TITLE_SELECT = "id,title,author,description,cover_image_url,published_year,genre"

function textOnly(value: string | null): string {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function toCatalogTitle(row: TitleRow): CatalogTitle {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    description: textOnly(row.description) || null,
    coverUrl: safePublicImageUrl(row.cover_image_url),
    year: row.published_year,
    genres: Array.isArray(row.genre) ? row.genre.filter(isGenre) : [],
  }
}

function envValue(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return ""
}

function amazonSearchUrl(query: string): string {
  const url = new URL("https://www.amazon.com/s")
  url.searchParams.set("k", query)
  const tag = envValue("AMAZON_ASSOCIATES_TAG", "AMAZON_AFFILIATE_TAG", "NEXT_PUBLIC_AMAZON_TAG", "VITE_AMAZON_TAG")
  if (tag) url.searchParams.set("tag", tag)
  return url.toString()
}

function audibleSearchUrl(query: string): string {
  // The original Next implementation used Amazon's stable catalog search for
  // audiobooks. Audible's direct search endpoint currently returns its generic
  // error page for otherwise valid title/author queries.
  return amazonSearchUrl(`${query} Audible`)
}

export async function searchCatalog(input: CatalogSearch): Promise<CatalogTitle[]> {
  const search = normalizeCatalogSearch(input)
  const supabase = createRequestSupabaseClient()
  const titleQuery = search.title || search.q
  const authorQuery = search.author
  const genres = normalizeGenres(search.genres)
  const buildBase = () => supabase.from("titles").select(TITLE_SELECT)
  const filtered = (query: ReturnType<typeof buildBase>) => {
    let current = query
    if (genres.length > 0) current = current.contains("genre", genres)
    return current.order("title", { ascending: true }).order("author", { ascending: true }).limit(titleQuery || authorQuery ? 25 : 50)
  }

  if (search.q) {
    const [byTitle, byAuthor] = await Promise.all([
      filtered(buildBase().ilike("title", `%${search.q}%`)),
      filtered(buildBase().ilike("author", `%${search.q}%`)),
    ])
    if (byTitle.error || byAuthor.error) throw new Error("Could not search titles")
    const unique = new Map<string, TitleRow>()
    for (const row of [...(byTitle.data ?? []), ...(byAuthor.data ?? [])] as TitleRow[]) unique.set(row.id, row)
    return [...unique.values()].sort((a, b) => a.title.localeCompare(b.title) || a.author.localeCompare(b.author)).slice(0, 25).map(toCatalogTitle)
  }

  let query = buildBase()
  if (titleQuery) query = query.ilike("title", `%${titleQuery}%`)
  if (authorQuery) query = query.ilike("author", `%${authorQuery}%`)
  const { data, error } = await filtered(query)
  if (error) throw new Error("Could not load titles")
  return ((data ?? []) as TitleRow[]).map(toCatalogTitle)
}

export async function getCatalogDetail(id: string): Promise<CatalogDetail> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw notFound()
  const supabase = createRequestSupabaseClient()
  const { data, error } = await supabase.from("titles").select(TITLE_SELECT).eq("id", id).maybeSingle()
  if (error) throw new Error("Could not load title")
  if (!data) throw notFound()
  const title = toCatalogTitle(data as TitleRow)

  const { data: { user } } = await supabase.auth.getUser()
  const { data: viewerProfile } = user
    ? await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle()
    : { data: null }
  const viewerProfileId = viewerProfile?.id as string | undefined

  const [reviewResult, discussionResult] = await Promise.all([
    supabase.from("reviews")
      .select("id,rating,review_text,created_at,user_id")
      .eq("title_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("discussion_posts")
      .select("id,content,created_at,user_id,likes_count")
      .eq("title_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ])
  if (reviewResult.error) throw new Error("Could not load reviews")
  if (discussionResult.error) throw new Error("Could not load discussion")

  const reviewRows = reviewResult.data ?? []
  const discussionRows = discussionResult.data ?? []
  const reviewIds = reviewRows.map((row) => row.id as string)
  const postIds = discussionRows.map((row) => row.id as string)
  const authorIds = [...new Set([
    ...reviewRows.map((row) => row.user_id),
    ...discussionRows.map((row) => row.user_id),
  ].filter((value): value is string => Boolean(value)))]

  const [profileResult, reviewLikeResult, viewerPostLikeResult] = await Promise.all([
    authorIds.length
      ? supabase.from("public_profiles").select("id,username,avatar_url").in("id", authorIds)
      : Promise.resolve({ data: [], error: null }),
    reviewIds.length
      ? supabase.from("review_likes").select("review_id,user_id").in("review_id", reviewIds)
      : Promise.resolve({ data: [], error: null }),
    viewerProfileId && postIds.length
      ? supabase.from("post_likes").select("post_id").eq("user_id", viewerProfileId).in("post_id", postIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (profileResult.error || reviewLikeResult.error || viewerPostLikeResult.error) {
    throw new Error("Could not load title activity")
  }

  const profiles = new Map((profileResult.data ?? []).map((profile) => [profile.id as string, profile]))
  const reviewLikeCounts = new Map<string, number>()
  const viewerReviewLikes = new Set<string>()
  for (const like of reviewLikeResult.data ?? []) {
    const reviewId = like.review_id as string
    reviewLikeCounts.set(reviewId, (reviewLikeCounts.get(reviewId) ?? 0) + 1)
    if (viewerProfileId && like.user_id === viewerProfileId) viewerReviewLikes.add(reviewId)
  }
  const viewerPostLikes = new Set((viewerPostLikeResult.data ?? []).map((like) => like.post_id as string))

  const reviews: CatalogReview[] = reviewRows.map((row) => {
    const profile = row.user_id ? profiles.get(row.user_id as string) : null
    return {
      id: row.id as string,
      rating: Number(row.rating),
      html: sanitizeTitleRichText(row.review_text),
      createdAt: String(row.created_at),
      userId: row.user_id as string | null,
      username: profile?.username ? String(profile.username) : null,
      likesCount: reviewLikeCounts.get(row.id as string) ?? 0,
      viewerHasLiked: viewerReviewLikes.has(row.id as string),
    }
  })
  const discussionPosts: CatalogDiscussionPost[] = discussionRows.map((row) => {
    const profile = row.user_id ? profiles.get(row.user_id as string) : null
    return {
      id: row.id as string,
      html: sanitizeTitleRichText(row.content),
      createdAt: String(row.created_at),
      userId: row.user_id as string | null,
      username: profile?.username ? String(profile.username) : null,
      avatarUrl: safePublicImageUrl(profile?.avatar_url ?? null),
      likesCount: Number(row.likes_count) || 0,
      viewerHasLiked: viewerPostLikes.has(row.id as string),
    }
  })

  let viewer: CatalogDetail["viewer"] = {
    signedIn: false,
    isRead: false,
    review: null,
    progress: null,
    todayNote: "",
  }

  if (viewerProfileId) {
      const today = new Date().toISOString().slice(0, 10)
      const [listResult, progressResult, diaryResult] = await Promise.all([
        supabase.from("title_lists").select("id")
          .eq("user_profile_id", viewerProfileId).eq("list_type", "finished-reading").maybeSingle(),
        supabase.from("title_user_progress")
          .select("current_page,total_pages,minutes_listened,total_minutes,progress_percent")
          .eq("user_profile_id", viewerProfileId).eq("title_id", id).maybeSingle(),
        supabase.from("reading_diary_entries").select("note_text")
          .eq("user_profile_id", viewerProfileId).eq("title_id", id).eq("entry_date", today)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ])
      const { data: readItem } = listResult.data?.id
        ? await supabase.from("title_list_items").select("title_id")
            .eq("list_id", listResult.data.id).eq("title_id", id).maybeSingle()
        : { data: null }
      const saved = progressResult.data
      viewer = {
        signedIn: true,
        isRead: Boolean(readItem?.title_id),
        review: reviews.find((review) => review.userId === viewerProfileId) ?? null,
        progress: saved ? {
          mode: saved.total_minutes !== null ? "audiobook" : "pages",
          currentPage: saved.current_page ?? 0,
          totalPages: saved.total_pages ?? 300,
          minutesListened: saved.minutes_listened ?? 0,
          totalMinutes: saved.total_minutes ?? 600,
          percent: saved.progress_percent ?? 0,
        } : null,
        todayNote: diaryResult.data?.note_text ?? "",
      }
  }

  const searchTerms = `${title.title} ${title.author}`.trim()
  return {
    ...title,
    reviews,
    discussionPosts,
    viewer,
    shop: {
      amazonUrl: amazonSearchUrl(searchTerms),
      audibleUrl: audibleSearchUrl(searchTerms),
    },
  }
}
