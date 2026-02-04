"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

type Suggestion = { id: string; title: string; author: string }

function TrackReadingSearchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [value, setValue] = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setValue(searchParams.get("q") ?? "")
  }, [searchParams])

  const query = useMemo(() => value.trim(), [value])

  useEffect(() => {
    abortRef.current?.abort()
    if (!query) {
      setSuggestions([])
      setOpen(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/track-reading/suggestions?q=${encodeURIComponent(query)}`, {
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
  }, [query])

  const submit = () => {
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    router.push(`/search-titles?${params.toString()}`)
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

  return (
    <div className="relative max-w-2xl">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search by title or author (press Enter)"
        className="pl-10"
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true)
        }}
      />

      {open && suggestions.length > 0 ? (
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

export function TrackReadingSearch() {
  return (
    <Suspense fallback={<div className="max-w-2xl"><Input disabled placeholder="Search by title or author (press Enter)" /></div>}>
      <TrackReadingSearchContent />
    </Suspense>
  )
}
