"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReviewForm } from "@/components/review-form"
import { DiscussionForum } from "@/components/discussion-forum"
import { sanitizeRichTextHtml } from "@/lib/sanitize"
import { Button } from "@/components/ui/button"
import { ThumbsUp } from "lucide-react"
import { toggleReviewLike } from "@/app/actions/reviews"
import { toast } from "sonner"

type ReviewRow = {
  id: string
  rating: number
  review_text: string | null
  likes_count?: number
  viewer_has_liked?: boolean
  user_profiles?: {
    id?: string | null
    username?: string | null
  } | null
}

type TitleEngagementTabsProps = {
  titleId: string
  canRead: boolean
  isSignedIn: boolean
  reviews: ReviewRow[]
}

export function TitleEngagementTabs({ titleId, canRead, isSignedIn, reviews }: TitleEngagementTabsProps) {
  const reviewCountLabel = useMemo(() => {
    const count = reviews.length
    return count === 1 ? "1 review" : `${count} reviews`
  }, [reviews.length])

  return (
    <Tabs defaultValue="reviews" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="reviews">Reviews</TabsTrigger>
        <TabsTrigger value="discussion">Discussion</TabsTrigger>
      </TabsList>

      <TabsContent value="reviews">
        <Card>
          <CardHeader>
            <CardTitle>Reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {canRead ? (
              <ReviewForm titleId={titleId} canWrite={canRead} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {isSignedIn
                  ? "Mark this title as read to write a review."
                  : "Sign in and mark this title as read to write a review."}
              </p>
            )}

            {reviews.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No reviews yet. Be the first to review!
              </p>
            ) : (
              <div className="space-y-6">
                <div className="text-sm text-muted-foreground">{reviewCountLabel}</div>
                {reviews.map((review) => (
                  <div key={review.id} className="border-b pb-6 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">
                        {review.user_profiles?.id ? (
                          <Link
                            href={`/users/${review.user_profiles.id}`}
                            className="hover:underline"
                          >
                            {review.user_profiles.username ?? "View profile"}
                          </Link>
                        ) : (
                          review.user_profiles?.username ?? "Anonymous"
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{review.rating}/10</div>
                    </div>
                    {review.review_text ? (
                      <div
                        className="text-muted-foreground mt-2 [&_p]:mb-3 last:[&_p]:mb-0"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeRichTextHtml(review.review_text),
                        }}
                      />
                    ) : null}
                    <ReviewLikeButton
                      reviewId={review.id}
                      initialCount={review.likes_count ?? 0}
                      initialLiked={Boolean(review.viewer_has_liked)}
                      canLike={isSignedIn}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="discussion">
        <Card>
          <CardHeader>
            <CardTitle>Discussion</CardTitle>
          </CardHeader>
          <CardContent>
            <DiscussionForum titleId={titleId} canWrite={canRead} isSignedIn={isSignedIn} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}

function ReviewLikeButton({
  reviewId,
  initialCount,
  initialLiked,
  canLike,
}: {
  reviewId: string
  initialCount: number
  initialLiked: boolean
  canLike: boolean
}) {
  const [isLiked, setIsLiked] = useState(initialLiked)
  const [likesCount, setLikesCount] = useState(initialCount)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLike = async () => {
    if (isSubmitting || !canLike) return
    const nextLiked = !isLiked
    const nextCount = Math.max(0, likesCount + (nextLiked ? 1 : -1))

    setIsSubmitting(true)
    setIsLiked(nextLiked)
    setLikesCount(nextCount)

    try {
      await toggleReviewLike(reviewId)
    } catch (error) {
      console.error(error)
      setIsLiked(!nextLiked)
      setLikesCount(likesCount)
      toast.error((error as any)?.message ?? "Failed to update like")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mt-4">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-muted-foreground hover:text-foreground"
        onClick={handleLike}
        disabled={isSubmitting || !canLike}
        title={canLike ? undefined : "Sign in to like reviews"}
      >
        <ThumbsUp className={`h-4 w-4 ${isLiked ? "text-primary" : ""}`} />
        <span>{likesCount}</span>
      </Button>
    </div>
  )
}
