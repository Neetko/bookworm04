import { GenreToggleButton } from "@/components/genre-toggle-button"
import { GENRES, type Genre } from "@/lib/types"
import { cn } from "@/lib/utils"

type CanonGenreToggleGroupProps = {
  selectedGenres: readonly Genre[]
  onToggle: (genre: Genre) => void
  className?: string
  buttonClassName?: string | ((genre: Genre) => string | undefined)
  showSuggestedIndicator?: (genre: Genre) => boolean
}

export function CanonGenreToggleGroup({
  selectedGenres,
  onToggle,
  className,
  buttonClassName,
  showSuggestedIndicator,
}: CanonGenreToggleGroupProps) {
  return (
    <div className={cn("flex flex-nowrap gap-2 w-full", className)}>
      {GENRES.map((genre) => (
        <GenreToggleButton
          key={genre}
          genre={genre}
          selected={selectedGenres.includes(genre)}
          onToggle={onToggle}
          className={typeof buttonClassName === "function" ? buttonClassName(genre) : buttonClassName}
          showSuggestedIndicator={showSuggestedIndicator?.(genre) ?? false}
        />
      ))}
    </div>
  )
}
