import { Suspense } from "react"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CommunityHeader } from "@/components/community-header"
import { ClubCard } from "@/components/club-card"
import { getClubs } from "@/app/actions/clubs"

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; t?: string }>
}) {
  const params = await searchParams
  const query = params.q?.trim() || ""
  const type = params.t === "book" || params.t === "writer" ? params.t : ""

  const clubs = await getClubs()

  const filtered = clubs.filter((club) => {
    if (type && club.type !== type) return false
    if (!query) return true

    const haystack = `${club.name} ${club.description ?? ""}`.toLowerCase()
    return haystack.includes(query.toLowerCase())
  })

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Community</h1>
          <p className="text-muted-foreground mt-1">Join book clubs and writer clubs, or start your own.</p>
        </div>

        <Suspense fallback={<div className="h-16" />}> 
          <CommunityHeader />
        </Suspense>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <Card className="sm:col-span-2 lg:col-span-3">
              <CardContent className="py-10 text-center text-muted-foreground">
                No clubs found.
              </CardContent>
            </Card>
          ) : (
            filtered.map((club) => (
              <ClubCard key={club.id} club={club} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
