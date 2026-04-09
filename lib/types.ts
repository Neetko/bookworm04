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

// Base (active) background color per genre.
export const GENRE_BG_CLASS: Record<Genre, string> = {
  HORROR: "bg-red-500/65",
  ROMANCE: "bg-pink-500/65",
  FANTASY: "bg-green-500/65",
  "SCI-FI": "bg-blue-500/65",
  ADVENTURE: "bg-yellow-500/65",
  MYSTERY: "bg-purple-500/65",
  "NON-FICTION": "bg-cyan-500/65",
} as const

// Hover tint (faint) for buttons.
export const GENRE_HOVER_BG_TINT_CLASS: Record<Genre, string> = {
  HORROR: "hover:bg-red-500/55",
  ROMANCE: "hover:bg-pink-500/45",
  FANTASY: "hover:bg-green-500/45",
  "SCI-FI": "hover:bg-blue-500/45",
  ADVENTURE: "hover:bg-yellow-500/45",
  MYSTERY: "hover:bg-purple-500/45",
  "NON-FICTION": "hover:bg-cyan-500/45",
} as const

export function isGenre(value: unknown): value is Genre {
  return typeof value === "string" && (GENRES as readonly string[]).includes(value)
}

export function normalizeGenres(value: unknown): Genre[] {
  if (Array.isArray(value)) return value.filter(isGenre)
  if (isGenre(value)) return [value]
  return []
}

export interface Book {
  id: string
  title_id?: string | null
  title: string
  author: string
  description: string | null
  cover_image_url: string | null
  genre: Genre[] | null
  published_year: number | null
  isbn: string | null
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  auth_user_id?: string | null
  username: string | null
  email: string | null
  avatar_url: string | null
  bio: string | null
  role?: string | null
  signature?: string | null
  signature_image?: string | null
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  user_id: string
  book_id: string
  rating: number
  review_text: string | null
  created_at: string
  updated_at: string
  user_profiles?: UserProfile
  books?: Book
}

export interface Favorite {
  id: string
  user_id: string
  book_id: string
  created_at: string
  books?: Book
}

export interface BookContent {
  id: string
  book_id: string
  content: string
  created_at: string
  updated_at: string
}

export type SearchTitleResult = {
  id: string
  source: "local" | "google"
  titleId?: string
  volumeId?: string
  title: string
  author: string
  description: string | null
  coverImageUrl: string | null
  genres?: Genre[]
  engagement: number
  claimed: boolean
}
