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
  type CatalogReview,
} from "./catalog"

type TitleRow = {
  id: string
  title: string
  author: string
  description: string | null
  cover_image_url: string | null
  published_year: number | null
  genre: unknown
  isbn?: string | null
}

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
  const { data, error } = await supabase.from("titles").select(`${TITLE_SELECT},isbn`).eq("id", id).maybeSingle()
  if (error) throw new Error("Could not load title")
  if (!data) throw notFound()
  const title = toCatalogTitle(data as TitleRow)

  const { data: reviewRows, error: reviewError } = await supabase.from("reviews")
    .select("id,rating,review_text,created_at,user_id")
    .eq("title_id", id)
    .order("created_at", { ascending: false })
    .limit(50)
  if (reviewError) throw new Error("Could not load reviews")
  const reviewers = [...new Set((reviewRows ?? []).map((row) => row.user_id).filter((value): value is string => Boolean(value)))]
  const { data: profileRows } = reviewers.length
    ? await supabase.from("public_profiles").select("id,username").in("id", reviewers)
    : { data: [] as Array<{ id: string; username: string | null }> }
  const names = new Map((profileRows ?? []).map((profile) => [profile.id, profile.username]))
  const reviews: CatalogReview[] = (reviewRows ?? []).map((row) => ({
    id: row.id,
    rating: row.rating,
    text: textOnly(row.review_text),
    createdAt: row.created_at,
    username: row.user_id ? names.get(row.user_id) ?? null : null,
  }))

  return { ...title, isbn: data.isbn, reviews }
}
