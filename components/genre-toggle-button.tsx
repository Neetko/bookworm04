import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  GENRE_BG_CLASS,
  GENRE_HOVER_BG_TINT_CLASS,
  type Genre,
} from "@/lib/types"

export function GenreToggleButton({
  genre,
  selected,
  onToggle,
  className,
}: {
  genre: Genre
  selected: boolean
  onToggle: (genre: Genre) => void
  className?: string
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => onToggle(genre)}
      className={cn(
        "min-w-0 justify-center rounded-xl px-2 whitespace-nowrap",
        selected
          ? cn(
              GENRE_BG_CLASS[genre],
              GENRE_HOVER_BG_TINT_CLASS[genre],
              "border-transparent text-foreground"
            )
          : cn(
              "bg-background text-foreground",
              GENRE_HOVER_BG_TINT_CLASS[genre]
            ),
        className
      )}
    >
      <span className="truncate">{genre}</span>
    </Button>
  )
}
