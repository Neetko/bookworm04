import { Suspense } from "react"
import { Navigation } from "@/components/navigation"
import { BookGrid } from "@/components/book-grid"
import { SearchBar } from "@/components/search-bar"
import { supabase } from "@/lib/supabase"
import type { Book } from "@/lib/types"

async function getBooks(query: string, genres: string[]): Promise<Book[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // Allow the app to build without envs; show empty list in preview.
    return []
  }
  let queryBuilder = supabase.from("books").select("*").order("created_at", { ascending: false })

  if (query) {
    queryBuilder = queryBuilder.or(`title.ilike.%${query}%,author.ilike.%${query}%`)
  }

  if (genres.length > 0) {
    queryBuilder = queryBuilder.overlaps("genre", genres)
  }

  const { data, error } = await queryBuilder

  if (error) {
    console.error("Error fetching books:", error)
    return []
  }

  return data || []
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; g?: string }>
}) {
  const params = await searchParams
  const query = params.q || ""
  const genres = params.g ? params.g.split(",") : []

  const books = await getBooks(query, genres)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Library</h1>
          <SearchBar />
        </div>

        <Suspense fallback={<div>Loading books...</div>}>
          <BookGrid books={books} />
        </Suspense>
      </div>
    </div>
  )
}
