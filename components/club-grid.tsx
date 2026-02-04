import { ClubCard, type ClubCardClub } from "@/components/club-card"

type ClubGridProps = {
  clubs: ClubCardClub[]
}

export function ClubGrid({ clubs }: ClubGridProps) {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clubs.map((club) => (
        <ClubCard key={club.id} club={club} />
      ))}
    </div>
  )
}
