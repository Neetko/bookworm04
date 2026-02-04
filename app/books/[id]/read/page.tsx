import { supabase } from "@/lib/supabase"
import type { Book, Genre } from "@/lib/types"
import { normalizeGenres } from "@/lib/types"
import "./reader.css"
import { ReaderClient } from "./reader-client"

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

async function getBookContent(bookId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("book_contents")
    .select("content")
    .eq("book_id", bookId)
    .single()

  if (error) {
    console.error("Error fetching book content:", error)
    return null
  }

  const content = data?.content ?? ""
  if (content.trim().length === 0) return null

  return content
}

function paginateContent(content: string, charsPerPage: number): string[] {
  const pages: string[] = []
  let currentIndex = 0
  
  while (currentIndex < content.length) {
    const nextIndex = currentIndex + charsPerPage
    
    if (nextIndex >= content.length) {
      pages.push(content.slice(currentIndex))
      break
    }
    
    // Find last space before the limit to avoid splitting words
    const lastSpaceIndex = content.lastIndexOf(" ", nextIndex)
    
    // If we found a space and it's within the current page range (not from previous page)
    if (lastSpaceIndex > currentIndex) {
      pages.push(content.slice(currentIndex, lastSpaceIndex))
      currentIndex = lastSpaceIndex + 1
    } else {
      // If no space found (extremely long word), just cut it
      pages.push(content.slice(currentIndex, nextIndex))
      currentIndex = nextIndex
    }
  }
  
  return pages
}

export default async function ReadBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const book = await getBook(id)
  const bookContent = await getBookContent(id)

  if (!book) {
    return <div className="text-white text-center mt-20">Book not found</div>
  }

  if (!bookContent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold">Not in library</h1>
          <p className="text-muted-foreground">This book isn’t available to read yet.</p>
          <a className="underline" href={`/titles/${id}`}>Back to title</a>
        </div>
      </div>
    )
  }

  const content = bookContent
  
  // Dynamic pagination with word boundary detection
  // Adjusted charsPerPage to accommodate pre-wrap spacing
  const charsPerPage = 500 
  const pages = paginateContent(content, charsPerPage)

  // Group into slides (2 pages per slide)
  const slides: Array<{ left: string; right: string }> = []
  for (let i = 0; i < pages.length; i += 2) {
    slides.push({
      left: pages[i],
      right: pages[i + 1] || ""
    })
  }
  
  if (slides.length === 0) {
      slides.push({ left: "", right: "" })
  }

  const primaryGenre: Genre | null = normalizeGenres(book.genre)[0] ?? null

  return (
    <ReaderClient
      bookId={id}
      title={book.title}
      author={book.author}
      slides={slides}
      primaryGenre={primaryGenre}
    />
  )
}
