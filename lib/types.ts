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

export const GENRE_BORDER_CLASS: Record<Genre, string> = {
  HORROR: "border-red-500",
  ROMANCE: "border-pink-500",
  FANTASY: "border-green-500",
  "SCI-FI": "border-blue-500",
  ADVENTURE: "border-yellow-500",
  MYSTERY: "border-purple-500",
  "NON-FICTION": "border-cyan-500",
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
}
