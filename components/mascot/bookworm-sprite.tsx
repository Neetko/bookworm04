import Image from "next/image"
import { cn } from "@/lib/utils"
import styles from "./bookworm-sprite.module.css"

type BookwormSpriteProps = {
  className?: string
  label?: string
  priority?: boolean
  animated?: boolean
  bodyMotion?: boolean
  animation?: BookwormAnimation
  ratingBand?: BookwormRatingBand
  size?: "sm" | "md" | "lg"
  color?: BookwormColor
}

export type BookwormAnimation = "idle" | "excited" | "rating"

export type BookwormRatingBand = "1-2" | "3-4" | "5-6" | "7-8" | "9-10"

export type BookwormColor =
  | "neutral"
  | "blue"
  | "light-blue"
  | "green"
  | "yellow"
  | "red"
  | "purple"
  | "hot-pink"

const ANIMATION_ASSETS: Record<Exclude<BookwormAnimation, "rating">, Record<BookwormColor, string>> = {
  idle: {
    neutral: "/mascot/idle-v6/atlas.webp",
    blue: "/mascot/idle-v6/atlas-blue.webp",
    "light-blue": "/mascot/idle-v6/atlas-light-blue.webp",
    green: "/mascot/idle-v6/atlas-green.webp",
    yellow: "/mascot/idle-v6/atlas-yellow.webp",
    red: "/mascot/idle-v6/atlas-red.webp",
    purple: "/mascot/idle-v6/atlas-purple.webp",
    "hot-pink": "/mascot/idle-v6/atlas-hot-pink.webp",
  },
  excited: {
    neutral: "/mascot/excited/atlas.webp",
    blue: "/mascot/excited/atlas-blue.webp",
    "light-blue": "/mascot/excited/atlas-light-blue.webp",
    green: "/mascot/excited/atlas-green.webp",
    yellow: "/mascot/excited/atlas-yellow.webp",
    red: "/mascot/excited/atlas-red.webp",
    purple: "/mascot/excited/atlas-purple.webp",
    "hot-pink": "/mascot/excited/atlas-hot-pink.webp",
  },
}

const ANIMATION_DIMENSIONS: Record<Exclude<BookwormAnimation, "rating">, { width: number; height: number }> = {
  idle: { width: 1280, height: 480 },
  excited: { width: 1920, height: 1440 },
}

const RATING_DIRECTORIES: Record<Exclude<BookwormRatingBand, "9-10">, string> = {
  "1-2": "poor",
  "3-4": "bored",
  "5-6": "average",
  "7-8": "great",
}

const COLOR_LABELS: Record<BookwormColor, string> = {
  neutral: "pink",
  blue: "blue",
  "light-blue": "light blue",
  green: "green",
  yellow: "yellow",
  red: "red",
  purple: "purple",
  "hot-pink": "hot pink",
}

export function BookwormSprite({
  className,
  label,
  priority = false,
  animated = true,
  bodyMotion = true,
  animation = "idle",
  ratingBand = "5-6",
  size = "md",
  color = "neutral",
}: BookwormSpriteProps) {
  const usesExcitedRating = animation === "rating" && ratingBand === "9-10"
  const resolvedAnimation = animation === "rating"
    ? (usesExcitedRating ? "excited" : "rating")
    : animation
  const asset = animation === "rating"
    ? usesExcitedRating
      ? ANIMATION_ASSETS.excited[color]
      : `/mascot/rating-emotes/${RATING_DIRECTORIES[ratingBand as Exclude<BookwormRatingBand, "9-10">]}/atlas${color === "neutral" ? "" : `-${color}`}.webp`
    : ANIMATION_ASSETS[animation][color]
  const dimensions = resolvedAnimation === "rating"
    ? { width: 1280, height: 480 }
    : ANIMATION_DIMENSIONS[resolvedAnimation]
  const usesLayeredPoorReaction = animation === "rating" && ratingBand === "1-2"
  const atlasClassName = cn(
    styles.atlas,
    resolvedAnimation === "idle"
      ? styles.idleAtlas
      : resolvedAnimation === "rating"
        ? styles.ratingAtlas
        : styles.excitedAtlas,
  )
  const accessibleLabel = label
    ?? (animation === "rating"
      ? `A ${COLOR_LABELS[color]} bookworm reacting to a ${ratingBand} out of 10 rating`
      : `${animation === "excited" ? "An excited" : "A calm"} ${COLOR_LABELS[color]} bookworm wearing reading glasses`)

  return (
    <span
      aria-label={accessibleLabel}
      className={cn(styles.sprite, styles[size], className)}
      data-animated={animated}
      data-animation={animation}
      data-body-motion={bodyMotion}
      data-rating-band={animation === "rating" ? ratingBand : undefined}
      role="img"
    >
      <span aria-hidden="true" className={styles.shadow} />
      <span aria-hidden="true" className={styles.motionLayer}>
        {usesLayeredPoorReaction ? (
          <>
            <Image
              aria-hidden="true"
              alt=""
              className={cn(atlasClassName, styles.poorRecoilAtlas)}
              draggable={false}
              height={dimensions.height}
              priority={priority}
              src={asset}
              unoptimized
              width={dimensions.width}
            />
            <Image
              aria-hidden="true"
              alt=""
              className={cn(atlasClassName, styles.poorGazeAtlas)}
              draggable={false}
              height={dimensions.height}
              priority={priority}
              src={asset}
              unoptimized
              width={dimensions.width}
            />
          </>
        ) : (
          <Image
            aria-hidden="true"
            alt=""
            className={atlasClassName}
            draggable={false}
            height={dimensions.height}
            priority={priority}
            src={asset}
            unoptimized
            width={dimensions.width}
          />
        )}
      </span>
    </span>
  )
}
