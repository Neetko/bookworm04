import Link from "next/link"
import { redirect } from "next/navigation"
import { CheckCircle2 } from "lucide-react"

import { getClub, getMyMembership } from "@/app/actions/clubs"
import { getClubWriterWorkDetail } from "@/app/actions/club-writer-works"
import { ClubWriterWorkPaginatedViewer } from "@/components/club-writer-work-paginated-viewer"
import { Navigation } from "@/components/navigation"
import { ClubWriterWorkLikeButton } from "@/components/club-writer-work-like-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { sanitizeRichTextHtml } from "@/lib/sanitize"

export default async function ClubWorkDetailPage({
  params,
}: {
  params: Promise<{ id: string; workId: string }>
}) {
  const { id, workId } = await params

  const club = await getClub(id)
  if (!club || club.type !== "writer") {
    redirect(`/community/clubs/${id}`)
  }

  const [membership, work] = await Promise.all([getMyMembership(id), getClubWriterWorkDetail(id, workId)])

  if (!work) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              This work is unavailable.
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const canLike = membership.isMember
  const sanitizedContentHtml = sanitizeRichTextHtml(work.content_html)
  const updatedAtDate = new Date(work.updated_at)
  const updatedAtLabel = Number.isNaN(updatedAtDate.getTime())
    ? work.updated_at
    : updatedAtDate.toLocaleDateString()
  const authorName = work.author?.username ?? "Unknown author"

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Writer club work</Badge>
                <Badge variant={work.is_public ? "default" : "outline"}>
                  {work.is_public ? "Published" : "Private draft"}
                </Badge>
                {work.is_completed ? (
                  <Badge variant="secondary" className="gap-1 text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Complete
                  </Badge>
                ) : null}
              </div>

              <CardTitle className="text-3xl">{work.title}</CardTitle>

              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={work.author?.avatar_url ?? undefined} />
                  <AvatarFallback>{(work.author?.username ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-foreground">{work.author?.username ?? "Unknown author"}</div>
                  <div>Updated {new Date(work.updated_at).toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <ClubWriterWorkLikeButton
                workId={work.id}
                initialCount={work.likes_count}
                initialLiked={work.viewer_has_liked}
                disabled={!canLike}
              />
              <Button asChild variant="outline">
                <Link href={`/community/clubs/${club.id}`}>Back to club</Link>
              </Button>
              {work.viewer_can_edit ? (
                <Button asChild>
                  <Link href={`/community/clubs/${club.id}/write?work=${work.id}`}>Edit work</Link>
                </Button>
              ) : null}
            </div>
          </CardHeader>
        </Card>

        <ClubWriterWorkPaginatedViewer
          title={work.title}
          authorName={authorName}
          updatedAtLabel={updatedAtLabel}
          isCompleted={work.is_completed}
          sanitizedHtml={sanitizedContentHtml}
        />
      </div>
    </div>
  )
}
