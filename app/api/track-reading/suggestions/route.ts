import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"
import { isGenre } from "@/lib/types"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = (searchParams.get("title") ?? "").trim()
  const author = (searchParams.get("author") ?? "").trim()
  const q = (searchParams.get("q") ?? "").trim()
  const genresParam = searchParams.get("genres") ?? ""
  const genres = genresParam
    ? genresParam
        .split(",")
        .map((value) => value.trim())
        .filter(isGenre)
    : []

  const hasStructured = Boolean(title || author)
  if (!hasStructured && !q) {
    return NextResponse.json({ results: [] as Array<{ id: string; title: string; author: string }> })
  }

  const supabase = await createServerClient()

  let query = supabase.from("titles").select("id,title,author")

  if (hasStructured) {
    if (title) query = query.ilike("title", `%${title}%`)
    if (author) query = query.ilike("author", `%${author}%`)
  } else {
    query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%`)
  }

  if (genres.length > 0) {
    query = query.contains("genre", genres)
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(8)

  if (error) {
    console.error("Suggestions query failed", error)
    return NextResponse.json({ results: [] }, { status: 200 })
  }

  return NextResponse.json({ results: data ?? [] })
}
