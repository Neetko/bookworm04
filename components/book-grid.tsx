import Link from "next/link"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Star, BookOpen } from "lucide-react"
import type { Book } from "@/lib/types"

interface BookGridProps {
  books: Book[]
}

export function BookGrid({ books }: BookGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {books.map((book) => (
        <Card key={book.id} className="hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="aspect-[3/4] bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
              <BookOpen className="h-12 w-12 text-gray-400" />
            </div>

            <h3 className="font-semibold text-lg mb-2 line-clamp-2">{book.title}</h3>
            <p className="text-gray-600 mb-2">by {book.author}</p>

            <div className="flex flex-wrap gap-2 mb-3">
              {book.genre && Array.isArray(book.genre) ? (
                book.genre.map((g) => (
                  <Badge key={g} variant="secondary">
                    {g}
                  </Badge>
                ))
              ) : book.genre ? (
                <Badge variant="secondary">{book.genre}</Badge>
              ) : null}
            </div>

            <div className="flex items-center gap-1 mb-3">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium text-gray-700">8.4/10</span>
            </div>

            <p className="text-sm text-gray-600 line-clamp-3 mb-4">{book.description}</p>
          </CardContent>

          <CardFooter className="p-4 pt-0">
            <Button asChild className="w-full">
              <Link href={`/books/${book.id}`}>Read More</Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
