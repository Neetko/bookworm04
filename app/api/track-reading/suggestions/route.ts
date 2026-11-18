import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"
import { normalizeSuggestionSearchParams } from "@/lib/validation/title-search"

type SuggestionRow = {
  id: string
  title: string
  author: string
  created_at: string
}

function presentSuggestion(row: SuggestionRow) {
  return { id: row.id, title: row.title, author: row.author }
}

export async function GET(request: Request) {
  let search: ReturnType<typeof normalizeSuggestionSearchParams>
  try {
    search = normalizeSuggestionSearchParams(new URL(request.url).searchParams)
  } catch {
    return NextResponse.json({ results: [], error: "Invalid search input" }, { status: 400 })
  }
  const { title, author, raw, genres } = search

  const hasStructured = Boolean(title || author)
  if (!hasStructured && !raw) {
    return NextResponse.json({ results: [] as Array<{ id: string; title: string; author: string }> })
  }

  const supabase = await createServerClient()

  if (!hasStructured) {
    const makeQuery = (field: "title" | "author") => {
      let query = supabase.from("titles").select("id,title,author,created_at")
        .ilike(field, `%${raw}%`)
      if (genres.length > 0) query = query.contains("genre", genres)
      return query.order("created_at", { ascending: false }).limit(8)
    }

    const [titleMatches, authorMatches] = await Promise.all([
      makeQuery("title"),
      makeQuery("author"),
    ])
    if (titleMatches.error || authorMatches.error) {
      console.error("Suggestions query failed", titleMatches.error ?? authorMatches.error)
      return NextResponse.json({ results: [] }, { status: 200 })
    }

    const uniqueRows = new Map<string, SuggestionRow>()
    for (const row of [...(titleMatches.data ?? []), ...(authorMatches.data ?? [])]) {
      if (!uniqueRows.has(row.id)) uniqueRows.set(row.id, row)
    }
    const results = Array.from(uniqueRows.values())
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
      .slice(0, 8)
      .map(presentSuggestion)
    return NextResponse.json({ results })
  }

  let query = supabase.from("titles").select("id,title,author,created_at")

  if (title) query = query.ilike("title", `%${title}%`)
  if (author) query = query.ilike("author", `%${author}%`)

  if (genres.length > 0) {
    query = query.contains("genre", genres)
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(8)

  if (error) {
    console.error("Suggestions query failed", error)
    return NextResponse.json({ results: [] }, { status: 200 })
  }

  return NextResponse.json({ results: (data ?? []).map(presentSuggestion) })
}
