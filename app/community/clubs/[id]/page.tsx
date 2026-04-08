import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getClub, getClubCurrentReading, getClubCurrentReadingComments, getClubMembers, getClubReadingItems, getMyMembership, getMyProfile } from "@/app/actions/clubs"
import { ClubMembershipButton } from "@/components/club-membership-button"
import { ClubApplyButton } from "@/components/club-apply-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { normalizeGenres } from "@/lib/types"
import { ClubCurrentReadingSection, type ClubCurrentReadingComment } from "@/components/club-current-reading"

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

  const { isMember } = await getMyMembership(id)
  const me = await getMyProfile()
  const isOwner = !!me.profileId && me.profileId === club.owner_user_id
  const canManage = isOwner

  const members = await getClubMembers(id)
  const readingItems = (await getClubReadingItems(id)) as Array<{
    id: string
    book_id: string | null
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
    book?: { id: string; title: string; author: string } | null
  }>
  const currentReading = await getClubCurrentReading(id)
  const rawComments = (await getClubCurrentReadingComments(id)) as Array<{
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
                <CardTitle className="text-2xl">{club.name}</CardTitle>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={club.type === "book" ? "default" : "secondary"}>
                    {club.type === "book" ? "Book club" : "Writer club"}
                  </Badge>
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
                    ) : (
                      <ClubApplyButton clubId={club.id} />
                    ))}
                </div>

                <div className="flex flex-col gap-2 text-right">
                  {club.owner?.username ? (
                    <span className="text-sm text-muted-foreground">Owner: {club.owner.username}</span>
                  ) : null}
                  {currentReading ? (
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
            <TabsTrigger value="reading">Planned reading</TabsTrigger>
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
                        const content = (
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={m.avatar_url ?? undefined} />
                              <AvatarFallback>
                                {(m.username ?? "?").slice(0, 1).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {m.username ?? "Unnamed"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {isOwnerMember ? "Owner 👑" : "Member"}
                              </div>
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
                <CardTitle>Planned reading</CardTitle>
              </CardHeader>
              <CardContent>
                {readingItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No titles selected yet.</div>
                ) : (
                  <div className="grid gap-3">
                    {readingItems.map((item) => {
                      const titleRecord = item.title_data ?? item.book
                      const title = titleRecord?.title ?? item.title ?? "Untitled"
                      const author = titleRecord?.author ?? item.author ?? ""
                      const coverUrl = item.title_data?.cover_image_url ?? null
                      const linkId = item.title_data?.id ?? item.book?.id ?? null

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
                              <Badge variant={item.book ? "default" : "secondary"}>
                                {item.book ? "In library" : "Not in library"}
                              </Badge>
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

        <ClubCurrentReadingSection
          clubId={club.id}
          title={currentReading}
          canPost={isMember}
          canView={true}
          initialComments={currentComments}
        />

      </div>
    </div>
  )
}
