import { createRequestSupabaseClient } from "../../server/supabase.server"
import { normalizeGenres } from "./catalog"

const json = (body: unknown, status = 200) => Response.json(body, { status })
const bounded = (value: string | null) => (value ?? "").trim().slice(0, 100)

export async function handleTitleSuggestions(request: Request) {
  const params = new URL(request.url).searchParams
  const title = bounded(params.get("title"))
  const author = bounded(params.get("author"))
  const raw = bounded(params.get("raw") ?? params.get("q"))
  const genres = normalizeGenres(params.get("genres"))
  if (!title && !author && !raw) return json({ results: [] })
  const supabase = createRequestSupabaseClient()
  const base = () => supabase.from("titles").select("id,title,author,created_at")
  const withGenres = (query: ReturnType<typeof base>) => genres.length ? query.contains("genre", genres) : query
  if (raw && !title && !author) {
    const [byTitle, byAuthor] = await Promise.all([
      withGenres(base().ilike("title", `%${raw}%`)).order("created_at", { ascending: false }).limit(8),
      withGenres(base().ilike("author", `%${raw}%`)).order("created_at", { ascending: false }).limit(8),
    ])
    if (byTitle.error || byAuthor.error) return json({ results: [] })
    const unique = new Map<string, { id: string; title: string; author: string; created_at: string }>()
    for (const row of [...(byTitle.data ?? []), ...(byAuthor.data ?? [])]) unique.set(row.id, row)
    return json({ results: [...unique.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8).map(({ id, title, author }) => ({ id, title, author })) })
  }
  let query = withGenres(base())
  if (title) query = query.ilike("title", `%${title}%`)
  if (author) query = query.ilike("author", `%${author}%`)
  const { data, error } = await query.order("created_at", { ascending: false }).limit(8)
  return json({ results: error ? [] : (data ?? []).map(({ id, title, author: name }) => ({ id, title, author: name })) })
}
