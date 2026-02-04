import { Suspense } from "react"
import { Navigation } from "@/components/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { CommunityHeader } from "@/components/community-header"
import { ClubGrid } from "@/components/club-grid"
import { getClubs } from "@/app/actions/clubs"
import { isGenre } from "@/lib/types"

type ClubType = "book" | "writer"

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; t?: string; genres?: string }>
}) {
  const params = await searchParams
  const query = params.q?.trim() || ""
  const selectedTypes = params.t
    ? params.t
        .split(",")
        .map((value) => value.trim())
        .filter((value): value is ClubType => value === "book" || value === "writer")
    : []
  const selectedGenres = params.genres
    ? params.genres
        .split(",")
        .map((value) => value.trim())
        .filter(isGenre)
    : []

  const clubs = await getClubs()

  const filtered = clubs.filter((club) => {
    if (selectedTypes.length > 0 && !selectedTypes.includes(club.type)) return false

    if (selectedGenres.length > 0) {
      const clubGenres = club.categories ?? []
      if (clubGenres.length === 0) return false
      const hasAll = selectedGenres.every((genre) => clubGenres.includes(genre))
      if (!hasAll) return false
    }

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

        {filtered.length === 0 ? (
          <Card className="mt-8 sm:col-span-2 lg:col-span-3">
            <CardContent className="py-10 text-center text-muted-foreground">
              No clubs found.
            </CardContent>
          </Card>
        ) : (
          <ClubGrid clubs={filtered} />
        )}
      </div>
    </div>
  )
}
