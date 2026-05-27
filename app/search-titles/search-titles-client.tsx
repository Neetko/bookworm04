"use client"

import { useMemo, useState } from "react"
import type { Genre, SearchTitleResult } from "@/lib/types"
import { TrackReadingSearch } from "@/components/track-reading-search"
import { TrackReadingResultList } from "@/components/track-reading-result-list"
import { Card, CardContent } from "@/components/ui/card"

type SearchTitlesClientProps = {
  initialResults: SearchTitleResult[]
  serverResults: SearchTitleResult[]
  displayQuery: string
  includeExternal: boolean
  selectedGenres: Genre[]
  hasGoogleBooksKey: boolean
  hasActiveSearch: boolean
  canAutoApproveSuggestions: boolean
  canUseExternalSearch: boolean
}

type QueryState = {
  title: string
  author: string
  includeExternal: boolean
  genres: Genre[]
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

export function SearchTitlesClient({
  initialResults,
  serverResults,
  displayQuery,
  includeExternal,
  selectedGenres,
  hasGoogleBooksKey,
  hasActiveSearch,
  canAutoApproveSuggestions,
  canUseExternalSearch,
}: SearchTitlesClientProps) {
  const [query, setQuery] = useState<QueryState>({
    title: "",
    author: "",
    includeExternal: includeExternal && canUseExternalSearch,
    genres: selectedGenres,
  })

  const filteredResults = useMemo(() => {
    if (displayQuery) return serverResults
    if (query.includeExternal && canUseExternalSearch) return []

    const titleQuery = normalizeText(query.title)
    const authorQuery = normalizeText(query.author)

    return initialResults.filter((result) => {
      const matchesTitle = titleQuery
        ? normalizeText(result.title).includes(titleQuery)
        : true
      const matchesAuthor = authorQuery
        ? normalizeText(result.author).includes(authorQuery)
        : true
      const matchesGenres =
        query.genres.length === 0
          ? true
          : result.genres?.some((genre) => query.genres.includes(genre))

      return matchesTitle && matchesAuthor && matchesGenres
    })
  }, [displayQuery, serverResults, query, initialResults, canUseExternalSearch])

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-4">Search Titles</h1>
        <TrackReadingSearch
          onQueryChange={setQuery}
          hasActiveSearch={hasActiveSearch}
          allowExternalSearch={canUseExternalSearch}
        />
        {!canUseExternalSearch ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Guests can browse local Bookworm titles. Sign in to search external sources or ingest new titles.
          </p>
        ) : null}
      </div>

      {displayQuery && filteredResults.length === 0 ? (
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
        <TrackReadingResultList
          results={filteredResults}
          canAutoApproveSuggestions={canAutoApproveSuggestions}
          allowIngest={canUseExternalSearch}
        />
      )}
    </>
  )
}
