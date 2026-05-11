import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { CheckCircle2, FileText } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ClubWriterWorkLikeButton } from "@/components/club-writer-work-like-button"
import type { ClubWriterWorkListItem } from "@/app/actions/club-writer-works"

type ClubWriterWorkCardProps = {
  clubId: string
  work: ClubWriterWorkListItem
  canLike: boolean
}

export function ClubWriterWorkCard({ clubId, work, canLike }: ClubWriterWorkCardProps) {
  return (
    <Card className="overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
      <CardContent className="p-0">
        <Link href={`/community/clubs/${clubId}/works/${work.id}`} className="block p-5 hover:bg-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Writer club manuscript
              </div>
              <h3 className="mt-3 truncate text-xl font-semibold">{work.title}</h3>
            </div>

            {work.is_completed ? (
              <Badge variant="secondary" className="shrink-0 gap-1 border border-emerald-200 bg-emerald-50 font-medium text-emerald-700 shadow-none dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Complete
              </Badge>
            ) : null}
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Avatar className="h-6 w-6">
              <AvatarImage src={work.author?.avatar_url ?? undefined} />
              <AvatarFallback>{(work.author?.username ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span>{work.author?.username ?? "Unknown author"}</span>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(work.updated_at), { addSuffix: true })}</span>
          </div>

          <div className="mt-4 rounded-md border border-zinc-300 bg-white px-5 py-4 text-black shadow-[0_12px_35px_-18px_rgba(15,23,42,0.45)] ring-1 ring-black/5">
            <p className="line-clamp-5 whitespace-pre-line font-[Georgia,_Times_New_Roman,_serif] text-[15px] leading-7 tracking-normal text-zinc-900">
              {work.excerpt || "No preview available yet."}
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span>{work.is_public ? "Member edition" : "Private draft"}</span>
            <span>Open document</span>
          </div>
        </Link>

        <div className="flex items-center justify-between border-t px-5 py-3">
          <div className="text-xs text-muted-foreground">
            {work.is_public ? "Visible to club members" : "Private draft"}
          </div>
          <ClubWriterWorkLikeButton
            workId={work.id}
            initialCount={work.likes_count}
            initialLiked={work.viewer_has_liked}
            disabled={!canLike}
          />
        </div>
      </CardContent>
    </Card>
  )
}
