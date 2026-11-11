import { cn } from "@/lib/utils"
import {
  BookwormSprite,
  type BookwormColor,
  type BookwormRatingBand,
} from "./bookworm-sprite"
import styles from "./bookworm-rating-reaction.module.css"

export const BOOKWORM_RATING_PHRASES: Record<BookwormRatingBand, readonly [string, string]> = {
  "1-2": ["That bad, huh?", "Yikes..."],
  "3-4": ["I sleep", "Not impressed ..."],
  "5-6": ["Pretty neat", "I approve"],
  "7-8": ["Finally some good food", "Awesome!"],
  "9-10": ["Banger alert!", "That's the stuff!"],
}

type BookwormRatingReactionProps = {
  className?: string
  color?: BookwormColor
  ratingBand: BookwormRatingBand
}

export function BookwormRatingReaction({
  className,
  color = "neutral",
  ratingBand,
}: BookwormRatingReactionProps) {
  const [firstPhrase, secondPhrase] = BOOKWORM_RATING_PHRASES[ratingBand]

  return (
    <span
      className={cn(styles.reaction, className)}
      data-rating-band={ratingBand}
    >
      <span aria-hidden="true" className={styles.annotation}>
        <span className={cn(styles.phrase, styles.phraseFirst)}>{firstPhrase}</span>
        <span className={cn(styles.phrase, styles.phraseSecond)}>{secondPhrase}</span>
      </span>
      <BookwormSprite
        animated
        animation="rating"
        color={color}
        ratingBand={ratingBand}
        size="sm"
      />
    </span>
  )
}
