import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getClub, getClubCurrentReading, getClubCurrentReadingComments, getClubMemberCurrentProgress, getClubMembers, getClubReadingItems, getMyMembership, getMyProfile } from "@/app/actions/clubs"
import { getVisibleClubWriterWorks } from "@/app/actions/club-writer-works"
import { ClubMembershipButton } from "@/components/club-membership-button"
import { ClubApplyButton } from "@/components/club-apply-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { PenLine } from "lucide-react"
import Link from "next/link"
import { normalizeGenres } from "@/lib/types"
import { ClubCurrentReadingSection, type ClubCurrentReadingComment } from "@/components/club-current-reading"
import { ClubWriterWorkCard } from "@/components/club-writer-work-card"

const JOIN_POLICY_LABEL = {
  open: "Open",
  approval_required: "Approval required",
  invite_only: "Invite only",
} as const

export default async function ClubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const club = await getClub(id)

  if (!club) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Card>
            <CardContent className="py-10 text-center">Club not found</CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const membership = await getMyMembership(id)
  const me = await getMyProfile()
  const isOwner = !!me.profileId && me.profileId === club.owner_user_id
  const canManage = isOwner
  const isMember = membership.isMember
  const isWriterClub = club.type === "writer"

  const members = await getClubMembers(id)
  const readingItems = (isWriterClub ? [] : await getClubReadingItems(id)) as Array<{
    id: string
    title_id?: string | null
    title: string | null
    author: string | null
    created_at?: string
    title_data?: {
      id: string
      title: string
      author: string
      cover_image_url: string | null
    } | null
  }>
  const currentReading = isWriterClub ? null : await getClubCurrentReading(id)
  const writerWorks = isWriterClub && isMember ? await getVisibleClubWriterWorks(id) : []
  const memberProgress = !isWriterClub && isMember && currentReading ? await getClubMemberCurrentProgress(id) : []
  const memberProgressMap = new Map(memberProgress.map((item) => [item.user_id, item]))
  const rawComments = (!isWriterClub && isMember ? await getClubCurrentReadingComments(id) : []) as Array<{
    id: string
    content: string
    created_at: string
    likes_count: number
    user_profiles:
      | { username: string | null; avatar_url: string | null }
      | Array<{ username: string | null; avatar_url: string | null }>
      | null
  }>
  const currentComments = rawComments.map((row) => ({
    ...row,
    user_profiles: Array.isArray(row.user_profiles)
      ? row.user_profiles[0] ?? null
      : row.user_profiles,
  })) as ClubCurrentReadingComment[]

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-stretch justify-between gap-4">
              <div className="flex flex-col">
                <CardTitle className="text-2xl" role="heading" aria-level={1}>
                  {club.name}
                </CardTitle>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={club.type === "book" ? "default" : "secondary"}>
                    {club.type === "book" ? "Book club" : "Writer club"}
                  </Badge>
                  <Badge variant="outline">{JOIN_POLICY_LABEL[club.join_policy]}</Badge>
                </div>
              </div>

              <div className="ml-auto flex flex-col items-end text-right self-stretch justify-between gap-2">
                <div className="flex items-center gap-2">
                  {canManage && (
                    <Button asChild variant="secondary">
                      <Link href={`/community/clubs/${club.id}/manage`}>Manage</Link>
                    </Button>
                  )}

                  {!canManage &&
                    (isMember ? (
                      <ClubMembershipButton clubId={club.id} initialIsMember={isMember} />
                    ) : membership.pendingInvitation && membership.invitationId ? (
                      <ClubApplyButton clubId={club.id} invitationId={membership.invitationId} />
                    ) : club.join_policy === "open" ? (
                      <ClubMembershipButton clubId={club.id} initialIsMember={false} />
                    ) : club.join_policy === "invite_only" ? (
                      <Button variant="outline" disabled>
                        Invite only
                      </Button>
                    ) : (
                      <ClubApplyButton clubId={club.id} pending={membership.pendingApplication} />
                    ))}
                </div>

                <div className="flex flex-col gap-2 text-right">
                  {club.owner?.username ? (
                    <span className="text-sm text-muted-foreground">Owner: {club.owner.username}</span>
                  ) : null}
                  {!isWriterClub && currentReading ? (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Current reading:</span> {currentReading.title}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{club.description || "No description yet."}</p>

            {normalizeGenres(club.categories).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {normalizeGenres(club.categories).map((c) => (
                  <Badge key={c} variant="outline">
                    {c}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="members" className="w-full">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="reading">{isWriterClub ? "Written Works" : "Planned reading"}</TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle>Members</CardTitle>
                  <span className="text-sm text-muted-foreground">{members.length} total</span>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-72">
                  <div className="space-y-3 pr-2">
                    {members.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No members yet.</div>
                    ) : (
                      members.map((m) => {
                        const isOwnerMember = m.id === club.owner_user_id
                        const progress = memberProgressMap.get(m.id)
                        const content = (
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={m.avatar_url ?? undefined} />
                              <AvatarFallback>
                                {(m.username ?? "?").slice(0, 1).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">
                                {m.username ?? "Unnamed"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {isOwnerMember ? "Owner 👑" : "Member"}
                              </div>
                              {!isWriterClub && progress ? (
                                <div className="mt-2 space-y-1">
                                  <Progress value={progress.progress_percent} className="h-2" />
                                  <div className="text-[11px] text-muted-foreground">
                                    {progress.is_completed
                                      ? "Finished"
                                      : progress.total_pages
                                        ? `${progress.progress_percent}% • ${progress.current_page ?? 0}/${progress.total_pages} pages`
                                        : progress.total_minutes
                                          ? `${progress.progress_percent}% • ${progress.minutes_listened ?? 0}/${progress.total_minutes} min`
                                          : `${progress.progress_percent}% complete`}
                                  </div>
                                </div>
                                ) : !isWriterClub && isMember && currentReading ? (
                                <div className="mt-2 text-[11px] text-muted-foreground">No progress shared yet.</div>
                              ) : null}
                            </div>
                          </div>
                        )

                        return (
                          <div key={m.id} className="flex items-center gap-3">
                            {m.id ? (
                              <Link href={`/users/${encodeURIComponent(m.id)}`} className="hover:underline">
                                {content}
                              </Link>
                            ) : (
                              content
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reading">
            <Card>
              <CardHeader>
                <CardTitle>{isWriterClub ? "Written Works" : "Planned reading"}</CardTitle>
              </CardHeader>
              <CardContent>
                {isWriterClub ? !isMember ? (
                  <div className="text-sm text-muted-foreground">Join this writer club to read members&apos; published works.</div>
                ) : writerWorks.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No published works yet.</div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {writerWorks.map((work) => (
                      <ClubWriterWorkCard key={work.id} clubId={club.id} work={work} canLike={isMember} />
                    ))}
                  </div>
                ) : readingItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No titles selected yet.</div>
                ) : (
                  <div className="grid gap-3">
                    {readingItems.map((item) => {
                      const titleRecord = item.title_data ?? null
                      const title = titleRecord?.title ?? item.title ?? "Untitled"
                      const author = titleRecord?.author ?? item.author ?? ""
                      const coverUrl = item.title_data?.cover_image_url ?? null
                      const linkId = item.title_data?.id ?? null

                      return (
                        <Card key={item.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <Avatar className="h-12 w-12">
                                <AvatarImage src={coverUrl ?? undefined} />
                                <AvatarFallback>{title[0] ?? "T"}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">
                                  {linkId ? (
                                    <Link href={`/titles/${linkId}`} className="hover:underline">
                                      {title}
                                    </Link>
                                  ) : (
                                    title
                                  )}
                                </div>
                                {author && <div className="text-sm text-muted-foreground">{author}</div>}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {isWriterClub ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-4 py-10 text-center">
              <div className="space-y-2">
                <div className="text-2xl font-semibold">Start something new</div>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Open the writer&apos;s editor, draft freely, and publish when you&apos;re ready for fellow club members to read.
                </p>
              </div>

              {isMember ? (
                <Button asChild size="lg" className="h-14 px-8 text-base">
                  <Link href={`/community/clubs/${club.id}/write`}>
                    <PenLine className="mr-2 h-5 w-5" />
                    Start Writing
                  </Link>
                </Button>
              ) : (
                <Button size="lg" className="h-14 px-8 text-base" disabled>
                  <PenLine className="mr-2 h-5 w-5" />
                  Join to start writing
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <ClubCurrentReadingSection
            clubId={club.id}
            title={currentReading}
            canPost={isMember}
            canView={isMember}
            initialComments={currentComments}
          />
        )}

      </div>
    </div>
  )
}
