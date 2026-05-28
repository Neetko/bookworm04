"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Search } from "lucide-react"
import { CanonGenreToggleGroup } from "@/components/canon-genre-toggle-group"
import { isGenre, type Genre } from "@/lib/types"

type Suggestion = { id: string; title: string; author: string }

type TrackReadingSearchQuery = {
  title: string
  author: string
  includeExternal: boolean
  genres: Genre[]
}
type TrackReadingSearchProps = {
  onQueryChange?: (query: TrackReadingSearchQuery) => void
  hasActiveSearch?: boolean
  allowExternalSearch?: boolean
}

function TrackReadingSearchContent({
  onQueryChange,
  hasActiveSearch = false,
  allowExternalSearch = true,
}: TrackReadingSearchProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [includeExternal, setIncludeExternal] = useState(false)
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([])

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const titleParam = searchParams.get("title") ?? searchParams.get("q") ?? ""
    const authorParam = searchParams.get("author") ?? ""
    const includeExternalParam = searchParams.get("includeExternal")
    const genresParam = searchParams.get("genres")
    setTitle(titleParam)
    setAuthor(authorParam)
    setIncludeExternal(allowExternalSearch && (includeExternalParam === "1" || includeExternalParam === "true"))
    const nextGenres = genresParam
      ? genresParam
          .split(",")
          .map((value) => value.trim())
          .filter(isGenre)
      : []
    setSelectedGenres(nextGenres)
  }, [searchParams, allowExternalSearch])

  const titleQuery = useMemo(() => title.trim(), [title])
  const authorQuery = useMemo(() => author.trim(), [author])

  const pushSearch = (input: {
    title: string
    author: string
    includeExternal: boolean
    genres: Genre[]
  }) => {
    const params = new URLSearchParams()
    if (input.title) params.set("title", input.title)
    if (input.author) params.set("author", input.author)
    if (input.includeExternal && allowExternalSearch) params.set("includeExternal", "1")
    if (!input.includeExternal && input.genres.length > 0) params.set("genres", input.genres.join(","))
    router.push(`/search-titles?${params.toString()}`)
  }

  useEffect(() => {
    onQueryChange?.({
      title: titleQuery,
      author: authorQuery,
      includeExternal: includeExternal && allowExternalSearch,
      genres: selectedGenres,
    })
  }, [titleQuery, authorQuery, includeExternal, selectedGenres, onQueryChange, allowExternalSearch])

  useEffect(() => {
    if (hasActiveSearch || !includeExternal || !allowExternalSearch) {
      abortRef.current?.abort()
      setSuggestions([])
      setOpen(false)
      return
    }

    abortRef.current?.abort()
    if (!titleQuery && !authorQuery) {
      setSuggestions([])
      setOpen(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        if (titleQuery) params.set("title", titleQuery)
        if (authorQuery) params.set("author", authorQuery)
        if (!includeExternal && selectedGenres.length > 0) params.set("genres", selectedGenres.join(","))

        const res = await fetch(`/api/track-reading/suggestions?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!res.ok) return
        const json = (await res.json()) as { results: Suggestion[] }
        setSuggestions(json.results ?? [])
        setOpen(true)
      } catch (e) {
        // Ignore aborts
      }
    }, 200)

    return () => {
      clearTimeout(handle)
      controller.abort()
    }
  }, [titleQuery, authorQuery, selectedGenres, includeExternal, hasActiveSearch, allowExternalSearch])

  const submit = () => {
    pushSearch({
      title: titleQuery,
      author: authorQuery,
      includeExternal: includeExternal && allowExternalSearch,
      genres: selectedGenres,
    })
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submit()
    if (e.key === "Escape") setOpen(false)
  }

  const pick = (s: Suggestion) => {
    setOpen(false)
    router.push(`/titles/${s.id}`)
  }

  const toggleGenre = (genre: Genre) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    )
  }

  const handleIncludeExternalChange = (checked: boolean) => {
    if (!allowExternalSearch) return

    setIncludeExternal(checked)
    setSuggestions([])
    setOpen(false)

    if (titleQuery || authorQuery || selectedGenres.length > 0 || hasActiveSearch) {
      pushSearch({
        title: titleQuery,
        author: authorQuery,
        includeExternal: checked,
        genres: selectedGenres,
      })
    }
  }

  return (
    <div className="relative w-full">
      <div className="max-w-2xl">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Title (press Enter)"
              className="pl-10"
              onFocus={() => {
                if (!hasActiveSearch && suggestions.length > 0) setOpen(true)
              }}
            />
          </div>
          <Input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Author (optional)"
            onFocus={() => {
              if (!hasActiveSearch && suggestions.length > 0) setOpen(true)
            }}
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Switch
            id="includeExternal"
            checked={includeExternal && allowExternalSearch}
            onCheckedChange={handleIncludeExternalChange}
            disabled={!allowExternalSearch}
          />
          <Label htmlFor="includeExternal" className="text-sm text-muted-foreground">
            Include external results
          </Label>
        </div>
      </div>

      <div className="mt-3 w-full overflow-x-auto pb-1">
        <CanonGenreToggleGroup
          selectedGenres={selectedGenres}
          onToggle={toggleGenre}
          buttonClassName={includeExternal && allowExternalSearch ? "opacity-50 pointer-events-none" : undefined}
        />
      </div>

      {!hasActiveSearch && open && suggestions.length > 0 ? (
        <div
          className="absolute z-50 mt-2 w-full rounded-md border bg-popover p-1 shadow-md"
          role="listbox"
        >
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              className="w-full rounded-sm px-3 py-2 text-left hover:bg-accent"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
            >
              <div className="font-medium">{s.title}</div>
              <div className="text-sm text-muted-foreground">{s.author}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function TrackReadingSearch({
  onQueryChange,
  hasActiveSearch = false,
  allowExternalSearch = true,
}: TrackReadingSearchProps) {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl grid gap-2 sm:grid-cols-2">
          <Input disabled placeholder="Title" />
          <Input disabled placeholder="Author (optional)" />
        </div>
      }
    >
      <TrackReadingSearchContent
        onQueryChange={onQueryChange}
        hasActiveSearch={hasActiveSearch}
        allowExternalSearch={allowExternalSearch}
      />
    </Suspense>
  )
}
