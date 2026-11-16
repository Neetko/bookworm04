import { cn } from "@/lib/utils"
import { GENRE_BG_CLASS, normalizeGenres, type Genre } from "@/lib/types"

export function TitleGenreDots({
  genres,
  className,
}: {
  genres: readonly Genre[] | null | undefined
  className?: string
}) {
  const normalizedGenres = Array.from(new Set(normalizeGenres(genres)))

  if (normalizedGenres.length === 0) return null

  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1.5", className)}
      aria-label={`Genres: ${normalizedGenres.join(", ")}`}
    >
      {normalizedGenres.map((genre) => (
        <span
          key={genre}
          aria-hidden="true"
          title={genre}
          className={cn("h-2.5 w-2.5 rounded-full ring-1 ring-foreground/15", GENRE_BG_CLASS[genre])}
        />
      ))}
    </span>
  )
}
