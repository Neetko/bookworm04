"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, UploadCloud, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import { GENRES, normalizeGenres, type Genre } from "@/lib/types"
import { GenreToggleButton } from "@/components/genre-toggle-button"
import { ClubTitleSearch } from "@/components/club-title-search"
import {
  addClubReadingItem,
  inviteMemberToClub,
  kickMemberFromClub,
  removeClubReadingItem,
  setClubCurrentReading,
  uploadClubAvatar,
  updateClubSettings,
} from "@/app/actions/clubs"

type ClubType = "book" | "writer"

type Club = {
  id: string
  type: ClubType
  name: string
  description: string | null
  categories: Genre[] | null
  avatar_url: string | null
  current_title_id?: string | null
}

type Member = { id: string; username: string | null; avatar_url: string | null; role: string | null }

type ReadingItem = {
  id: string
  book_id: string | null
  title_id?: string | null
  title: string | null
  author: string | null
  book: { id: string; title: string; author: string } | null
  title_data?: { id: string; title: string; author: string; cover_image_url: string | null } | null
}

export function ClubManageForm({
  club,
  members,
  readingItems,
}: {
  club: Club
  members: Member[]
  readingItems: ReadingItem[]
}) {
  const router = useRouter()

  const initialCategories = useMemo(() => normalizeGenres(club.categories), [club.categories])

  const [name, setName] = useState(club.name)
  const [avatarUrl, setAvatarUrl] = useState(club.avatar_url ?? "")
  const [description, setDescription] = useState(club.description ?? "")
  const [categories, setCategories] = useState<Genre[]>(initialCategories)
  const [currentTitleId, setCurrentTitleId] = useState<string | null>(club.current_title_id ?? null)
  const [isSavingCurrent, setIsSavingCurrent] = useState(false)

  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  const toggleCategory = (genre: Genre) => {
    setCategories((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]))
  }

  const onSave = async () => {
    if (!name.trim()) {
      toast.error("Club name is required")
      return
    }

    setIsSaving(true)
    try {
      await updateClubSettings(club.id, {
        name,
        avatarUrl,
        description,
        categories,
      })
      toast.success("Club updated")
      router.push(`/community/clubs/${club.id}`)
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error("Failed to update club")
    } finally {
      setIsSaving(false)
    }
  }

  const onUploadAvatar = async (file: File) => {
    setIsUploadingAvatar(true)
    try {
      const fd = new FormData()
      fd.set("file", file)
      const url = await uploadClubAvatar(club.id, fd)
      setAvatarUrl(url)
      toast.success("Avatar uploaded")
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error("Failed to upload avatar")
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const [inviteUsername, setInviteUsername] = useState("")
  const [isInviting, setIsInviting] = useState(false)

  const onInvite = async () => {
    if (!inviteUsername.trim()) return
    setIsInviting(true)
    try {
      await inviteMemberToClub(club.id, inviteUsername)
      toast.success("Member invited")
      setInviteUsername("")
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error("Failed to invite")
    } finally {
      setIsInviting(false)
    }
  }

  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const onKick = async (memberId: string) => {
    setRemovingMemberId(memberId)
    try {
      await kickMemberFromClub(club.id, memberId)
      toast.success("Member removed")
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error("Failed to remove member")
    } finally {
      setRemovingMemberId(null)
    }
  }

  const [removingItemId, setRemovingItemId] = useState<string | null>(null)
  const onRemoveItem = async (itemId: string) => {
    setRemovingItemId(itemId)
    try {
      await removeClubReadingItem(club.id, itemId)
      toast.success("Removed")
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error("Failed to remove")
    } finally {
      setRemovingItemId(null)
    }
  }

  const onSaveCurrentReading = async () => {
    setIsSavingCurrent(true)
    try {
      await setClubCurrentReading(club.id, currentTitleId)
      toast.success("Current reading updated")
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error("Failed to update current reading")
    } finally {
      setIsSavingCurrent(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Club details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Avatar image</label>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback>{(name.trim() || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-2">
                <Input
                  type="file"
                  accept="image/*"
                  disabled={isUploadingAvatar}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void onUploadAvatar(f)
                    e.target.value = ""
                  }}
                />
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <UploadCloud className="h-4 w-4" />
                  Auto-resized to 200x200 px (max 5MB)
                </div>
              </div>

              {isUploadingAvatar && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Genres</label>
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

        </CardContent>
      </Card>

      {club.type === "book" && (
        <Card>
          <CardHeader>
            <CardTitle>Selected titles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Current reading</div>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={currentTitleId ?? ""}
                  onChange={(event) => setCurrentTitleId(event.target.value || null)}
                >
                  <option value="">No current reading</option>
                  {readingItems.map((item) => {
                    const titleRecord = item.title_data ?? item.book
                    const title = titleRecord?.title ?? item.title ?? "Untitled"
                    const author = titleRecord?.author ?? item.author ?? ""
                    const titleId = item.title_id ?? item.book?.id ?? null

                    if (!titleId) return null

                    return (
                      <option key={item.id} value={titleId}>
                        {title} {author ? `— ${author}` : ""}
                      </option>
                    )
                  })}
                </select>
                <Button onClick={onSaveCurrentReading} disabled={isSavingCurrent}>
                  {isSavingCurrent && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save current reading
                </Button>
              </div>
            </div>

            <ClubTitleSearch clubId={club.id} />

            <div className="space-y-2">
              {readingItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">No titles selected.</div>
              ) : (
                readingItems.map((item) => {
                  const titleRecord = item.title_data ?? item.book
                  const title = titleRecord?.title ?? item.title ?? "Untitled"
                  const author = titleRecord?.author ?? item.author ?? ""
                  const coverUrl = item.title_data?.cover_image_url ?? null

                  return (
                    <Card key={item.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={coverUrl ?? undefined} />
                            <AvatarFallback>{title[0] ?? "T"}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{title}</div>
                            {author && <div className="text-sm text-muted-foreground">{author}</div>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={item.book ? "default" : "secondary"}>
                              {item.book ? "In library" : "Not in library"}
                            </Badge>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => onRemoveItem(item.id)}
                              disabled={removingItemId === item.id}
                            >
                              {removingItemId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Members</CardTitle>
            <span className="text-sm text-muted-foreground">{members.length} total</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Invite by username</div>
            <div className="flex gap-2">
              <Input value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)} />
              <Button onClick={onInvite} disabled={isInviting}>
                {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Invite
              </Button>
            </div>
          </div>

          <ScrollArea className="h-72">
            <div className="space-y-3 pr-2">
              {members.length === 0 ? (
                <div className="text-sm text-muted-foreground">No members yet.</div>
              ) : (
                members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={m.avatar_url ?? undefined} />
                        <AvatarFallback>{(m.username ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{m.username ?? "Unnamed"}</div>
                        {m.role && <div className="text-xs text-muted-foreground">{m.role}</div>}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onKick(m.id)}
                      disabled={removingMemberId === m.id}
                    >
                      {removingMemberId === m.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Kick
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  )
}
