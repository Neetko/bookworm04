"use server"

import { createServerClient } from "@/lib/supabase-server"
import { searchGoogleBooksWithOpenLibrary, type MergedWork } from "@/lib/google-books"
import { enforceGenreRulesFromList } from "@/lib/book-tagging"
import { isGenre, type Genre, type SearchTitleResult } from "@/lib/types"
import { getTitleSearchCapabilities } from "@/lib/title-capabilities"
import { mergeSearchTitleResults } from "@/lib/title-search-results"
import { hasEverySelectedGenre } from "@/lib/genre-filter"
import { normalizeSearchInput, type SearchTitlesInput } from "@/lib/validation/title-search"
import {
  getBestEffortCanonicalExternalMatchReport,
  type CanonicalExternalMatchReport,
} from "@/lib/server/title-search-matching"
import {
  getLocalTitleRowsAlphabetical,
  getLocalTitleRowsByIds,
  searchLocalTitleRows,
  uniqueLocalTitleRows,
  type LocalTitleRow,
} from "@/lib/server/local-title-search"

function getExternalAuthor(book: Pick<MergedWork, "authors">) {
  return book.authors[0] ?? "Unknown author"
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

  const [titleRows] = await Promise.all([
    supabase.from("titles").select("id,genre").in("id", titleIds),
  ])

  const map = new Map<string, Genre[]>()
  for (const row of titleRows.data ?? []) {
    if (!row.id) continue
    const fallback = enforceGenreRulesFromList(uniqueGenres(((row as any).genre ?? []).filter(isGenre)))
    map.set(row.id, fallback)
  }
  return map
}

async function buildLocalResults(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  localBooks: LocalTitleRow[]
): Promise<SearchTitleResult[]> {
  const localTitleIds = localBooks.map((book) => book.id)
  const localGenresMap = await getGenresForTitles(supabase, localTitleIds)
  const reviewCounts = new Map<string, number>()
  const postCounts = new Map<string, number>()

  if (localTitleIds.length > 0) {
    const [reviewRows, postRows] = await Promise.all([
      supabase.from("reviews").select("title_id").in("title_id", localTitleIds),
      supabase.from("discussion_posts").select("title_id").in("title_id", localTitleIds),
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

  return localBooks.map((book) => {
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
    }
  })
}

export async function searchTitles(input: SearchTitlesInput): Promise<SearchTitleResult[]> {
  const { title, author, raw, includeExternal, genres } = normalizeSearchInput(input)
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const searchCapabilities = getTitleSearchCapabilities({ isSignedIn: Boolean(user) })
  const shouldIncludeExternal = includeExternal && searchCapabilities.canSearchExternalSources
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
    searchLocalTitleRows(supabase, { title, author, raw }),
    shouldIncludeExternal ? searchGoogleBooksWithOpenLibrary(googleQuery) : Promise.resolve([]),
  ])

  const externalMatchReport: CanonicalExternalMatchReport = shouldIncludeExternal
    ? await getBestEffortCanonicalExternalMatchReport(googleBooks)
    : { matches: new Map(), collisions: new Map() }
  const localTitleIdSet = new Set(localBooks.map((book) => book.id))
  const matchedExternalTitleIds = Array.from(
    new Set(
      [
        ...Array.from(externalMatchReport.matches.values()).map((match) => match.titleId),
        ...Array.from(externalMatchReport.collisions.values()).flatMap((collision) => collision.titleIds),
      ]
        .filter((titleId) => !localTitleIdSet.has(titleId))
    )
  )
  const matchedLocalBooks = await getLocalTitleRowsByIds(supabase, matchedExternalTitleIds)
  const localResults = await buildLocalResults(supabase, uniqueLocalTitleRows([...localBooks, ...matchedLocalBooks]))

  const filteredLocalResults =
    genres.length > 0
      ? localResults.filter((result) => hasEverySelectedGenre(result.genres, genres))
      : localResults

  const googleResults: SearchTitleResult[] = googleBooks
    .filter((book) => !externalMatchReport.matches.has(book.volumeId))
    .filter((book) => !externalMatchReport.collisions.has(book.volumeId))
    .map((book) => {
      return {
        id: book.volumeId,
        source: "google" as const,
        volumeId: book.volumeId,
        title: book.title,
        author: getExternalAuthor(book),
        description: book.description ?? null,
        coverImageUrl: book.thumbnailUrl ?? null,
        genres: [],
        engagement: 0,
      }
    })

  return mergeSearchTitleResults({
    localResults: filteredLocalResults,
    externalResults: googleResults,
    query: { title, author, raw },
  })
}

export async function getInitialTitles(genres: Genre[] = []): Promise<SearchTitleResult[]> {
  const selectedGenres = normalizeSearchInput({ genres }).genres
  const supabase = await createServerClient()

  const localBooks = await getLocalTitleRowsAlphabetical(supabase, 50)
  const localResults = await buildLocalResults(supabase, localBooks)

  if (selectedGenres.length === 0) return localResults

  return localResults.filter((result) => hasEverySelectedGenre(result.genres, selectedGenres))
}
