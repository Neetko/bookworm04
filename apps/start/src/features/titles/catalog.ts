export const GENRES = [
  "HORROR",
  "ROMANCE",
  "FANTASY",
  "SCI-FI",
  "ADVENTURE",
  "MYSTERY",
  "NON-FICTION",
] as const

export type Genre = (typeof GENRES)[number]

export type CatalogSearch = {
  q: string
  title: string
  author: string
  genres: string
  includeExternal: boolean
}

export type CatalogTitle = {
  id: string
  title: string
  author: string
  description: string | null
  coverUrl: string | null
  year: number | null
  genres: Genre[]
}

export type CatalogReview = {
  id: string
  rating: number
  html: string
  createdAt: string
  userId: string | null
  username: string | null
  likesCount: number
  viewerHasLiked: boolean
}

export type CatalogDiscussionPost = {
  id: string
  html: string
  createdAt: string
  userId: string | null
  username: string | null
  avatarUrl: string | null
  role: string | null
  joinedAt: string | null
  likesCount: number
  viewerHasLiked: boolean
}

export type CatalogDetail = CatalogTitle & {
  reviews: CatalogReview[]
  discussionPosts: CatalogDiscussionPost[]
  shop: {
    amazonUrl: string
    audibleUrl: string
  }
  viewer: {
    signedIn: boolean
    isRead: boolean
    review: {
      id: string
      rating: number
      html: string
    } | null
    progress: {
      mode: "pages" | "audiobook"
      currentPage: number
      totalPages: number
      minutesListened: number
      totalMinutes: number
      percent: number
    } | null
    todayNote: string
  }
}

export function isGenre(value: unknown): value is Genre {
  return typeof value === "string" && (GENRES as readonly string[]).includes(value)
}

export function normalizeGenres(value: unknown): Genre[] {
  const values = typeof value === "string" ? value.slice(0, 500).split(",") : []
  return [...new Set(values.map((item) => item.trim()).filter(isGenre))]
}

export function normalizeCatalogSearch(raw: unknown): CatalogSearch {
  const source = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {}
  const bounded = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 100) : ""
  const title = bounded(source.title)
  const q = title ? "" : bounded(source.q)
  const author = bounded(source.author)
  const genres = normalizeGenres(source.genres).join(",")
  const includeExternal = source.includeExternal === true || source.includeExternal === "1" || source.includeExternal === "true"
  return { q, title, author, genres, includeExternal }
}
