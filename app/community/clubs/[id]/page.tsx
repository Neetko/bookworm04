import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getClub, getMyMembership } from "@/app/actions/clubs"
import { ClubMembershipButton } from "@/components/club-membership-button"
import { ClubEditForm } from "@/components/club-edit-form"

export default async function ClubPage({ params }: { params: { id: string } }) {
  const club = await getClub(params.id)

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

  const { isMember, profileId } = await getMyMembership(params.id)
  const isOwner = !!profileId && profileId === club.owner_user_id

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

              {!isOwner && <ClubMembershipButton clubId={club.id} initialIsMember={isMember} />}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{club.description || "No description yet."}</p>
          </CardContent>
        </Card>

        {isOwner && (
          <ClubEditForm
            clubId={club.id}
            initialType={club.type}
            initialName={club.name}
            initialDescription={club.description || ""}
          />
        )}
      </div>
    </div>
  )
}
