"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BookOpen, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Navigation } from "@/components/navigation"
import { TrackReadingResultList } from "@/components/track-reading-result-list"
import { useAuth } from "@/lib/auth-provider"
import { getProfileData } from "@/app/actions/profile"
import { supabase } from "@/lib/supabase-browser"
import { searchTitles } from "@/app/actions/search-titles"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { addTitleToListAction, createCustomListAction, updateCustomListAction, removeTitleFromListAction } from "@/app/actions/lists"
import type { Genre, SearchTitleResult } from "@/lib/types"
import { GENRES } from "@/lib/types"
import { GenreToggleButton } from "@/components/genre-toggle-button"
import { toast } from "sonner"

type EditListsPageContentProps = {
  profileData: any
  sessionToken: string | null
  reloadProfile: (token: string) => Promise<void>
}

export default function EditListsPage() {
  const { user: authUser, loading: authLoading } = useAuth()
  const [profileData, setProfileData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  const reloadProfile = async (token: string) => {
    try {
      const data = await getProfileData(token)
      setProfileData(data)
    } catch (error) {
      console.error("Failed to load profile", error)
    }
  }

  useEffect(() => {
    async function loadProfile() {
      if (!authUser) return
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        setSessionToken(session.access_token)
        await reloadProfile(session.access_token)
      }
      setLoading(false)
    }

    if (!authLoading) {
      if (authUser) {
        loadProfile()
      } else {
        setLoading(false)
      }
    }
  }, [authUser, authLoading])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold">Please sign in to manage your lists</h1>
        </div>
      </div>
    )
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold">Profile not found</h1>
        </div>
      </div>
    )
  }

  return (
    <EditListsPageContent profileData={profileData} sessionToken={sessionToken} reloadProfile={reloadProfile} />
  )
}

function EditListsPageContent({ profileData, sessionToken, reloadProfile }: EditListsPageContentProps) {
  const [isRemoving, setIsRemoving] = useState<string | null>(null)
  const [activeList, setActiveList] = useState<string>("to-read")
  const [createListOpen, setCreateListOpen] = useState(false)
  const [editListOpen, setEditListOpen] = useState(false)
  const [listName, setListName] = useState("")
  const [listPublic, setListPublic] = useState(true)
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [savingList, setSavingList] = useState(false)
  const [editingListLabel, setEditingListLabel] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchAuthor, setSearchAuthor] = useState("")
  const [searchResults, setSearchResults] = useState<SearchTitleResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [includeExternal, setIncludeExternal] = useState(false)
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([])
  const [addingTitleId, setAddingTitleId] = useState<string | null>(null)
  const [movePrompt, setMovePrompt] = useState<null | {
    titleId: string
    title: string
    fromListId: string
    fromListName: string
    toListId: string
    toListName: string
  }>(null)

  const finishedReadingTitles = useMemo(
    () => profileData.finishedReadingTitles || [],
    [profileData.finishedReadingTitles]
  )
  const toReadTitles = useMemo(
    () => profileData.toReadTitles || [],
    [profileData.toReadTitles]
  )
  const currentReadingTitles = useMemo(
    () => profileData.currentReadingTitles || [],
    [profileData.currentReadingTitles]
  )
  const customLists = useMemo(
    () => profileData.customLists || [],
    [profileData.customLists]
  )

  const toReadTitleIds = useMemo(
    () => new Set<string>((toReadTitles ?? []).map((entry: any) => entry.title_id)),
    [toReadTitles]
  )
  const currentReadingTitleIds = useMemo(
    () => new Set<string>((currentReadingTitles ?? []).map((entry: any) => entry.title_id)),
    [currentReadingTitles]
  )
  const finishedReadingTitleIds = useMemo(
    () => new Set<string>((finishedReadingTitles ?? []).map((entry: any) => entry.title_id)),
    [finishedReadingTitles]
  )

  const defaultLists = useMemo(
    () => [
      {
        id: profileData.toReadListId as string | null | undefined,
        name: "Planned Reading",
        titleIds: toReadTitleIds,
      },
      {
        id: profileData.currentReadingListId as string | null | undefined,
        name: "Current Reading",
        titleIds: currentReadingTitleIds,
      },
      {
        id: profileData.finishedReadingListId as string | null | undefined,
        name: "Finished Reading",
        titleIds: finishedReadingTitleIds,
      },
    ],
    [
      profileData.toReadListId,
      profileData.currentReadingListId,
      profileData.finishedReadingListId,
      toReadTitleIds,
      currentReadingTitleIds,
      finishedReadingTitleIds,
    ]
  )

  const handleRemoveFromList = async (listId: string, titleId: string) => {
    setIsRemoving(titleId)
    try {
      await removeTitleFromListAction({ listId, titleId })
      if (sessionToken) {
        await reloadProfile(sessionToken)
      }
    } catch (error) {
      console.error("Failed to update list", error)
    } finally {
      setIsRemoving(null)
    }
  }

  const openCreateList = () => {
    setListName("")
    setListPublic(true)
    setEditingListLabel(null)
    setCreateListOpen(true)
  }

  const openEditList = (list: any) => {
    setEditingListId(list.id)
    setListName(list.name)
    setListPublic(Boolean(list.isPublic))
    setEditingListLabel(list.name)
    setEditListOpen(true)
  }

  const openEditToReadList = () => {
    setEditingListId(profileData.toReadListId)
    setListName("Planned Reading")
    setListPublic(false)
    setEditingListLabel("Planned Reading")
    setEditListOpen(true)
  }

  const openEditCurrentReadingList = () => {
    setEditingListId(profileData.currentReadingListId)
    setListName("Current Reading")
    setListPublic(false)
    setEditingListLabel("Current Reading")
    setEditListOpen(true)
  }

  const openEditFinishedReadingList = () => {
    setEditingListId(profileData.finishedReadingListId)
    setListName("Finished Reading")
    setListPublic(false)
    setEditingListLabel("Finished Reading")
    setEditListOpen(true)
  }

  const saveList = async () => {
    if (!listName.trim()) return
    setSavingList(true)
    try {
      if (editListOpen && editingListId) {
        await updateCustomListAction({ listId: editingListId, name: listName, isPublic: listPublic })
      } else {
        await createCustomListAction({ name: listName, isPublic: listPublic })
      }
      if (sessionToken) await reloadProfile(sessionToken)
      setCreateListOpen(false)
      setEditListOpen(false)
    } catch (error) {
      console.error("Failed to save list", error)
    } finally {
      setSavingList(false)
    }
  }

  const isEditingDefaultList =
    editListOpen &&
    (
      editingListId === profileData.toReadListId ||
      editingListId === profileData.currentReadingListId ||
      editingListId === profileData.finishedReadingListId
    )

  const currentListTitleIds = useMemo(() => {
    if (!editingListId) return new Set<string>()
    if (editingListId === profileData.toReadListId) {
      return new Set<string>(toReadTitleIds)
    }
    if (editingListId === profileData.currentReadingListId) {
      return new Set<string>(currentReadingTitleIds)
    }
    if (editingListId === profileData.finishedReadingListId) {
      return new Set<string>(finishedReadingTitleIds)
    }
    const list = customLists.find((item: any) => item.id === editingListId)
    return new Set<string>((list?.items ?? []).map((entry: any) => entry.title_id))
  }, [
    editingListId,
    profileData.toReadListId,
    profileData.currentReadingListId,
    profileData.finishedReadingListId,
    toReadTitleIds,
    currentReadingTitleIds,
    finishedReadingTitleIds,
    customLists,
  ])

  useEffect(() => {
    if (!editListOpen) return
    const titleQuery = searchQuery.trim()
    const authorQuery = searchAuthor.trim()

    if (!titleQuery && !authorQuery) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    let cancelled = false
    setIsSearching(true)

    const handle = setTimeout(async () => {
      try {
        const results = await searchTitles({
          title: titleQuery,
          author: authorQuery,
          includeExternal,
          genres: includeExternal ? [] : selectedGenres,
        })
        if (!cancelled) {
          setSearchResults(results)
        }
      } catch (error) {
        console.error("Failed to search titles", error)
        if (!cancelled) setSearchResults([])
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [searchQuery, searchAuthor, includeExternal, selectedGenres, editListOpen])

  const resolveSearchResultTitleId = (result: SearchTitleResult) => {
    if (result.source === "local") return result.titleId ?? result.id
    return result.titleId ?? null
  }

  const filteredSearchResults = useMemo(() => {
    return searchResults.filter((result) => {
      const titleId = resolveSearchResultTitleId(result)
      if (!titleId) return true
      return !currentListTitleIds.has(titleId)
    })
  }, [searchResults, currentListTitleIds])

  const toggleGenre = (genre: Genre) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    )
  }

  const handleAddFromSearch = async (titleId: string, result: SearchTitleResult) => {
    if (!editingListId) return
    if (currentListTitleIds.has(titleId)) return
    const editingDefaultList = defaultLists.find((list) => list.id === editingListId)
    if (editingDefaultList) {
      const conflict = defaultLists.find(
        (list) => list.id && list.id !== editingListId && list.titleIds.has(titleId)
      )
      if (conflict) {
        setMovePrompt({
          titleId,
          title: result.title,
          fromListId: conflict.id as string,
          fromListName: conflict.name,
          toListId: editingListId,
          toListName: editingDefaultList.name,
        })
        return
      }
    }
    setAddingTitleId(titleId)
    try {
      await addTitleToListAction({ listId: editingListId, titleId })
      toast.success("Added to list")
      if (sessionToken) await reloadProfile(sessionToken)
    } catch (error) {
      console.error("Failed to add title to list", error)
      toast.error("Failed to add title to list")
    } finally {
      setAddingTitleId(null)
    }
  }

  const confirmMove = async () => {
    if (!movePrompt) return
    setAddingTitleId(movePrompt.titleId)
    try {
      await removeTitleFromListAction({ listId: movePrompt.fromListId, titleId: movePrompt.titleId })
      await addTitleToListAction({ listId: movePrompt.toListId, titleId: movePrompt.titleId })
      toast.success(`Moved to ${movePrompt.toListName}`)
      if (sessionToken) await reloadProfile(sessionToken)
    } catch (error) {
      console.error("Failed to move title", error)
      toast.error("Failed to move title")
    } finally {
      setAddingTitleId(null)
      setMovePrompt(null)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <div className="container px-4 py-8 max-w-5xl mx-auto">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Edit Lists</h1>
            <p className="text-sm text-muted-foreground">Manage your default and custom lists.</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/profile">Back to profile</Link>
          </Button>
        </div>

        <Card className="border-2" id="title-lists">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Title Lists
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                variant={activeList === "to-read" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveList("to-read")}
              >
                Planned Reading
              </Button>
              <Button
                variant={activeList === "current-reading" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveList("current-reading")}
              >
                Current Reading
              </Button>
              <Button
                variant={activeList === "finished" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveList("finished")}
              >
                Finished Reading
              </Button>
              {customLists.map((list: any) => (
                <Button
                  key={list.id}
                  variant={activeList === list.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveList(list.id)}
                >
                  {list.name}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={openCreateList}>
                +
              </Button>
            </div>

            {activeList === "finished" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-end">
                  <Button variant="outline" size="sm" onClick={openEditFinishedReadingList}>
                    Edit list
                  </Button>
                </div>
                {finishedReadingTitles.length === 0 ? (
                <p className="text-sm text-muted-foreground">You haven’t finished any titles yet.</p>
              ) : (
                <div className="space-y-4">
                  {finishedReadingTitles.map((entry: any) => (
                    <div key={entry.title_id} className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={entry.titles?.cover_image_url || undefined} />
                        <AvatarFallback>{entry.titles?.title?.[0] ?? "T"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/titles/${entry.titles?.id ?? entry.title_id}`}
                          className="font-medium truncate hover:underline"
                        >
                          {entry.titles?.title ?? "Untitled"}
                        </Link>
                        <p className="text-sm text-muted-foreground truncate">{entry.titles?.author ?? "Unknown author"}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveFromList(profileData.finishedReadingListId, entry.title_id)}
                        disabled={isRemoving === entry.title_id}
                      >
                        {isRemoving === entry.title_id ? "Removing..." : "Remove"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              </div>
            ) : activeList === "to-read" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-end">
                  <Button variant="outline" size="sm" onClick={openEditToReadList}>
                    Edit list
                  </Button>
                </div>
                {toReadTitles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Your Planned Reading list is empty.</p>
                ) : (
                  <div className="space-y-4">
                    {toReadTitles.map((entry: any) => (
                      <div key={entry.title_id} className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={entry.titles?.cover_image_url || undefined} />
                          <AvatarFallback>{entry.titles?.title?.[0] ?? "T"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/titles/${entry.titles?.id ?? entry.title_id}`}
                            className="font-medium truncate hover:underline"
                          >
                            {entry.titles?.title ?? "Untitled"}
                          </Link>
                          <p className="text-sm text-muted-foreground truncate">{entry.titles?.author ?? "Unknown author"}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveFromList(profileData.toReadListId, entry.title_id)}
                          disabled={isRemoving === entry.title_id}
                        >
                          {isRemoving === entry.title_id ? "Removing..." : "Remove"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeList === "current-reading" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-end">
                  <Button variant="outline" size="sm" onClick={openEditCurrentReadingList}>
                    Edit list
                  </Button>
                </div>
                {currentReadingTitles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">You have no titles in Current Reading.</p>
                ) : (
                  <div className="space-y-4">
                    {currentReadingTitles.map((entry: any) => (
                      <div key={entry.title_id} className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={entry.titles?.cover_image_url || undefined} />
                          <AvatarFallback>{entry.titles?.title?.[0] ?? "T"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/titles/${entry.titles?.id ?? entry.title_id}`}
                            className="font-medium truncate hover:underline"
                          >
                            {entry.titles?.title ?? "Untitled"}
                          </Link>
                          <p className="text-sm text-muted-foreground truncate">{entry.titles?.author ?? "Unknown author"}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveFromList(profileData.currentReadingListId, entry.title_id)}
                          disabled={isRemoving === entry.title_id}
                        >
                          {isRemoving === entry.title_id ? "Removing..." : "Remove"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              (() => {
                const list = customLists.find((item: any) => item.id === activeList)
                if (!list) return <p className="text-sm text-muted-foreground">Select a list.</p>
                const items = list.items ?? []
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">Likes: {list.likesCount ?? 0}</div>
                      <Button variant="outline" size="sm" onClick={() => openEditList(list)}>
                        Edit list
                      </Button>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">This list is empty.</p>
                    ) : (
                      items.map((entry: any) => (
                        <div key={entry.title_id} className="flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={entry.titles?.cover_image_url || undefined} />
                            <AvatarFallback>{entry.titles?.title?.[0] ?? "T"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/titles/${entry.titles?.id ?? entry.title_id}`}
                              className="font-medium truncate hover:underline"
                            >
                              {entry.titles?.title ?? "Untitled"}
                            </Link>
                            <p className="text-sm text-muted-foreground truncate">{entry.titles?.author ?? "Unknown author"}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveFromList(list.id, entry.title_id)}
                            disabled={isRemoving === entry.title_id}
                          >
                            {isRemoving === entry.title_id ? "Removing..." : "Remove"}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )
              })()
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={createListOpen || editListOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateListOpen(false)
            setEditListOpen(false)
            setEditingListLabel(null)
            setSearchQuery("")
            setSearchAuthor("")
            setIncludeExternal(false)
            setSelectedGenres([])
            setSearchResults([])
            setIsSearching(false)
            setMovePrompt(null)
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editListOpen
                ? `Edit list — ${editingListLabel ?? listName ?? "List"}`
                : "Create list"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {createListOpen || (editListOpen && !isEditingDefaultList) ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="list-name">List name</Label>
                  <Input
                    id="list-name"
                    value={listName}
                    onChange={(event) => setListName(event.target.value)}
                    placeholder="My favorites"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="list-public">Public</Label>
                  <Switch id="list-public" checked={listPublic} onCheckedChange={setListPublic} />
                </div>
              </>
            ) : null}

            {editListOpen ? (
              <div className="space-y-3">
                <Label>Add titles</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Title"
                  />
                  <Input
                    value={searchAuthor}
                    onChange={(event) => setSearchAuthor(event.target.value)}
                    placeholder="Author (optional)"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="list-include-external"
                    checked={includeExternal}
                    onCheckedChange={(value) => {
                      setIncludeExternal(value)
                      if (value) setSelectedGenres([])
                    }}
                  />
                  <Label htmlFor="list-include-external" className="text-sm text-muted-foreground">
                    Include external results
                  </Label>
                </div>

                <div className="flex flex-nowrap gap-2 w-full overflow-x-auto pb-1">
                  {GENRES.map((genre) => (
                    <GenreToggleButton
                      key={genre}
                      genre={genre}
                      selected={selectedGenres.includes(genre)}
                      onToggle={toggleGenre}
                      className={includeExternal ? "opacity-50 pointer-events-none" : undefined}
                    />
                  ))}
                </div>

                {isSearching ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </div>
                ) : (searchQuery.trim() || searchAuthor.trim()) && filteredSearchResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No matching titles.</p>
                ) : null}

                {filteredSearchResults.length > 0 ? (
                  <div className="max-h-[50vh] overflow-y-auto pr-2">
                    <TrackReadingResultList
                      results={filteredSearchResults}
                      onAction={(titleId, result) => handleAddFromSearch(titleId, result)}
                      actionLoadingId={addingTitleId}
                      actionLabel="Add to list"
                      actionDisabledLabel="Added"
                      isActionDisabled={(titleId) => currentListTitleIds.has(titleId)}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateListOpen(false)
                  setEditListOpen(false)
                  setEditingListLabel(null)
                  setSearchQuery("")
                  setSearchAuthor("")
                  setIncludeExternal(false)
                  setSelectedGenres([])
                  setSearchResults([])
                  setIsSearching(false)
                  setMovePrompt(null)
                }}
              >
                Cancel
              </Button>
              {createListOpen || (editListOpen && !isEditingDefaultList) ? (
                <Button onClick={saveList} disabled={savingList || !listName.trim()}>
                  {savingList ? "Saving..." : "Save"}
                </Button>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(movePrompt)}
        onOpenChange={(open) => {
          if (!open) setMovePrompt(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Move title?</DialogTitle>
          </DialogHeader>
          {movePrompt ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                “{movePrompt.title}” is already in {movePrompt.fromListName}. Move it to {movePrompt.toListName}?
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMovePrompt(null)}>
                  Cancel
                </Button>
                <Button onClick={confirmMove} disabled={addingTitleId === movePrompt.titleId}>
                  {addingTitleId === movePrompt.titleId ? "Moving..." : "Move"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  )
}
