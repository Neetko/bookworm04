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
import { Search, Loader2, UploadCloud } from "lucide-react"
import { toast } from "sonner"
import { createClub, addClubReadingItem, uploadClubAvatar } from "@/app/actions/clubs"
import { isGenre, type Genre } from "@/lib/types"
import { CanonGenreToggleGroup } from "@/components/canon-genre-toggle-group"
import { ClubTitleSearch } from "@/components/club-title-search"
import type { SearchTitleResult } from "@/lib/types"
import { ensureGoogleBook } from "@/app/actions/track-reading"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type ClubType = "book" | "writer"

export function CommunityHeader() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [q, setQ] = useState("")
  const [selectedTypes, setSelectedTypes] = useState<ClubType[]>([])
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([])
  const [showCreate, setShowCreate] = useState(false)

  const [createType, setCreateType] = useState<ClubType>("book")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [categories, setCategories] = useState<Genre[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [plannedReading, setPlannedReading] = useState<SearchTitleResult[]>([])
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)

  const toggleCategory = (genre: Genre) => {
    setCategories((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]))
  }

  useEffect(() => {
    setQ(searchParams.get("q") || "")
    const t = searchParams.get("t")
    const nextTypes = t
      ? t
          .split(",")
          .map((value) => value.trim())
          .filter((value): value is ClubType => value === "book" || value === "writer")
      : []
    setSelectedTypes(nextTypes)

    const g = searchParams.get("genres")
    const nextGenres = g
      ? g
          .split(",")
          .map((value) => value.trim())
          .filter(isGenre)
      : []
    setSelectedGenres(nextGenres)
  }, [searchParams])

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    }
  }, [avatarPreviewUrl])

  const pushParams = (next: { q?: string; types?: ClubType[]; genres?: Genre[] }) => {
    const params = new URLSearchParams(searchParams.toString())

    if (typeof next.q === "string") {
      if (next.q.trim()) params.set("q", next.q.trim())
      else params.delete("q")
    }

    if (next.types) {
      if (next.types.length > 0) params.set("t", next.types.join(","))
      else params.delete("t")
    }

    if (next.genres) {
      if (next.genres.length > 0) params.set("genres", next.genres.join(","))
      else params.delete("genres")
    }

    const qs = params.toString()
    router.push(qs ? `/community?${qs}` : "/community")
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      pushParams({ q, types: selectedTypes, genres: selectedGenres })
    }
  }

  const toggleType = (next: ClubType) => {
    const nextTypes = selectedTypes.includes(next)
      ? selectedTypes.filter((t) => t !== next)
      : [...selectedTypes, next]
    setSelectedTypes(nextTypes)
    pushParams({ q, types: nextTypes, genres: selectedGenres })
  }

  const toggleGenre = (genre: Genre) => {
    const nextGenres = selectedGenres.includes(genre)
      ? selectedGenres.filter((g) => g !== genre)
      : [...selectedGenres, genre]
    setSelectedGenres(nextGenres)
    pushParams({ q, types: selectedTypes, genres: nextGenres })
  }

  const onCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a club name")
      return
    }

    setIsCreating(true)
    try {
      const id = await createClub(createType, name.trim(), description.trim(), categories)

      if (avatarFile) {
        try {
          const fd = new FormData()
          fd.set("file", avatarFile)
          await uploadClubAvatar(id, fd)
        } catch (err) {
          console.error(err)
          toast.error("Club created, but avatar upload failed")
        }
      }

      for (const item of plannedReading) {
        if (item.source === "google") {
          const ensured = await ensureGoogleBook(item.volumeId ?? item.id)
          await addClubReadingItem(id, {
            titleId: ensured.titleId,
            title: item.title,
            author: item.author,
          })
        } else {
          await addClubReadingItem(id, {
            titleId: item.titleId ?? item.id,
            title: item.title,
            author: item.author,
          })
        }
      }

      toast.success("Club created")
      setName("")
      setDescription("")
      setCategories([])
      setPlannedReading([])
      setAvatarFile(null)
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
      setAvatarPreviewUrl(null)
      setShowCreate(false)
      router.push(`/community/clubs/${id}`)
    } catch (err) {
      console.error(err)
      toast.error("Failed to create club")
    } finally {
      setIsCreating(false)
    }
  }

  const onSelectAvatar = async (file: File | null) => {
    if (!file) {
      setAvatarFile(null)
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
      setAvatarPreviewUrl(null)
      return
    }

    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    const previewUrl = URL.createObjectURL(file)
    setAvatarPreviewUrl(previewUrl)
    setAvatarFile(file)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full flex-col gap-3">
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
              variant={selectedTypes.includes("book") ? "default" : "outline"}
              onClick={() => toggleType("book")}
            >
              Book clubs
            </Button>
            <Button
              variant={selectedTypes.includes("writer") ? "default" : "outline"}
              onClick={() => toggleType("writer")}
            >
              Writer clubs
            </Button>
          </div>

          <CanonGenreToggleGroup selectedGenres={selectedGenres} onToggle={toggleGenre} />
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
              <CanonGenreToggleGroup
                selectedGenres={categories}
                onToggle={toggleCategory}
                buttonClassName="flex-1 min-w-0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Avatar image (optional)</label>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={avatarPreviewUrl ?? undefined} />
                  <AvatarFallback>{(name.trim() || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-2">
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={isCreating}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      void onSelectAvatar(f)
                      e.target.value = ""
                    }}
                  />
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <UploadCloud className="h-4 w-4" />
                    Auto-resized to 200x200 px (max 5MB)
                  </div>
                </div>
              </div>
            </div>

            {createType === "book" ? (
              <div className="space-y-3">
                <label className="block text-sm font-medium">Planned reading</label>
                <ClubTitleSearch onSelected={setPlannedReading} initialSelected={plannedReading} />
              </div>
            ) : null}

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
