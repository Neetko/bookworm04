import { supabase } from "@/lib/supabase"
import type { Book } from "@/lib/types"
import "./reader.css"

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
  return data.content
}

function paginateContent(content: string, charsPerPage: number): string[] {
  const pages = []
  let currentIndex = 0
  
  while (currentIndex < content.length) {
    let nextIndex = currentIndex + charsPerPage
    
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

export default async function ReadBookPage({ params }: { params: { id: string } }) {
  const book = await getBook(params.id)
  const bookContent = await getBookContent(params.id)

  if (!book) {
    return <div className="text-white text-center mt-20">Book not found</div>
  }

  const content = bookContent || book.description || "No content available for this book."
  
  // Dynamic pagination with word boundary detection
  // Adjusted charsPerPage to accommodate pre-wrap spacing
  const charsPerPage = 850 
  const pages = paginateContent(content, charsPerPage)

  // Group into slides (2 pages per slide)
  const slides = []
  for (let i = 0; i < pages.length; i += 2) {
    slides.push({
      left: pages[i],
      right: pages[i + 1] || ""
    })
  }
  
  if (slides.length === 0) {
      slides.push({ left: "", right: "" })
  }

  return (
    <div className="reader-mode">
      <a href={`/books/${params.id}`} style={{ position: "absolute", top: "1rem", right: "1rem", color: "white", textDecoration: "none", zIndex: 100, padding: "0.5rem 1rem", border: "1px solid white", borderRadius: "4px" }}>
        Close
      </a>
      <div className="container">
        <h1>
          Reading: <span style={{ color: "#f840a8", textDecoration: "underline" }}>{book.title}</span>
        </h1>
      <div className="sprite-wrapper">
        <div className="book">
          {/* Carousel container */}
          <div className="carousel" style={{ "--slides": slides.length } as React.CSSProperties}>
            {/* Bg sprite */}
            <div className="sprite"></div>
            
            {slides.map((slide, index) => (
              <div className="carousel-item" key={index}>
                <div className="page-container">
                  <div className="page left-page">
                    <div>
                      {index === 0 && (
                        <>
                          <h2 style={{ margin: "0 0 1rem 0", fontSize: "1.2rem" }}>{book.title}</h2>
                          <p style={{ margin: 0, textIndent: "1rem" }}>
                            <strong>By {book.author}</strong>
                          </p>
                          <br />
                        </>
                      )}
                      <div style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                        {slide.left}
                      </div>
                    </div>
                  </div>
                  <div className="page right-page">
                    <div>
                      <div style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                        {slide.right}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
