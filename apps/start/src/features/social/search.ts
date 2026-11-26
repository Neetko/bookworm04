export type CommunitySearch = {
  q: string
  t: string
  genres: string
}

export function normalizeCommunitySearch(input: unknown): CommunitySearch {
  const source = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {}
  const q = typeof source.q === "string" ? source.q.trim().slice(0, 100) : ""
  const types = typeof source.t === "string" ? source.t.slice(0, 100).split(",") : []
  const t = [...new Set(types.map((type) => type.trim()).filter((type) => type === "book" || type === "writer"))].join(",")
  const genreValues = typeof source.genres === "string" ? source.genres.slice(0, 500).split(",") : []
  const genres = [...new Set(genreValues.map((genre) => genre.trim()).filter(Boolean).slice(0, 10))].join(",")
  return { q, t, genres }
}
