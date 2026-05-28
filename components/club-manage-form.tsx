"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, Loader2, Mail, UploadCloud, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import { normalizeGenres, type Genre } from "@/lib/types"
import { CanonGenreToggleGroup } from "@/components/canon-genre-toggle-group"
import { ClubTitleSearch } from "@/components/club-title-search"
import {
  acceptClubApplication,
  addClubReadingItem,
  declineClubApplication,
  inviteMemberToClub,
  kickMemberFromClub,
  removeClubReadingItem,
  setClubCurrentReading,
  uploadClubAvatar,
  updateClubSettings,
} from "@/app/actions/clubs"

type ClubType = "book" | "writer"
type ClubJoinPolicy = "open" | "approval_required" | "invite_only"

const JOIN_POLICY_LABEL: Record<ClubJoinPolicy, string> = {
  open: "Open",
  approval_required: "Approval required",
  invite_only: "Invite only",
}

type Club = {
  id: string
  type: ClubType
  join_policy: ClubJoinPolicy
  name: string
  description: string | null
  categories: Genre[] | null
  avatar_url: string | null
  current_title_id?: string | null
}

type Member = { id: string; username: string | null; avatar_url: string | null; role: string | null }
type PendingApplication = {
  id: string
  user_id: string
  created_at: string
  user: Member | null
}
type PendingInvitation = {
  id: string
  invitee_user_id: string
  created_at: string
  invitee: Member | null
}

type InviteCandidate = {
  id: string
  username: string | null
  avatar_url: string | null
  relationship: "friend" | "following" | "follows_you" | "other"
}

const RELATIONSHIP_LABEL: Record<InviteCandidate["relationship"], string> = {
  friend: "Friend",
  following: "You follow",
  follows_you: "Follows you",
  other: "Reader",
}

type ReadingItem = {
  id: string
  title_id?: string | null
  title: string | null
  author: string | null
  title_data?: { id: string; title: string; author: string; cover_image_url: string | null } | null
}

export function ClubManageForm({
  club,
  members,
  readingItems,
  pendingApplications,
  pendingInvitations,
}: {
  club: Club
  members: Member[]
  readingItems: ReadingItem[]
  pendingApplications: PendingApplication[]
  pendingInvitations: PendingInvitation[]
}) {
  const router = useRouter()

  const initialCategories = useMemo(() => normalizeGenres(club.categories), [club.categories])

  const [name, setName] = useState(club.name)
  const [avatarUrl, setAvatarUrl] = useState(club.avatar_url ?? "")
  const [description, setDescription] = useState(club.description ?? "")
  const [categories, setCategories] = useState<Genre[]>(initialCategories)
  const [joinPolicy, setJoinPolicy] = useState<ClubJoinPolicy>(club.join_policy ?? "approval_required")
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
        joinPolicy,
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
  const [selectedInvitee, setSelectedInvitee] = useState<InviteCandidate | null>(null)
  const [isInviting, setIsInviting] = useState(false)
  const [inviteSuggestions, setInviteSuggestions] = useState<InviteCandidate[]>([])
  const [inviteSuggestionsOpen, setInviteSuggestionsOpen] = useState(false)
  const [loadingInviteSuggestions, setLoadingInviteSuggestions] = useState(false)
  const [applicationActionId, setApplicationActionId] = useState<string | null>(null)
  const inviteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectedInviteSuggestions = inviteSuggestions.filter((candidate) => candidate.relationship !== "other")
  const otherInviteSuggestions = inviteSuggestions.filter((candidate) => candidate.relationship === "other")

  useEffect(() => {
    if (selectedInvitee && selectedInvitee.username !== inviteUsername.trim()) {
      setSelectedInvitee(null)
    }
  }, [inviteUsername, selectedInvitee])

  useEffect(() => {
    const query = inviteUsername.trim()

    if (!query) {
      setInviteSuggestions([])
      setInviteSuggestionsOpen(false)
      setLoadingInviteSuggestions(false)
      return
    }

    if (inviteTimer.current) {
      clearTimeout(inviteTimer.current)
    }

    inviteTimer.current = setTimeout(async () => {
      setLoadingInviteSuggestions(true)
      try {
        const response = await fetch(
          `/api/community/clubs/${encodeURIComponent(club.id)}/invite-candidates?q=${encodeURIComponent(query)}`
        )
        const data = await response.json()
        const results = Array.isArray(data?.results) ? (data.results as InviteCandidate[]) : []
        setInviteSuggestions(results)
        setInviteSuggestionsOpen(true)
      } catch (error) {
        console.error(error)
        setInviteSuggestions([])
        setInviteSuggestionsOpen(true)
      } finally {
        setLoadingInviteSuggestions(false)
      }
    }, 200)

    return () => {
      if (inviteTimer.current) {
        clearTimeout(inviteTimer.current)
      }
    }
  }, [club.id, inviteUsername])

  const onInvite = async () => {
    if (!selectedInvitee?.id) {
      toast.error("Pick a reader from the suggestions before inviting")
      return
    }

    setIsInviting(true)
    try {
      await inviteMemberToClub(club.id, {
        profileId: selectedInvitee.id,
      })

      toast.success(`Invited ${selectedInvitee.username ?? "reader"}`)
      setInviteUsername("")
      setSelectedInvitee(null)
      setInviteSuggestions([])
      setInviteSuggestionsOpen(false)
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Failed to invite")
    } finally {
      setIsInviting(false)
    }
  }

  const onApproveApplication = async (applicationId: string) => {
    setApplicationActionId(applicationId)
    try {
      await acceptClubApplication(club.id, applicationId)
      toast.success("Application approved")
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error("Failed to approve application")
    } finally {
      setApplicationActionId(null)
    }
  }

  const onDeclineApplication = async (applicationId: string) => {
    setApplicationActionId(applicationId)
    try {
      await declineClubApplication(club.id, applicationId)
      toast.success("Application declined")
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error("Failed to decline application")
    } finally {
      setApplicationActionId(null)
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
            <CanonGenreToggleGroup
              selectedGenres={categories}
              onToggle={toggleCategory}
              buttonClassName="flex-1 min-w-0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Join policy</label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={joinPolicy}
              onChange={(event) => setJoinPolicy(event.target.value as ClubJoinPolicy)}
            >
              <option value="open">Open — anyone can join instantly</option>
              <option value="approval_required">Approval required — applications stay pending until you review them</option>
              <option value="invite_only">Invite only — only invited readers can join</option>
            </select>
            <p className="mt-2 text-xs text-muted-foreground">
              Current setting: {JOIN_POLICY_LABEL[joinPolicy]}
            </p>
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
                    const titleRecord = item.title_data ?? null
                    const title = titleRecord?.title ?? item.title ?? "Untitled"
                    const author = titleRecord?.author ?? item.author ?? ""
                    const titleId = item.title_id ?? null

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
                  const titleRecord = item.title_data ?? null
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
            <div className="relative">
              <div className="flex gap-2">
                <Input
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  onFocus={() => setInviteSuggestionsOpen(inviteSuggestions.length > 0)}
                  onBlur={() => {
                    window.setTimeout(() => setInviteSuggestionsOpen(false), 150)
                  }}
                  placeholder="Search readers by username"
                />
                <Button onClick={onInvite} disabled={isInviting || !selectedInvitee?.id}>
                  {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Invite
                </Button>
              </div>
              {(inviteSuggestionsOpen || loadingInviteSuggestions) && (
                <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-md border bg-popover shadow-md">
                  <Command shouldFilter={false}>
                    <CommandList>
                      {loadingInviteSuggestions ? (
                        <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading suggestions...
                        </div>
                      ) : inviteSuggestions.length === 0 ? (
                        <CommandEmpty>No matching readers.</CommandEmpty>
                      ) : (
                        <>
                          {connectedInviteSuggestions.length > 0 ? (
                            <CommandGroup heading="Connected readers">
                              {connectedInviteSuggestions.map((candidate) => (
                                <CommandItem
                                  key={candidate.id}
                                  value={`${candidate.username ?? ""}-${candidate.id}`}
                                  onSelect={() => {
                                    setInviteUsername(candidate.username ?? "")
                                    setSelectedInvitee(candidate)
                                    setInviteSuggestionsOpen(false)
                                  }}
                                >
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={candidate.avatar_url ?? undefined} />
                                    <AvatarFallback>
                                      {(candidate.username ?? "?").slice(0, 1).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate font-medium">{candidate.username ?? "Unnamed"}</div>
                                  </div>
                                  <Badge variant="secondary">{RELATIONSHIP_LABEL[candidate.relationship]}</Badge>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          ) : null}
                          {otherInviteSuggestions.length > 0 ? (
                            <CommandGroup heading="Other readers">
                              {otherInviteSuggestions.map((candidate) => (
                                <CommandItem
                                  key={candidate.id}
                                  value={`${candidate.username ?? ""}-${candidate.id}`}
                                  onSelect={() => {
                                    setInviteUsername(candidate.username ?? "")
                                    setSelectedInvitee(candidate)
                                    setInviteSuggestionsOpen(false)
                                  }}
                                >
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={candidate.avatar_url ?? undefined} />
                                    <AvatarFallback>
                                      {(candidate.username ?? "?").slice(0, 1).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate font-medium">{candidate.username ?? "Unnamed"}</div>
                                  </div>
                                  <Badge variant="outline">{RELATIONSHIP_LABEL[candidate.relationship]}</Badge>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          ) : null}
                        </>
                      )}
                    </CommandList>
                  </Command>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Search all readers. Friends and follows are ranked first, and you can only invite someone after selecting them from the list.
            </p>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium">Pending applications</div>
            {pendingApplications.length === 0 ? (
              <div className="text-sm text-muted-foreground">No pending applications.</div>
            ) : (
              pendingApplications.map((application) => (
                <div
                  key={application.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/30 p-3 opacity-80"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={application.user?.avatar_url ?? undefined} />
                      <AvatarFallback>
                        {(application.user?.username ?? "?").slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {application.user?.username ?? "Unnamed"}
                      </div>
                      <div className="text-xs text-muted-foreground">Awaiting review</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => onApproveApplication(application.id)}
                      disabled={applicationActionId === application.id}
                    >
                      {applicationActionId === application.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDeclineApplication(application.id)}
                      disabled={applicationActionId === application.id}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium">Pending invitations</div>
            {pendingInvitations.length === 0 ? (
              <div className="text-sm text-muted-foreground">No pending invitations.</div>
            ) : (
              pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/30 p-3 opacity-80"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={invitation.invitee?.avatar_url ?? undefined} />
                      <AvatarFallback>
                        {(invitation.invitee?.username ?? "?").slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {invitation.invitee?.username ?? "Unnamed"}
                      </div>
                      <div className="text-xs text-muted-foreground">Invite sent — waiting for reply</div>
                    </div>
                  </div>

                  <Badge variant="outline" className="gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    Pending
                  </Badge>
                </div>
              ))
            )}
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
