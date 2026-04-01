"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { GenreToggleButton } from "@/components/genre-toggle-button"
import { GENRES, type Genre } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { ChevronsUpDown } from "lucide-react"

export type DiaryFilterMode = "none" | "genre" | "author" | "title"

type DiaryFiltersProps = {
  filterBy: DiaryFilterMode
  selectedGenres: Genre[]
  authors: string[]
  titles: string[]
  selectedAuthor: string | null
  selectedTitle: string | null
}

type SearchableSelectProps = {
  value: string | null
  placeholder: string
  options: string[]
  onSelect: (value: string) => void
}

function SearchableSelect({ value, placeholder, options, onSelect }: SearchableSelectProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="justify-between min-w-[220px]">
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={(current) => {
                    onSelect(current)
                    setOpen(false)
                  }}
                >
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function DiaryFilters({
  filterBy,
  selectedGenres,
  authors,
  titles,
  selectedAuthor,
  selectedTitle,
}: DiaryFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateParams = (next: URLSearchParams) => {
    const query = next.toString()
    router.push(query ? `/diary?${query}` : "/diary")
  }

  const setFilterBy = (mode: DiaryFilterMode) => {
    const next = new URLSearchParams(searchParams.toString())
    if (mode === "none") {
      next.delete("filterBy")
      next.delete("genres")
      next.delete("author")
      next.delete("title")
      updateParams(next)
      return
    }

    next.set("filterBy", mode)
    if (mode !== "genre") next.delete("genres")
    if (mode !== "author") next.delete("author")
    if (mode !== "title") next.delete("title")
    updateParams(next)
  }

  const toggleGenre = (genre: Genre) => {
    const next = new URLSearchParams(searchParams.toString())
    const current = new Set(selectedGenres)
    if (current.has(genre)) {
      current.delete(genre)
    } else {
      current.add(genre)
    }
    const nextGenres = Array.from(current)
    if (nextGenres.length === 0) {
      next.delete("genres")
    } else {
      next.set("genres", nextGenres.join(","))
    }
    next.set("filterBy", "genre")
    next.delete("author")
    next.delete("title")
    updateParams(next)
  }

  const setAuthor = (value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    next.set("filterBy", "author")
    next.set("author", value)
    next.delete("genres")
    next.delete("title")
    updateParams(next)
  }

  const setTitle = (value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    next.set("filterBy", "title")
    next.set("title", value)
    next.delete("genres")
    next.delete("author")
    updateParams(next)
  }

  const sortedAuthors = useMemo(() => authors.slice().sort((a, b) => a.localeCompare(b)), [authors])
  const sortedTitles = useMemo(() => titles.slice().sort((a, b) => a.localeCompare(b)), [titles])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Filter by</span>
        <Select value={filterBy} onValueChange={(value) => setFilterBy(value as DiaryFilterMode)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Choose filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="genre">Genre</SelectItem>
            <SelectItem value="author">Author</SelectItem>
            <SelectItem value="title">Title</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filterBy === "genre" ? (
        <div className="flex flex-nowrap gap-2 w-full overflow-x-auto pb-1">
          {GENRES.map((genre) => (
            <GenreToggleButton
              key={genre}
              genre={genre}
              selected={selectedGenres.includes(genre)}
              onToggle={toggleGenre}
            />
          ))}
        </div>
      ) : null}

      {filterBy === "author" ? (
        <SearchableSelect
          value={selectedAuthor}
          placeholder="Select author"
          options={sortedAuthors}
          onSelect={setAuthor}
        />
      ) : null}

      {filterBy === "title" ? (
        <SearchableSelect
          value={selectedTitle}
          placeholder="Select title"
          options={sortedTitles}
          onSelect={setTitle}
        />
      ) : null}
    </div>
  )
}
