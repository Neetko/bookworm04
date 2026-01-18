import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getClub, getClubMembers, getClubReadingItems, getMyMembership, getMyProfile } from "@/app/actions/clubs"
import { ClubMembershipButton } from "@/components/club-membership-button"
import { ClubApplyButton } from "@/components/club-apply-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { normalizeGenres } from "@/lib/types"

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

  const { isMember, profileId } = await getMyMembership(id)
  const me = await getMyProfile()
  const isOwner = !!me.profileId && me.profileId === club.owner_user_id
  const canManage = isOwner

  const members = await getClubMembers(id)
  const readingItems = await getClubReadingItems(id)

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">{club.name}</CardTitle>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={club.type === "book" ? "default" : "secondary"}>
                    {club.type === "book" ? "Book club" : "Writer club"}
                  </Badge>
                  {club.owner?.username && (
                    <span className="text-sm text-muted-foreground">Owner: {club.owner.username}</span>
                  )}
                </div>
              </div>

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
                      members.map((m) => (
                        <div key={m.id} className="flex items-center gap-3">
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
                            {m.role && <div className="text-xs text-muted-foreground">{m.role}</div>}
                          </div>
                        </div>
                      ))
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
                    {readingItems.map((item: any) => {
                      const inLibrary = !!item.book
                      const title = inLibrary ? item.book.title : (item.title ?? "Untitled")
                      const author = inLibrary ? item.book.author : (item.author ?? "")

                      return (
                        <Card key={item.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="truncate font-medium">
                                  {inLibrary ? (
                                    <Link href={`/books/${item.book.id}`} className="hover:underline">
                                      {title}
                                    </Link>
                                  ) : (
                                    title
                                  )}
                                </div>
                                {author && <div className="text-sm text-muted-foreground">{author}</div>}
                              </div>

                              <Badge variant={inLibrary ? "default" : "secondary"}>
                                {inLibrary ? "In library" : "Not in library"}
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

      </div>
    </div>
  )
}
