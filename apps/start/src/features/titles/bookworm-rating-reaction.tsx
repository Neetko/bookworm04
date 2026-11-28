import { BookwormSprite, type BookwormRatingBand } from "./bookworm-sprite"
import styles from "./bookworm-rating-reaction.module.css"

const RATING_PHRASES: Record<BookwormRatingBand, readonly [string, string]> = {
  "1-2": ["That bad, huh?", "Yikes..."],
  "3-4": ["I sleep", "Not impressed ..."],
  "5-6": ["Pretty neat", "I approve"],
  "7-8": ["Finally some good food", "Awesome!"],
  "9-10": ["Banger alert!", "That's the stuff!"],
}

export function BookwormRatingReaction({ ratingBand }: { ratingBand: BookwormRatingBand }) {
  const [firstPhrase, secondPhrase] = RATING_PHRASES[ratingBand]
  return <span className={styles.reaction} data-rating-band={ratingBand}>
    <span aria-hidden="true" className={styles.annotation}>
      <span className={`${styles.phrase} ${styles.phraseFirst}`}>{firstPhrase}</span>
      <span className={`${styles.phrase} ${styles.phraseSecond}`}>{secondPhrase}</span>
    </span>
    <BookwormSprite animation="rating" ratingBand={ratingBand} />
  </span>
}
