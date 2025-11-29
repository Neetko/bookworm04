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

export default async function ReadBookPage({ params }: { params: { id: string } }) {
  const book = await getBook(params.id)
  const bookContent = await getBookContent(params.id)

  if (!book) {
    return <div className="text-white text-center mt-20">Book not found</div>
  }

  const content = bookContent || book.description || "No content available for this book."
  
  // Simple pagination simulation
  const charsPerPage = 800
  const pages = []
  for (let i = 0; i < 8; i++) {
    pages.push(content.slice(i * charsPerPage, (i + 1) * charsPerPage))
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
          <div className="carousel" style={{ "--slides": 4 } as React.CSSProperties}>
            {/* Bg sprite */}
            <div className="sprite"></div>
            
            {/* Carousel items - Page 1 */}
            <div className="carousel-item">
              <div className="page-container">
                <div className="page left-page">
                  <div>
                    <h2 style={{ margin: "0 0 1rem 0", fontSize: "1.2rem" }}>{book.title}</h2>
                    <p style={{ margin: 0, textIndent: "1rem" }}>
                      <strong>By {book.author}</strong>
                    </p>
                    <br />
                    <p style={{ margin: 0, textIndent: "1rem" }}>
                      {pages[0]}...
                    </p>
                  </div>
                </div>
                <div className="page right-page">
                  <div>
                    <p style={{ margin: 0, textIndent: "1rem" }}>
                      {pages[1]}...
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Carousel items - Page 2 */}
            <div className="carousel-item">
              <div className="page-container">
                <div className="page left-page">
                  <div>
                    <p style={{ margin: 0 }}>
                      {pages[2]}...
                    </p>
                  </div>
                </div>
                <div className="page right-page">
                  <div>
                    <p style={{ margin: 0 }}>
                      {pages[3]}...
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Carousel items - Page 3 */}
            <div className="carousel-item">
              <div className="page-container">
                <div className="page left-page">
                  <div>
                    <p style={{ margin: 0 }}>
                      {pages[4]}...
                    </p>
                  </div>
                </div>
                <div className="page right-page">
                  <div>
                    <p style={{ margin: 0 }}>
                      {pages[5]}...
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Carousel items - Page 4 */}
            <div className="carousel-item">
              <div className="page-container">
                <div className="page left-page">
                  <div>
                    <p style={{ margin: 0 }}>
                      {pages[6]}...
                    </p>
                  </div>
                </div>
                <div className="page right-page">
                  <div>
                    <p style={{ margin: 0 }}>
                      {pages[7]}...
                    </p>
                    <br />
                    <p style={{ textAlign: "center", marginTop: "2rem" }}>
                      <strong>To continue reading, please purchase the full book.</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
