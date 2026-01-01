"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Filter } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { GENRES, type Genre, isGenre } from "@/lib/types"

function SearchBarContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([])

  useEffect(() => {
    setSearchTerm(searchParams.get("q") || "")
    const g = searchParams.get("g")
    setSelectedGenres(g ? g.split(",").filter(isGenre) : [])
  }, [searchParams])

  const handleSearch = (term: string, genres: Genre[]) => {
    const params = new URLSearchParams()
    if (term) params.set("q", term)
    if (genres.length > 0) params.set("g", genres.join(","))

    router.push(`/library?${params.toString()}`)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch(searchTerm, selectedGenres)
    }
  }

  const toggleGenre = (genre: Genre) => {
    const newGenres = selectedGenres.includes(genre)
      ? selectedGenres.filter((g) => g !== genre)
      : [...selectedGenres, genre]

    setSelectedGenres(newGenres)
    handleSearch(searchTerm, newGenres)
  }

  return (
    <div className="flex gap-4 max-w-2xl">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="text"
          placeholder="Search books, authors, genres..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={onKeyDown}
          className="pl-10"
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Categories {selectedGenres.length > 0 && `(${selectedGenres.length})`}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Filter by Genre</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {GENRES.map((genre) => (
            <DropdownMenuCheckboxItem
              key={genre}
              checked={selectedGenres.includes(genre)}
              onCheckedChange={() => toggleGenre(genre)}
            >
              {genre}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function SearchBar() {
  return (
    <Suspense fallback={<div className="flex gap-4 max-w-2xl"><Input disabled /><Button disabled>Categories</Button></div>}>
      <SearchBarContent />
    </Suspense>
  )
}
