import { isGenre, type Genre } from "@/lib/types"

export const MAX_TITLE_SEARCH_TEXT_LENGTH = 200
const MAX_TITLE_SEARCH_GENRES = 32

export type SearchTitlesInput =
  | {
      title?: string
      author?: string
      raw?: string
      genres?: Genre[]
      includeExternal?: boolean
    }
  | string

export type NormalizedSearch = {
  title: string
  author: string
  raw: string
  genres: Genre[]
  includeExternal: boolean
}

function searchText(value: unknown): string {
  if (value == null) return ""
  if (typeof value !== "string") throw new Error("Invalid title search input")
  if (value.length > MAX_TITLE_SEARCH_TEXT_LENGTH) {
    throw new Error(`Search text must be ${MAX_TITLE_SEARCH_TEXT_LENGTH} characters or fewer`)
  }
  return value.trim()
}

export function normalizeSearchInput(input: unknown): NormalizedSearch {
  if (typeof input === "string") {
    return { title: "", author: "", raw: searchText(input), genres: [], includeExternal: false }
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid title search input")
  }

  const values = input as Record<string, unknown>
  const genres = values.genres ?? []
  if (!Array.isArray(genres) || genres.length > MAX_TITLE_SEARCH_GENRES) {
    throw new Error("Invalid title search genres")
  }

  return {
    title: searchText(values.title),
    author: searchText(values.author),
    raw: searchText(values.raw),
    genres: genres.filter(isGenre),
    includeExternal: values.includeExternal === true,
  }
}
