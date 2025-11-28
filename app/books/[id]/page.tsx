import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Star, Heart, Bookmark, BookOpen, User } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Book } from "@/lib/types"

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

  if (!book) {
    return <div>Book not found</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Book Info */}
          <div className="lg:col-span-2">
            <Card>
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
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-5 w-5 ${i < 4 ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                          />
                        ))}
                        <span className="ml-2 text-lg font-semibold">4.2/5</span>
                      </div>
                      <span className="text-gray-500">(127 reviews)</span>
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
          </div>

          {/* Rating & Review Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Rate This Book</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Your Rating</label>
                  <div className="flex gap-1">
                    {[...Array(10)].map((_, i) => (
                      <button key={i} className="w-8 h-8 border border-gray-300 rounded text-sm hover:bg-gray-100">
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Rate from 1-10</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Your Review</label>
                  <Textarea placeholder="Share your thoughts about this book..." rows={4} />
                </div>

                <Button className="w-full">Submit Review</Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Reviews Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-b pb-6 last:border-b-0">
                  <div className="flex items-start gap-4">
                    <Avatar>
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold">BookLover{i}</span>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, j) => (
                            <Star
                              key={j}
                              className={`h-4 w-4 ${j < 4 ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-gray-500">2 days ago</span>
                      </div>

                      <p className="text-gray-700">
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
                        labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco
                        laboris nisi ut aliquip ex ea commodo consequat.
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
