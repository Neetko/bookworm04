import "server-only"

import { normalizeReferenceIsbn, normalizeReferenceIsbns } from "@/lib/reference-data"
import type { SupabaseServerClient } from "@/lib/supabase-server"
import { normalizeTitleSearchText } from "@/lib/title-search-results"
import type { Tables } from "@/lib/database.types"

type TitleRow = Tables<"titles">

const LOCAL_TITLE_SELECT = "id,title,author,description,cover_image_url,published_year,isbn,created_at,updated_at"

export type LocalTitleRow = Pick<
  TitleRow,
  "id" | "title" | "author" | "description" | "cover_image_url" | "published_year" | "isbn" | "created_at" | "updated_at"
>

export type LocalTitleSearchQuery = {
  title: string
  author: string
  raw: string
}

export type LocalTitleMatchSource =
  | "reference-isbn"
  | "primary-isbn"
  | "isbn-list"
  | "exact-title-author"

export type LocalTitleCanonicalMatch = {
  titleId: string
  source: LocalTitleMatchSource
  confidenceScore: number
  isCollision: boolean
}

export function extractSearchIsbns(query: LocalTitleSearchQuery) {
  const values = [query.title, query.author, query.raw].filter(Boolean)
  const directMatches = normalizeReferenceIsbns(values)
  const tokenMatches = values.flatMap((value) => {
    return value
      .split(/[\s,;|/]+/)
      .map((token) => normalizeReferenceIsbn(token))
      .filter((isbn): isbn is string => Boolean(isbn))
  })

  return Array.from(new Set([...directMatches, ...tokenMatches]))
}

export function uniqueLocalTitleRows(rows: LocalTitleRow[]) {
  const seen = new Set<string>()
  const result: LocalTitleRow[] = []
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    result.push(row)
  }
  return result
}

function normalizeTitleIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)))
}

function appendCanonicalMatches(
  matches: LocalTitleCanonicalMatch[],
  seenTitleIds: Set<string>,
  titleIds: Array<string | null | undefined>,
  source: LocalTitleMatchSource,
  confidenceScore: number
) {
  const uniqueTitleIds = normalizeTitleIds(titleIds)
  const isCollision = uniqueTitleIds.length > 1

  for (const titleId of uniqueTitleIds) {
    if (seenTitleIds.has(titleId)) continue
    seenTitleIds.add(titleId)
    matches.push({ titleId, source, confidenceScore, isCollision })
  }
}

export async function getCanonicalLocalTitleMatches(
  supabase: SupabaseServerClient,
  query: LocalTitleSearchQuery
): Promise<LocalTitleCanonicalMatch[]> {
  const matches: LocalTitleCanonicalMatch[] = []
  const seenTitleIds = new Set<string>()
  const isbns = extractSearchIsbns(query)

  if (isbns.length > 0) {
    const { data: referenceRows, error: referenceError } = await supabase
      .from("reference_isbns")
      .select("title_id")
      .in("isbn", isbns)

    if (referenceError) {
      console.error("Error fetching reference ISBN title matches", referenceError)
    } else {
      appendCanonicalMatches(
        matches,
        seenTitleIds,
        (referenceRows ?? []).map((row) => row.title_id),
        "reference-isbn",
        98
      )
    }

    const { data: primaryRows, error: primaryError } = await supabase
      .from("titles")
      .select("id")
      .in("isbn", isbns)

    if (primaryError) {
      console.error("Error fetching primary ISBN title matches", primaryError)
    } else {
      appendCanonicalMatches(
        matches,
        seenTitleIds,
        (primaryRows ?? []).map((row) => row.id),
        "primary-isbn",
        96
      )
    }

    const isbnListLookups = await Promise.all(
      isbns.map(async (isbn) => {
        const { data, error } = await supabase
          .from("titles")
          .select("id")
          .contains("isbn_list", JSON.stringify([isbn]))

        if (error) {
          console.error("Error fetching ISBN-list title matches", error)
          return [] as string[]
        }

        return (data ?? [])
          .map((row) => row.id)
          .filter((titleId): titleId is string => Boolean(titleId))
      })
    )

    appendCanonicalMatches(
      matches,
      seenTitleIds,
      isbnListLookups.flat(),
      "isbn-list",
      94
    )
  }

  if (query.title && query.author) {
    const normalizedTitle = normalizeTitleSearchText(query.title)
    const normalizedAuthor = normalizeTitleSearchText(query.author)
    const { data: exactRows, error: exactError } = await supabase
      .from("titles")
      .select("id,title,author")
      .ilike("title", query.title)
      .ilike("author", query.author)

    if (exactError) {
      console.error("Error fetching exact title/author matches", exactError)
    } else {
      appendCanonicalMatches(
        matches,
        seenTitleIds,
        (exactRows ?? [])
          .filter((row) => normalizeTitleSearchText(row.title ?? "") === normalizedTitle)
          .filter((row) => normalizeTitleSearchText(row.author ?? "") === normalizedAuthor)
          .map((row) => row.id),
        "exact-title-author",
        80
      )
    }
  }

  return matches
}

export async function getLocalTitleRowsByIds(
  supabase: SupabaseServerClient,
  titleIds: string[]
): Promise<LocalTitleRow[]> {
  const uniqueTitleIds = normalizeTitleIds(titleIds)
  if (uniqueTitleIds.length === 0) return []

  const { data, error } = await supabase
    .from("titles")
    .select(LOCAL_TITLE_SELECT)
    .in("id", uniqueTitleIds)

  if (error) {
    console.error("Error fetching local titles by id", error)
    return []
  }

  const rowMap = new Map(((data ?? []) as LocalTitleRow[]).map((row) => [row.id, row]))
  return uniqueTitleIds.map((titleId) => rowMap.get(titleId)).filter((row): row is LocalTitleRow => Boolean(row))
}

async function getFallbackLocalTitleRows(
  supabase: SupabaseServerClient,
  query: LocalTitleSearchQuery,
  excludeTitleIds: string[]
): Promise<LocalTitleRow[]> {
  const { title, author, raw } = query
  const hasStructured = Boolean(title || author)
  if (!hasStructured && !raw) return []
  const excluded = new Set(excludeTitleIds)
  const resultLimit = 20 + Math.min(excludeTitleIds.length, 180)

  if (!hasStructured) {
    // Separate parameterized filters keep punctuation in the query as data.
    // A combined PostgREST `.or()` string would parse client text as syntax.
    const [titleMatch, authorMatch] = await Promise.all([
      supabase.from("titles").select(LOCAL_TITLE_SELECT)
        .ilike("title", `%${raw}%`)
        .order("title", { ascending: true })
        .order("author", { ascending: true })
        .limit(resultLimit),
      supabase.from("titles").select(LOCAL_TITLE_SELECT)
        .ilike("author", `%${raw}%`)
        .order("title", { ascending: true })
        .order("author", { ascending: true })
        .limit(resultLimit),
    ])

    if (titleMatch.error) console.error("Error fetching local title matches", titleMatch.error)
    if (authorMatch.error) console.error("Error fetching local author matches", authorMatch.error)

    return uniqueLocalTitleRows([
      ...((titleMatch.data ?? []) as LocalTitleRow[]),
      ...((authorMatch.data ?? []) as LocalTitleRow[]),
    ])
      .filter((row) => !excluded.has(row.id))
      .sort((a, b) => a.title.localeCompare(b.title) || a.author.localeCompare(b.author))
      .slice(0, 20)
  }

  let builder = supabase
    .from("titles")
    .select(LOCAL_TITLE_SELECT)

  if (title) builder = builder.ilike("title", `%${title}%`)
  if (author) builder = builder.ilike("author", `%${author}%`)

  const { data, error } = await builder
    .order("title", { ascending: true })
    .order("author", { ascending: true })
    .limit(resultLimit)

  if (error) {
    console.error("Error fetching local titles", error)
    return []
  }

  return ((data ?? []) as LocalTitleRow[]).filter((row) => !excluded.has(row.id)).slice(0, 20)
}

export async function searchLocalTitleRows(
  supabase: SupabaseServerClient,
  query: LocalTitleSearchQuery
): Promise<LocalTitleRow[]> {
  const canonicalMatches = await getCanonicalLocalTitleMatches(supabase, query)
  const canonicalTitleIds = canonicalMatches.map((match) => match.titleId)
  const canonicalRows = await getLocalTitleRowsByIds(supabase, canonicalTitleIds)
  const fallbackRows = await getFallbackLocalTitleRows(supabase, query, canonicalTitleIds)

  return uniqueLocalTitleRows([...canonicalRows, ...fallbackRows]).slice(0, 20)
}

export async function getLocalTitleRowsAlphabetical(
  supabase: SupabaseServerClient,
  limit = 50
): Promise<LocalTitleRow[]> {
  const { data, error } = await supabase
    .from("titles")
    .select(LOCAL_TITLE_SELECT)
    .order("title", { ascending: true })
    .order("author", { ascending: true })
    .limit(limit)

  if (error) {
    console.error("Error fetching local titles", error)
    return []
  }

  return (data ?? []) as LocalTitleRow[]
}
