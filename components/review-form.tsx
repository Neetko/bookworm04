"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { submitReview } from "@/app/actions/reviews"
import { toast } from "sonner"
import { Star, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface ReviewFormProps {
  bookId: string
}

export function ReviewForm({ bookId }: ReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating")
      return
    }

    setIsSubmitting(true)
    try {
      await submitReview(bookId, rating, reviewText)
      toast.success("Review submitted successfully")
      setRating(0)
      setReviewText("")
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
        <div>
          <label className="block text-sm font-medium mb-2">Your Rating</label>
          <div className="flex gap-1 flex-wrap">
            {[...Array(10)].map((_, i) => (
              <button
                key={i}
                onClick={() => setRating(i + 1)}
                className="focus:outline-none transition-colors"
              >
                <Star
                  className={`h-6 w-6 ${
                    i < rating ? "fill-primary text-primary" : "text-muted hover:text-primary/50"
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Rate from 1-10</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Your Review</label>
          <Textarea
            placeholder="Share your thoughts about this book..."
            rows={4}
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
          />
        </div>

        <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Review
        </Button>
      </CardContent>
    </Card>
  )
}
