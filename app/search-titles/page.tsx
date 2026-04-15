import { Navigation } from "@/components/navigation"
import { createServerClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import { getInitialTitles, searchTitles } from "@/app/actions/search-titles"
import { isGenre } from "@/lib/types"
import { SearchTitlesClient } from "@/app/search-titles/search-titles-client"

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
  const hasActiveSearch = Boolean(title || author || includeExternal || selectedGenres.length > 0)

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

  const initialResults = !displayQuery && !includeExternal
    ? await getInitialTitles(selectedGenres)
    : []

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SearchTitlesClient
          initialResults={initialResults}
          serverResults={results}
          displayQuery={displayQuery}
          includeExternal={includeExternal}
          selectedGenres={selectedGenres}
          hasGoogleBooksKey={hasGoogleBooksKey}
          hasActiveSearch={hasActiveSearch}
        />
      </div>
    </div>
  )
}
