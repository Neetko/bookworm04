import type { Genre } from "@/lib/types"

export function hasEverySelectedGenre(
  titleGenres: readonly Genre[] | null | undefined,
  selectedGenres: readonly Genre[]
) {
  if (selectedGenres.length === 0) return true
  if (!titleGenres) return false

  return selectedGenres.every((genre) => titleGenres.includes(genre))
}
