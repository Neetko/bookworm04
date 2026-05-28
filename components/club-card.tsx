"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { GENRE_BG_CLASS, normalizeGenres, type Genre } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type ClubType = "book" | "writer"
type ClubJoinPolicy = "open" | "approval_required" | "invite_only"

const JOIN_POLICY_LABEL: Record<ClubJoinPolicy, string> = {
  open: "Open",
  approval_required: "Approval required",
  invite_only: "Invite only",
}

export type ClubCardClub = {
  id: string
  type: ClubType
  join_policy: ClubJoinPolicy
  name: string
  description: string | null
  categories: Genre[] | null
  memberCount: number
  avatar_url: string | null
  currentReading: string | null
  plannedReading: string[]
}

export function ClubCard({ club }: { club: ClubCardClub }) {
  const categories = normalizeGenres(club.categories)
  const plannedPreview = club.type === "book" ? club.plannedReading ?? [] : []
  const plannedTop = plannedPreview.slice(0, 3)
  const hasMorePlanned = plannedPreview.length > 3

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
                <div className="flex flex-col gap-2 min-w-0">
                  <CardTitle className="text-xl leading-tight">{club.name}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={club.type === "book" ? "default" : "secondary"} className="w-fit">
                      {club.type === "book" ? "Book club" : "Writer club"}
                    </Badge>
                    <Badge variant="outline" className="w-fit">
                      {JOIN_POLICY_LABEL[club.join_policy]}
                    </Badge>
                  </div>
                </div>
                {club.avatar_url ? (
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={club.avatar_url ?? undefined} />
                    <AvatarFallback>{(club.name || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <p className="font-ui text-sm text-muted-foreground line-clamp-3">
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
          <div className="min-w-0">
            <div className="truncate font-semibold">{club.name}</div>
            <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>{club.type === "book" ? "Book club" : "Writer club"}</span>
              <span>•</span>
              <span>{JOIN_POLICY_LABEL[club.join_policy]}</span>
            </div>
          </div>

          <div className="font-ui text-sm text-muted-foreground whitespace-pre-wrap">
            {club.description || "No description yet."}
          </div>

          {club.type === "book" && plannedTop.length > 0 ? (
            <div className="space-y-1">
              <div className="text-xs font-medium text-foreground">Planned reading</div>
              <ul className="text-sm text-muted-foreground space-y-1">
                {plannedTop.map((title, idx) => (
                  <li key={`${title}-${idx}`} className="truncate">
                    {title}
                  </li>
                ))}
                {hasMorePlanned ? <li className="text-muted-foreground">...</li> : null}
              </ul>
            </div>
          ) : null}

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
