"use server"

import { createServerClient } from "@/lib/supabase-server"
import { searchGoogleBooksWithOpenLibrary } from "@/lib/google-books"
import type { SearchTitleResult } from "@/lib/types"

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
      includeExternal?: boolean
    }
  | string

type NormalizedSearch = {
  title: string
  author: string
  raw: string
  includeExternal: boolean
}

function normalizeSearchInput(input: SearchTitlesInput): NormalizedSearch {
  if (typeof input === "string") {
    const raw = input.trim()
    return { title: "", author: "", raw, includeExternal: false }
  }

  return {
    title: (input.title ?? "").trim(),
    author: (input.author ?? "").trim(),
    raw: (input.raw ?? "").trim(),
    includeExternal: Boolean(input.includeExternal),
  }
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

  const { title, author, raw, includeExternal } = normalizeSearchInput(input)
  const hasStructured = Boolean(title || author)
  const hasAnyQuery = hasStructured || Boolean(raw)

  if (!hasAnyQuery) return []

  const googleQuery = hasStructured
    ? [title ? `intitle:${title}` : null, author ? `inauthor:${author}` : null]
        .filter(Boolean)
        .join(" ")
    : raw

  const [localBooks, googleBooks] = await Promise.all([
    getLocalBooks(supabase, { title, author, raw, includeExternal }),
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
      engagement,
      claimed: true,
    }
  })

  const googleResults: SearchTitleResult[] = googleBooks.map((book) => {
    const titleId = titleSourceMap.get(book.volumeId)
    const engagement = titleId
      ? (reviewCounts.get(titleId) ?? 0) + (postCounts.get(titleId) ?? 0)
      : 0

    return {
      id: book.volumeId,
      source: "google",
      titleId,
      volumeId: book.volumeId,
      title: book.title,
      author: book.authors[0] ?? "Unknown author",
      description: book.description ?? null,
      coverImageUrl: book.thumbnailUrl ?? null,
      engagement,
      claimed: Boolean(titleId),
    }
  })

  const combined = [...localResults, ...googleResults]
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

  const hasCover = (result: SearchTitleResult) => Boolean(result.coverImageUrl)

  for (const result of combined) {
    const key = buildKey(result)
    const existing = deduped.get(key)
    if (!existing) {
      deduped.set(key, result)
      continue
    }

    if (existing.claimed !== result.claimed) {
      deduped.set(key, existing.claimed ? existing : result)
      continue
    }

    if (existing.engagement !== result.engagement) {
      deduped.set(key, existing.engagement >= result.engagement ? existing : result)
      continue
    }

    if (hasCover(existing) !== hasCover(result)) {
      deduped.set(key, hasCover(existing) ? existing : result)
      continue
    }

    if (existing.source !== result.source) {
      deduped.set(key, existing.source === "local" ? existing : result)
      continue
    }
  }

  const compareResults = (a: SearchTitleResult, b: SearchTitleResult) => {
    const aHasCover = Boolean(a.coverImageUrl)
    const bHasCover = Boolean(b.coverImageUrl)
    if (aHasCover !== bHasCover) return aHasCover ? -1 : 1
    if (a.claimed !== b.claimed) return a.claimed ? -1 : 1
    if (b.engagement !== a.engagement) return b.engagement - a.engagement
    return a.title.localeCompare(b.title)
  }

  const dedupedResults = Array.from(deduped.values())

  if (includeExternal && localResults.length > 0) {
    const localSorted = dedupedResults
      .filter((result) => result.source === "local")
      .sort(compareResults)
    const externalSorted = dedupedResults
      .filter((result) => result.source !== "local")
      .sort(compareResults)
    return [...localSorted, ...externalSorted]
  }

  return dedupedResults.sort(compareResults)
}
