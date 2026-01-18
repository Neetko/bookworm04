"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { GENRE_BG_CLASS, normalizeGenres, type Genre } from "@/lib/types"
import { cn } from "@/lib/utils"

type ClubType = "book" | "writer"

export type ClubCardClub = {
  id: string
  type: ClubType
  name: string
  description: string | null
  categories: Genre[] | null
  memberCount: number
}

export function ClubCard({ club }: { club: ClubCardClub }) {
  const categories = normalizeGenres(club.categories)

  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Link
          href={`/community/clubs/${club.id}`}
          className="block focus:outline-none"
        >
          <Card className="group flex h-full flex-col transition-[transform,box-shadow] duration-200 hover:shadow-md hover:scale-[1.02]">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-xl leading-tight">
                  <span className="group-hover:underline">{club.name}</span>
                </CardTitle>
                <Badge variant={club.type === "book" ? "default" : "secondary"}>
                  {club.type === "book" ? "Book club" : "Writer club"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {club.description || "No description yet."}
              </p>

              <div className="mt-auto flex items-center justify-between pt-3">
                <div className="flex items-center gap-1.5">
                  {categories.map((c) => (
                    <span
                      key={c}
                      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", GENRE_BG_CLASS[c])}
                    />
                  ))}
                </div>

                <div className="text-xs text-muted-foreground tabular-nums">
                  {club.memberCount} {club.memberCount === 1 ? "member" : "members"}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </HoverCardTrigger>

      <HoverCardContent
        align="start"
        side="bottom"
        className="w-96 max-w-[calc(100vw-2rem)]"
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-semibold">{club.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {club.type === "book" ? "Book club" : "Writer club"}
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
            {club.description || "No description yet."}
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Badge
                  key={c}
                  variant="outline"
                  className={cn("border-transparent", GENRE_BG_CLASS[c])}
                >
                  {c}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
