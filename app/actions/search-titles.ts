"use server"

import { createServerClient } from "@/lib/supabase-server"
import { searchGoogleBooksWithOpenLibrary } from "@/lib/google-books"
import {
  genresFromWeights,
  enforceGenreRulesFromList,
} from "@/lib/book-tagging"
import { isGenre, type Genre, type SearchTitleResult } from "@/lib/types"

type LocalTitleRow = {
  id: string
  title: string
  author: string
  description: string | null
  cover_image_url: string | null
  published_year: number | null
  isbn: string | null
  created_at: string
  updated_at: string
}

type SearchTitlesInput =
  | {
      title?: string
      author?: string
      raw?: string
      genres?: Genre[]
      includeExternal?: boolean
    }
  | string

type NormalizedSearch = {
  title: string
  author: string
  raw: string
  genres: Genre[]
  includeExternal: boolean
}

function normalizeSearchInput(input: SearchTitlesInput): NormalizedSearch {
  if (typeof input === "string") {
    const raw = input.trim()
    return { title: "", author: "", raw, genres: [], includeExternal: false }
  }

  return {
    title: (input.title ?? "").trim(),
    author: (input.author ?? "").trim(),
    raw: (input.raw ?? "").trim(),
    genres: (input.genres ?? []).filter(isGenre),
    includeExternal: Boolean(input.includeExternal),
  }
}

function uniqueGenres(genres: Genre[]): Genre[] {
  const seen = new Set<Genre>()
  const result: Genre[] = []
  for (const genre of genres) {
    if (seen.has(genre)) continue
    seen.add(genre)
    result.push(genre)
  }
  return result
}

async function getGenresForTitles(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  titleIds: string[]
): Promise<Map<string, Genre[]>> {
  if (titleIds.length === 0) return new Map()

  const [titleRows, bookRows, trackedByTitle, trackedById] = await Promise.all([
    supabase.from("titles").select("id,genre_weights").in("id", titleIds),
    supabase.from("books").select("title_id,genre,genre_weights").in("title_id", titleIds),
    supabase.from("tracked_books").select("title_id,genre,genre_weights").in("title_id", titleIds),
    supabase.from("tracked_books").select("id,genre,genre_weights").in("id", titleIds),
  ])

  const map = new Map<string, Genre[]>()
  for (const row of titleRows.data ?? []) {
    if (!row.id) continue
    const weighted = genresFromWeights((row as any).genre_weights)
    if (weighted.length > 0) map.set(row.id, weighted)
  }
  for (const row of bookRows.data ?? []) {
    if (!row.title_id) continue
    if (map.has(row.title_id)) continue
    const weighted = genresFromWeights((row as any).genre_weights)
    const fallback = enforceGenreRulesFromList(uniqueGenres(((row as any).genre ?? []).filter(isGenre)))
    map.set(row.title_id, weighted.length > 0 ? weighted : fallback)
  }
  for (const row of trackedByTitle.data ?? []) {
    if (!row.title_id) continue
    if (map.has(row.title_id)) continue
    const weighted = genresFromWeights((row as any).genre_weights)
    const fallback = enforceGenreRulesFromList(uniqueGenres(((row as any).genre ?? []).filter(isGenre)))
    map.set(row.title_id, weighted.length > 0 ? weighted : fallback)
  }
  for (const row of trackedById.data ?? []) {
    if (!row.id) continue
    if (map.has(row.id)) continue
    const weighted = genresFromWeights((row as any).genre_weights)
    const fallback = enforceGenreRulesFromList(uniqueGenres(((row as any).genre ?? []).filter(isGenre)))
    map.set(row.id, weighted.length > 0 ? weighted : fallback)
  }

  return map
}

async function getLocalBooks(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  query: NormalizedSearch
): Promise<LocalTitleRow[]> {
  const { title, author, raw } = query
  const hasStructured = Boolean(title || author)

  if (!hasStructured && !raw) return []

  let builder = supabase
    .from("titles")
    .select("id,title,author,description,cover_image_url,published_year,isbn,created_at,updated_at")

  if (hasStructured) {
    if (title) builder = builder.ilike("title", `%${title}%`)
    if (author) builder = builder.ilike("author", `%${author}%`)
  } else {
    builder = builder.or(`title.ilike.%${raw}%,author.ilike.%${raw}%`)
  }


  const { data, error } = await builder
    .order("title", { ascending: true })
    .order("author", { ascending: true })
    .limit(20)

  if (error) {
    console.error("Error fetching local titles", error)
    return []
  }

  return (data ?? []) as LocalTitleRow[]
}

export async function searchTitles(input: SearchTitlesInput): Promise<SearchTitleResult[]> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Unauthorized")

  const { title, author, raw, includeExternal, genres } = normalizeSearchInput(input)
  const hasStructured = Boolean(title || author)
  const hasAnyQuery = hasStructured || Boolean(raw)

  if (!hasAnyQuery) return []

  const googleQueryBase = hasStructured
    ? [title ? `intitle:${title}` : null, author ? `inauthor:${author}` : null]
        .filter(Boolean)
        .join(" ")
    : raw

  const googleQuery = googleQueryBase

  const [localBooks, googleBooks] = await Promise.all([
    getLocalBooks(supabase, { title, author, raw, includeExternal, genres }),
    includeExternal ? searchGoogleBooksWithOpenLibrary(googleQuery) : Promise.resolve([]),
  ])

  const volumeIds = googleBooks.map((book) => book.volumeId)
  const titleSourceMap = new Map<string, string>()

  if (volumeIds.length > 0 && includeExternal) {
    const { data: sources } = await supabase
      .from("title_sources")
      .select("external_id,title_id")
      .eq("source", "google")
      .in("external_id", volumeIds)

    for (const row of sources ?? []) {
      if (row.external_id && row.title_id) {
        titleSourceMap.set(row.external_id, row.title_id)
      }
    }
  }

  const localTitleIds = localBooks.map((book) => book.id)
  const localGenresMap = await getGenresForTitles(supabase, localTitleIds)
  const googleTitleIds = Array.from(titleSourceMap.values())
  const allTitleIds = Array.from(new Set([...localTitleIds, ...googleTitleIds])).filter(Boolean)

  const reviewCounts = new Map<string, number>()
  const postCounts = new Map<string, number>()

  if (allTitleIds.length > 0) {
    const [reviewRows, postRows] = await Promise.all([
      supabase.from("reviews").select("title_id").in("title_id", allTitleIds),
      supabase.from("discussion_posts").select("title_id").in("title_id", allTitleIds),
    ])

    for (const row of reviewRows.data ?? []) {
      if (!row.title_id) continue
      reviewCounts.set(row.title_id, (reviewCounts.get(row.title_id) ?? 0) + 1)
    }

    for (const row of postRows.data ?? []) {
      if (!row.title_id) continue
      postCounts.set(row.title_id, (postCounts.get(row.title_id) ?? 0) + 1)
    }
  }

  const localResults: SearchTitleResult[] = localBooks.map((book) => {
    const titleId = book.id
    const engagement = (reviewCounts.get(titleId) ?? 0) + (postCounts.get(titleId) ?? 0)

    return {
      id: book.id,
      source: "local",
      titleId,
      title: book.title,
      author: book.author,
      description: book.description ?? null,
      coverImageUrl: book.cover_image_url ?? null,
      genres: uniqueGenres(localGenresMap.get(titleId) ?? []),
      engagement,
      claimed: true,
    }
  })

  const filteredLocalResults =
    genres.length > 0
      ? localResults.filter((result) =>
          result.genres?.some((genre) => genres.includes(genre))
        )
      : localResults

  const googleResults: SearchTitleResult[] = googleBooks.map((book) => {
    const titleId = titleSourceMap.get(book.volumeId)
    const engagement = titleId
      ? (reviewCounts.get(titleId) ?? 0) + (postCounts.get(titleId) ?? 0)
      : 0

    return {
      id: book.volumeId,
      source: "google" as const,
      titleId,
      volumeId: book.volumeId,
      title: book.title,
      author: book.authors[0] ?? "Unknown author",
      description: book.description ?? null,
      coverImageUrl: book.thumbnailUrl ?? null,
      genres: [],
      engagement,
      claimed: Boolean(titleId),
    }
  })

  const combined = [...filteredLocalResults, ...googleResults]
  const deduped = new Map<string, SearchTitleResult>()

  const normalizeKeyPart = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()

  const buildKey = (result: SearchTitleResult) => {
    const titleKey = normalizeKeyPart(result.title)
    const authorKey = normalizeKeyPart(result.author)
    return `${titleKey}||${authorKey}`
  }

  const normalizeForRelevance = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()

  const queryText = normalizeForRelevance([title, author, raw].filter(Boolean).join(" "))
  const queryTerms = queryText.split(" ").filter((term) => term.length > 1)

  const relevanceScore = (result: SearchTitleResult) => {
    const titleText = normalizeForRelevance(result.title)
    const authorText = normalizeForRelevance(result.author)

    let score = 0
    for (const term of queryTerms) {
      if (titleText === term) score += 12
      else if (titleText.startsWith(term)) score += 7
      else if (titleText.includes(term)) score += 4

      if (authorText === term) score += 8
      else if (authorText.startsWith(term)) score += 5
      else if (authorText.includes(term)) score += 3
    }

    return score
  }

  for (const result of combined) {
    const key = buildKey(result)
    const existing = deduped.get(key)
    if (!existing) {
      deduped.set(key, result)
      continue
    }

    const existingScore = relevanceScore(existing)
    const nextScore = relevanceScore(result)
    if (nextScore !== existingScore) {
      deduped.set(key, nextScore > existingScore ? result : existing)
      continue
    }

    if (result.engagement !== existing.engagement) {
      deduped.set(key, result.engagement > existing.engagement ? result : existing)
      continue
    }
  }

  const compareResults = (a: SearchTitleResult, b: SearchTitleResult) => {
    const scoreA = relevanceScore(a)
    const scoreB = relevanceScore(b)
    if (scoreB !== scoreA) return scoreB - scoreA
    if (b.engagement !== a.engagement) return b.engagement - a.engagement
    return a.title.localeCompare(b.title)
  }

  const dedupedResults = Array.from(deduped.values())
  return dedupedResults.sort(compareResults)
}
