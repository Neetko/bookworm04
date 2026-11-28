import styles from "./bookworm-sprite.module.css"

export type BookwormRatingBand = "1-2" | "3-4" | "5-6" | "7-8" | "9-10"

type BookwormSpriteProps = {
  animation?: "idle" | "rating"
  ratingBand?: BookwormRatingBand
  label?: string
}

const RATING_DIRECTORIES: Record<Exclude<BookwormRatingBand, "9-10">, string> = {
  "1-2": "poor",
  "3-4": "bored",
  "5-6": "average",
  "7-8": "great",
}

export function BookwormSprite({
  animation = "idle",
  ratingBand = "5-6",
  label,
}: BookwormSpriteProps) {
  const usesExcitedAtlas = animation === "rating" && ratingBand === "9-10"
  const asset = animation === "idle"
    ? "/mascot/idle-v6/atlas.webp"
    : usesExcitedAtlas
      ? "/mascot/excited/atlas.webp"
      : `/mascot/rating-emotes/${RATING_DIRECTORIES[ratingBand as Exclude<BookwormRatingBand, "9-10">]}/atlas.webp`
  const dimensions = usesExcitedAtlas
    ? { width: 1920, height: 1440 }
    : { width: 1280, height: 480 }
  const usesLayeredPoorReaction = animation === "rating" && ratingBand === "1-2"
  const atlasClassName = usesExcitedAtlas
    ? `${styles.atlas} ${styles.excitedAtlas}`
    : animation === "rating"
      ? `${styles.atlas} ${styles.ratingAtlas}`
      : `${styles.atlas} ${styles.idleAtlas}`

  return <span
    aria-label={label ?? (animation === "rating"
      ? `The Bookworm mascot reacting to a ${ratingBand} out of 10 rating`
      : "The Bookworm mascot wearing reading glasses")}
    className={`${styles.sprite} ${styles.sm}`}
    data-animation={animation}
    data-rating-band={animation === "rating" ? ratingBand : undefined}
    role="img"
  >
    <span aria-hidden="true" className={styles.shadow} />
    <span aria-hidden="true" className={styles.motionLayer}>
      {usesLayeredPoorReaction ? <>
        <img alt="" className={`${atlasClassName} ${styles.poorRecoilAtlas}`} draggable={false} height={dimensions.height} src={asset} width={dimensions.width} />
        <img alt="" className={`${atlasClassName} ${styles.poorGazeAtlas}`} draggable={false} height={dimensions.height} src={asset} width={dimensions.width} />
      </> : <img alt="" className={atlasClassName} draggable={false} height={dimensions.height} src={asset} width={dimensions.width} />}
    </span>
  </span>
}
