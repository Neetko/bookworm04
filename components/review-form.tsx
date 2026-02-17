"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { RichTextEditor } from "@/components/rich-text-editor"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { submitReview } from "@/app/actions/reviews"
import { toast } from "sonner"
import { Star, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { getTitleReadStatus } from "@/app/actions/title"

interface ReviewFormProps {
  titleId: string
  canWrite?: boolean
}

export function ReviewForm({ titleId, canWrite: canWriteProp }: ReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [reviewHtml, setReviewHtml] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [canWriteState, setCanWriteState] = useState(false)
  const router = useRouter()

  const canWrite = canWriteProp ?? canWriteState

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
      toast.success("Review submitted successfully")
      setRating(0)
      setReviewHtml("")
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error("Failed to submit review")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rate This Book</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canWrite ? (
          <p className="text-sm text-muted-foreground">
            Log in and mark this title as read to write a review.
          </p>
        ) : null}
        {canWrite ? (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Your Rating</label>
              <div className="flex gap-1 flex-wrap">
                {[...Array(10)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setRating(i + 1)}
                    className="focus:outline-none transition-colors"
                    disabled={!canWrite}
                  >
                    <Star
                      className={`h-6 w-6 ${
                        i < rating
                          ? "fill-primary text-primary"
                          : "text-muted hover:text-primary/50"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Rate from 1-10</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Your Review</label>
              <RichTextEditor
                value={reviewHtml}
                onChange={(html) => {
                  setReviewHtml(html)
                }}
                placeholder="Share your thoughts about this book..."
                disabled={!canWrite}
              />
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting || !canWrite}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Review
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
