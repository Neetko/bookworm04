import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Star, Heart, Bookmark, BookOpen, User, BookOpenText } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Book } from "@/lib/types"
import Link from "next/link"
import { MarkReadButton } from "@/components/mark-read-button"
import { DiscussionForum } from "@/components/discussion-forum"
import { BookContentTabs } from "@/components/book-content-tabs"
import { getReviews } from "@/app/actions/reviews"
import { ReviewForm } from "@/components/review-form"
import { formatDistanceToNow } from "date-fns"

async function getBook(id: string): Promise<Book | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null
  }
  const { data, error } = await supabase.from("books").select("*").eq("id", id).single()

  if (error) {
    console.error("Error fetching book:", error)
    return null
  }

  return data
}

export default async function BookDetailPage({ params }: { params: { id: string } }) {
  const book = await getBook(params.id)
  const reviews = await getReviews(params.id)

  if (!book) {
    return <div>Book not found</div>
  }

  const averageRating = reviews.length > 0
    ? (reviews.reduce((acc: number, review: any) => acc + review.rating, 0) / reviews.length).toFixed(1)
    : "N/A"

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Book Info */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-48 h-64 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-16 w-16 text-gray-400" />
              </div>

              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">{book.title}</h1>
                <p className="text-xl text-gray-600 mb-4">by {book.author}</p>

                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="ml-1 text-lg font-semibold">{averageRating}/10</span>
                  </div>
                  <span className="text-gray-500">({reviews.length} reviews)</span>
                </div>

                <div className="flex gap-2 mb-6">
                  {book.genre && Array.isArray(book.genre) ? (
                    book.genre.map((g) => <Badge key={g}>{g}</Badge>)
                  ) : book.genre ? (
                    <Badge>{book.genre}</Badge>
                  ) : null}
                  {book.published_year && <Badge variant="outline">{book.published_year}</Badge>}
                </div>

                <p className="text-gray-700 leading-relaxed mb-6">{book.description}</p>

                <div className="flex gap-3">
                  <Button asChild className="bg-blue-600 hover:bg-blue-700">
                    <Link href={`/books/${book.id}/read`}>
                      <BookOpenText className="h-4 w-4 mr-2" />
                      Read Book
                    </Link>
                  </Button>
                  <MarkReadButton bookId={book.id} />
                  <Button>
                    <Heart className="h-4 w-4 mr-2" />
                    Add to Favorites
                  </Button>
                  <Button variant="outline">
                    <Bookmark className="h-4 w-4 mr-2" />
                    Bookmark
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <BookContentTabs
          reviewsContent={
            <>
              <ReviewForm bookId={book.id} />

              {/* Reviews Section */}
              <Card className="mt-8">
                <CardHeader>
                  <CardTitle>Reviews</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {reviews.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No reviews yet. Be the first to review!</p>
                    ) : (
                      reviews.map((review: any) => (
                        <div key={review.id} className="border-b pb-6 last:border-b-0">
                          <div className="flex items-start gap-4">
                            <Avatar>
                              <AvatarImage src={review.user_profiles?.avatar_url} />
                              <AvatarFallback>
                                <User className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold">{review.user_profiles?.username || "Anonymous"}</span>
                                <div className="flex items-center gap-1 bg-yellow-100 px-2 py-0.5 rounded-full">
                                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                  <span className="text-xs font-bold text-yellow-700">{review.rating}/10</span>
                                </div>
                                <span className="text-sm text-gray-500">
                                  {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                                </span>
                              </div>

                              <p className="text-gray-700">{review.review_text}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          }
          discussionContent={<DiscussionForum bookId={book.id} />}
        />
      </div>
    </div>
  )
}
