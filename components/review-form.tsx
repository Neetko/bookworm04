"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { RichTextEditor } from "@/components/rich-text-editor"
import { getMyReview, submitReview } from "@/app/actions/reviews"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { getTitleReadStatus } from "@/app/actions/title"
import {
  BookwormSprite,
  type BookwormRatingBand,
} from "@/components/mascot/bookworm-sprite"
import { BookwormRatingReaction } from "@/components/mascot/bookworm-rating-reaction"
import styles from "./review-form.module.css"

interface ReviewFormProps {
  titleId: string
  canWrite?: boolean
}

function getRatingBand(rating: number): BookwormRatingBand | null {
  if (rating <= 0) return null
  if (rating <= 2) return "1-2"
  if (rating <= 4) return "3-4"
  if (rating <= 6) return "5-6"
  if (rating <= 8) return "7-8"
  return "9-10"
}

const RATING_LABELS: Record<BookwormRatingBand, string> = {
  "1-2": "Not for me",
  "3-4": "Underwhelming",
  "5-6": "Pretty neat",
  "7-8": "Great read",
  "9-10": "Outstanding",
}

export function ReviewForm({ titleId, canWrite: canWriteProp }: ReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [focusRating, setFocusRating] = useState<number | null>(null)
  const [reviewHtml, setReviewHtml] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [canWriteState, setCanWriteState] = useState(false)
  const [hasExistingReview, setHasExistingReview] = useState(false)
  const router = useRouter()

  const canWrite = canWriteProp ?? canWriteState
  const interactionRating = hoverRating ?? focusRating
  const previewRating = interactionRating ?? rating
  const interactionBand = getRatingBand(interactionRating ?? 0)
  const selectedBand = getRatingBand(rating)
  const displayBand = interactionBand ?? selectedBand

  useEffect(() => {
    if (canWriteProp !== undefined) return
    let cancelled = false
    ;(async () => {
      try {
        const ok = await getTitleReadStatus(titleId)
        if (!cancelled) setCanWriteState(ok)
      } catch {
        if (!cancelled) setCanWriteState(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [titleId, canWriteProp])

  useEffect(() => {
    if (!canWrite) return
    let cancelled = false
    ;(async () => {
      try {
        const existing = await getMyReview(titleId)
        if (cancelled) return
        if (existing) {
          setHasExistingReview(true)
          setRating(existing.rating ?? 0)
          setReviewHtml(existing.review_text ?? "")
        }
      } catch {
        if (!cancelled) setHasExistingReview(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [titleId, canWrite])

  const handleSubmit = async () => {
    if (!canWrite) {
      toast.error("You must mark this title as read to write a review")
      return
    }
    if (rating === 0) {
      toast.error("Please select a rating")
      return
    }

    setIsSubmitting(true)
    try {
      await submitReview(titleId, rating, reviewHtml)
      toast.success("Review saved")
      setHasExistingReview(true)
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error("Failed to submit review")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className={styles.composer} aria-labelledby="review-composer-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Your take</p>
          <h2 className={styles.title} id="review-composer-title">Rate this title</h2>
        </div>
        <div className={styles.readout} aria-live="polite">
          <span className={styles.readoutScore}>{previewRating || "—"}<small>/10</small></span>
          <span className={styles.readoutLabel}>
            {displayBand ? RATING_LABELS[displayBand] : "Choose a score"}
          </span>
        </div>
      </header>

      {!canWrite ? (
        <p className="font-ui text-sm text-muted-foreground">
          Log in and mark this title as read to write a review.
        </p>
      ) : null}

      {canWrite ? (
        <>
          <div className={styles.ratingLayout}>
            <fieldset className={styles.selector}>
              <legend className={styles.legend}>Score from 1 to 10</legend>
              <div
                className={styles.scoreGrid}
                onPointerCancel={() => setHoverRating(null)}
                onPointerLeave={() => setHoverRating(null)}
              >
                {[...Array(10)].map((_, index) => {
                  const value = index + 1
                  return (
                    <label
                      className={styles.scoreOption}
                      data-current={rating === value}
                      data-previewed={value <= previewRating}
                      key={value}
                      onPointerEnter={() => setHoverRating(value)}
                    >
                      <input
                        checked={rating === value}
                        className={styles.scoreInput}
                        name={`rating-${titleId}`}
                        onBlur={() => setFocusRating(null)}
                        onChange={() => setRating(value)}
                        onFocus={() => setFocusRating(value)}
                        type="radio"
                        value={value}
                      />
                      <span className={styles.scoreFace}>
                        <span className={styles.scoreNumber}>{value}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
              <div className={styles.scaleLabels} aria-hidden="true">
                <span>rough</span>
                <span>solid</span>
                <span>all-time</span>
              </div>
            </fieldset>

            <div className={styles.reactionStage} aria-hidden="true">
              <span className={styles.previewLabel}>
                {interactionRating
                  ? `Previewing ${interactionRating}/10`
                  : rating
                    ? `Your verdict: ${rating}/10`
                    : "Mascot preview"}
              </span>
              <div className={styles.reactionCanvas}>
                {displayBand ? (
                  <BookwormRatingReaction
                    key={displayBand}
                    ratingBand={displayBand}
                  />
                ) : (
                  <BookwormSprite
                    animated
                    animation="idle"
                    key="idle"
                    size="sm"
                  />
                )}
              </div>
            </div>
          </div>

          <div className={styles.reviewField}>
            <label className={styles.reviewLabel}>Your review</label>
            <RichTextEditor
              value={reviewHtml}
              onChange={(html) => {
                setReviewHtml(html)
              }}
              placeholder="What stayed with you?"
              disabled={!canWrite}
            />
          </div>

          <footer className={styles.footer}>
            <p className={styles.saveNote}>
              {hasExistingReview
                ? "Saving will replace your previous rating and review."
                : "You can come back and revise this later."}
            </p>
            <Button onClick={handleSubmit} disabled={isSubmitting || !canWrite}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {hasExistingReview ? "Update review" : "Publish review"}
            </Button>
          </footer>
        </>
      ) : null}
    </section>
  )
}
