import { Navigation } from "@/components/navigation"
import { createServerClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import { TrackReadingSearch } from "@/components/track-reading-search"
import { TrackReadingResultList } from "@/components/track-reading-result-list"
import { searchTitles } from "@/app/actions/search-titles"
import { isGenre } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"

export default async function SearchTitlesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    title?: string
    author?: string
    includeExternal?: string
    genres?: string
  }>
}) {
  const params = await searchParams
  const title = (params.title ?? params.q ?? "").trim()
  const author = (params.author ?? "").trim()
  const displayQuery = [title, author].filter(Boolean).join(" — ")
  const includeExternal = params.includeExternal === "1" || params.includeExternal === "true"
  const selectedGenres = params.genres
    ? params.genres
        .split(",")
        .map((value) => value.trim())
        .filter(isGenre)
    : []

  const hasGoogleBooksKey = Boolean(process.env.GOOGLE_BOOKS_API_KEY)

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth")
  }

  const results = displayQuery
    ? await searchTitles({ title, author, raw: params.q, includeExternal, genres: selectedGenres })
    : []

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">Search Titles</h1>
          <TrackReadingSearch />
        </div>

        {displayQuery && results.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="font-medium">No results for “{displayQuery}”.</p>
              {!hasGoogleBooksKey ? (
                <p className="text-sm text-muted-foreground mt-2">
                  Google Books API key is not configured. Set `GOOGLE_BOOKS_API_KEY` in `.env.local` to enable higher-quota searches.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">Try a different title or author.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <TrackReadingResultList results={results} />
        )}
      </div>
    </div>
  )
}
