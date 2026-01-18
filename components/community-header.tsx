"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createClub } from "@/app/actions/clubs"
import { GENRES, type Genre } from "@/lib/types"
import { GenreToggleButton } from "@/components/genre-toggle-button"

type ClubType = "book" | "writer"

export function CommunityHeader() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [q, setQ] = useState("")
  const [type, setType] = useState<"" | ClubType>("")
  const [showCreate, setShowCreate] = useState(false)

  const [createType, setCreateType] = useState<ClubType>("book")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [categories, setCategories] = useState<Genre[]>([])
  const [isCreating, setIsCreating] = useState(false)

  const toggleCategory = (genre: Genre) => {
    setCategories((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]))
  }

  useEffect(() => {
    setQ(searchParams.get("q") || "")
    const t = searchParams.get("t")
    setType(t === "book" || t === "writer" ? t : "")
  }, [searchParams])

  const pushParams = (next: { q?: string; t?: "" | ClubType }) => {
    const params = new URLSearchParams(searchParams.toString())

    if (typeof next.q === "string") {
      if (next.q.trim()) params.set("q", next.q.trim())
      else params.delete("q")
    }

    if (typeof next.t === "string") {
      if (next.t) params.set("t", next.t)
      else params.delete("t")
    }

    const qs = params.toString()
    router.push(qs ? `/community?${qs}` : "/community")
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      pushParams({ q, t: type })
    }
  }

  const toggleType = (next: ClubType) => {
    const newType = type === next ? "" : next
    pushParams({ q, t: newType })
  }

  const onCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a club name")
      return
    }

    setIsCreating(true)
    try {
      const id = await createClub(createType, name.trim(), description.trim(), categories)
      toast.success("Club created")
      setName("")
      setDescription("")
      setCategories([])
      setShowCreate(false)
      router.push(`/community/clubs/${id}`)
    } catch (err) {
      console.error(err)
      toast.error("Failed to create club")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full max-w-2xl gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search clubs..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              className="pl-10"
            />
          </div>

          <Button
            variant={type === "book" ? "default" : "outline"}
            onClick={() => toggleType("book")}
          >
            Book clubs
          </Button>
          <Button
            variant={type === "writer" ? "default" : "outline"}
            onClick={() => toggleType("writer")}
          >
            Writer clubs
          </Button>
        </div>

        <Button onClick={() => setShowCreate((v) => !v)}>
          Create your own!
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium mb-2">Type</label>
                <Select value={createType} onValueChange={(v) => setCreateType(v as ClubType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="book">Book club</SelectItem>
                    <SelectItem value="writer">Writer club</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Club name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Categories (optional)</label>
              <div className="flex w-full flex-nowrap gap-2">
                {GENRES.map((genre) => (
                  <GenreToggleButton
                    key={genre}
                    genre={genre}
                    selected={categories.includes(genre)}
                    onToggle={toggleCategory}
                    className="flex-1 min-w-0"
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={onCreate} disabled={isCreating}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create club
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
