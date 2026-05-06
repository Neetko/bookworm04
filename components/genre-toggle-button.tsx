import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  GENRE_BG_CLASS,
  GENRE_BORDER_CLASS,
  GENRE_HOVER_BG_TINT_CLASS,
  type Genre,
} from "@/lib/types"

export function GenreToggleButton({
  genre,
  selected,
  onToggle,
  className,
  showSuggestedIndicator = false,
}: {
  genre: Genre
  selected: boolean
  onToggle: (genre: Genre) => void
  className?: string
  showSuggestedIndicator?: boolean
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => onToggle(genre)}
      className={cn(
        "shrink-0 h-7 justify-center rounded-xl px-2 text-xs whitespace-nowrap",
        selected
          ? cn(
              GENRE_BG_CLASS[genre],
              GENRE_HOVER_BG_TINT_CLASS[genre],
              showSuggestedIndicator ? GENRE_BORDER_CLASS[genre] : "border-transparent",
              "text-foreground"
            )
          : cn(
              "bg-background text-foreground",
              GENRE_HOVER_BG_TINT_CLASS[genre],
              showSuggestedIndicator ? GENRE_BORDER_CLASS[genre] : null
            ),
        className
      )}
    >
      <span>{genre}</span>
    </Button>
  )
}
