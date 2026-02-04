"use server"

import { createServerClient } from "@/lib/supabase-server"
import { searchGoogleBooks } from "@/lib/google-books"
import type { Book, SearchTitleResult } from "@/lib/types"

type LocalBookRow = Book & { title_id?: string | null }

async function getLocalBooks(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  query: string
): Promise<LocalBookRow[]> {
  const q = query.trim()
  if (!q) return []

  const { data, error } = await supabase
    .from("books")
    .select("id,title_id,title,author,description,cover_image_url,genre,published_year,isbn,created_at,updated_at")
    .or(`title.ilike.%${q}%,author.ilike.%${q}%`)
    .order("title", { ascending: true })
    .order("author", { ascending: true })
    .limit(20)

  if (error) {
    console.error("Error fetching local books", error)
    return []
  }

  return (data ?? []) as LocalBookRow[]
}

export async function searchTitles(query: string): Promise<SearchTitleResult[]> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Unauthorized")

  const trimmed = query.trim()
  if (!trimmed) return []

  const [localBooks, googleBooks] = await Promise.all([
    getLocalBooks(supabase, trimmed),
    searchGoogleBooks(trimmed),
  ])

  const volumeIds = googleBooks.map((book) => book.volumeId)
  const titleSourceMap = new Map<string, string>()

  if (volumeIds.length > 0) {
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

  const localTitleIds = localBooks.map((book) => book.title_id ?? book.id)
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
    const titleId = book.title_id ?? book.id
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

  return [...localResults, ...googleResults].sort((a, b) => {
    if (a.claimed !== b.claimed) return a.claimed ? -1 : 1
    if (b.engagement !== a.engagement) return b.engagement - a.engagement
    return a.title.localeCompare(b.title)
  })
}
