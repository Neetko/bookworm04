"use client"

import { useEffect, useState } from "react"
import { Search, Loader2, Plus, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { searchTitles } from "@/app/actions/search-titles"
import { ensureGoogleBook } from "@/app/actions/track-reading"
import { addClubReadingItem } from "@/app/actions/clubs"
import type { SearchTitleResult } from "@/lib/types"
import { toast } from "sonner"

export type ClubTitleSearchProps = {
  clubId?: string
  onSelected?: (selected: SearchTitleResult[]) => void
  initialSelected?: SearchTitleResult[]
}

export function ClubTitleSearch({ clubId, onSelected, initialSelected = [] }: ClubTitleSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchTitleResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selected, setSelected] = useState<SearchTitleResult[]>(initialSelected)
  const [addingId, setAddingId] = useState<string | null>(null)

  useEffect(() => {
    onSelected?.(selected)
  }, [selected, onSelected])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      return
    }

    let cancelled = false
    setIsLoading(true)

    const handle = setTimeout(async () => {
      try {
        const data = await searchTitles(trimmed)
        if (!cancelled) setResults(data)
      } catch (error) {
        console.error("Failed to search titles", error)
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query])

  const isAlreadySelected = (result: SearchTitleResult) => {
    return selected.some((item) => {
      if (result.titleId && item.titleId) return result.titleId === item.titleId
      if (result.source === "google" && item.source === "google") {
        return result.volumeId && item.volumeId && result.volumeId === item.volumeId
      }
      return result.title === item.title && result.author === item.author
    })
  }

  const handleAdd = async (result: SearchTitleResult) => {
    if (isAlreadySelected(result)) return

    if (!clubId) {
      setSelected((prev) => [...prev, result])
      return
    }

    setAddingId(result.id)
    try {
      if (result.source === "google") {
        const ensured = await ensureGoogleBook(result.volumeId ?? result.id)
        await addClubReadingItem(clubId, {
          titleId: ensured.titleId,
          title: result.title,
          author: result.author,
        })
      } else {
        await addClubReadingItem(clubId, {
          bookId: result.id,
          titleId: result.titleId ?? result.id,
          title: result.title,
          author: result.author,
        })
      }

      toast.success("Added to planned reading")
      setSelected((prev) => [...prev, result])
    } catch (error) {
      console.error(error)
      toast.error("Failed to add title")
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles to add..."
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching...
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="space-y-3">
          {results.map((result) => {
            const alreadySelected = isAlreadySelected(result)
            return (
              <Card key={`${result.source}:${result.id}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={result.coverImageUrl ?? undefined} />
                    <AvatarFallback>{result.title?.[0] ?? "T"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{result.title}</div>
                    <div className="text-sm text-muted-foreground truncate">{result.author}</div>
                  </div>
                  <Button
                    size="sm"
                    variant={alreadySelected ? "secondary" : "outline"}
                    disabled={alreadySelected || addingId === result.id}
                    onClick={() => handleAdd(result)}
                  >
                    {alreadySelected ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Added
                      </>
                    ) : (
                      <>
                        {addingId === result.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-1" />
                        )}
                        Add
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
