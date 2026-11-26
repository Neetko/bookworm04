import { GENRES, type Genre } from "../titles/catalog"

export const maxUsernameLength = 100
export const maxFavoriteGenres = GENRES.length

export function sanitizeUsername(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function usernameError(value: unknown): string | null {
  const username = sanitizeUsername(value)
  if (!username) return "Username is required"
  if (username.length > maxUsernameLength) return `Username must be ${maxUsernameLength} characters or fewer`
  if (/\p{Cc}/u.test(username)) return "Username cannot contain control characters"
  return null
}

export function normalizeUsername(value: unknown) {
  return sanitizeUsername(value).toLocaleLowerCase()
}

export function isPlaceholderUsername(value: unknown) {
  return /^Bookworm(?:\d{4}|[a-f0-9]{8})$/i.test(sanitizeUsername(value))
}

export function normalizeFavoriteGenres(value: unknown): Genre[] {
  if (!Array.isArray(value) || value.length > maxFavoriteGenres) return []
  return [...new Set(value.filter((genre): genre is Genre =>
    typeof genre === "string" && (GENRES as readonly string[]).includes(genre)
  ))]
}
