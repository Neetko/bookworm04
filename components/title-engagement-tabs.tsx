"use client"

import { useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReviewForm } from "@/components/review-form"
import { DiscussionForum } from "@/components/discussion-forum"
import { sanitizeRichTextHtml } from "@/lib/sanitize"

type ReviewRow = {
  id: string
  rating: number
  review_text: string | null
  user_profiles?: {
    username?: string | null
  } | null
}

type TitleEngagementTabsProps = {
  titleId: string
  canRead: boolean
  reviews: ReviewRow[]
}

export function TitleEngagementTabs({ titleId, canRead, reviews }: TitleEngagementTabsProps) {
  const reviewCountLabel = useMemo(() => {
    const count = reviews.length
    return count === 1 ? "1 review" : `${count} reviews`
  }, [reviews.length])

  return (
    <Tabs defaultValue="reviews" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="reviews">Reviews</TabsTrigger>
        {canRead ? <TabsTrigger value="discussion">Discussion</TabsTrigger> : null}
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
                Mark this title as read to write a review.
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
                        {review.user_profiles?.username ?? "Anonymous"}
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {canRead ? (
        <TabsContent value="discussion">
          <Card>
            <CardHeader>
              <CardTitle>Discussion</CardTitle>
            </CardHeader>
            <CardContent>
              <DiscussionForum titleId={titleId} />
            </CardContent>
          </Card>
        </TabsContent>
      ) : null}
    </Tabs>
  )
}
