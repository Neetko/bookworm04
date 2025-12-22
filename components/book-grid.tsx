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
    <div className="space-y-6">
      {books.map((book) => (
        <Card key={book.id} className="flex flex-col sm:flex-row hover:shadow-lg transition-shadow overflow-hidden min-h-[200px]">
          <div className="w-full sm:w-48 h-48 sm:h-auto bg-muted flex items-center justify-center flex-shrink-0">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
          </div>

          <div className="flex flex-col flex-1">
            <CardContent className="p-6 flex-1">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-semibold text-xl mb-1">{book.title}</h3>
                  <p className="text-muted-foreground mb-3">by {book.author}</p>
                </div>
                <div className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md flex-shrink-0">
                  <Star className="h-4 w-4 fill-primary text-primary" />
                  <span className="text-sm font-medium text-secondary-foreground">8.4/10</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
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

              <p className="text-muted-foreground line-clamp-2">{book.description}</p>
            </CardContent>

            <CardFooter className="p-6 pt-0 flex justify-end">
              <Button asChild>
                <Link href={`/books/${book.id}`}>Read</Link>
              </Button>
            </CardFooter>
          </div>
        </Card>
      ))}
    </div>
  )
}
