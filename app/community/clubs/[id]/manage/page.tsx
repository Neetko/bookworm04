import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getClub, getClubApplications, getClubInvitations, getClubMembers, getClubReadingItems, getMyProfile } from "@/app/actions/clubs"
import { ClubManageForm } from "@/components/club-manage-form"

export default async function ClubManagePage({ params }: { params: Promise<{ id: string }> }) {
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

  const me = await getMyProfile()
  const isOwner = !!me.profileId && me.profileId === club.owner_user_id

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Not authorized</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">Only the club owner can manage this club.</CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const [members, readingItems, pendingApplications, pendingInvitations] = await Promise.all([
    getClubMembers(id),
    getClubReadingItems(id),
    getClubApplications(id),
    getClubInvitations(id),
  ])

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Manage club</h1>
          <p className="text-muted-foreground mt-1">Update details, manage join settings, review applications, and track invitations.</p>
        </div>

        <ClubManageForm
          club={club}
          members={members}
          readingItems={readingItems}
          pendingApplications={pendingApplications}
          pendingInvitations={pendingInvitations}
        />
      </div>
    </div>
  )
}
