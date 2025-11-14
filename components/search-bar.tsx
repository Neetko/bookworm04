"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Filter } from "lucide-react"

export function SearchBar() {
  const [searchTerm, setSearchTerm] = useState("")

  return (
    <div className="flex gap-4 max-w-2xl">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          placeholder="Search books, authors, genres..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      <Button variant="outline">
        <Filter className="h-4 w-4 mr-2" />
        Filters
      </Button>
    </div>
  )
}
