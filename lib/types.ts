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

export const GENRE_DOT_CLASS: Record<Genre, string> = {
  HORROR: "bg-red-500",
  ROMANCE: "bg-pink-500",
  FANTASY: "bg-green-500",
  "SCI-FI": "bg-blue-500",
  ADVENTURE: "bg-yellow-500",
  MYSTERY: "bg-purple-500",
  "NON-FICTION": "bg-cyan-500",
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

export interface Bookmark {
  id: string
  user_id: string
  book_id: string
  created_at: string
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
