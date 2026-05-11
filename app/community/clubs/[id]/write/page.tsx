import Link from "next/link"
import { redirect } from "next/navigation"

import { getClub, getMyMembership } from "@/app/actions/clubs"
import { getMyClubWriterWorks } from "@/app/actions/club-writer-works"
import { Navigation } from "@/components/navigation"
import { ClubWriterWorkEditor } from "@/components/club-writer-work-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function ClubWritePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ work?: string }>
}) {
  const { id } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const selectedWorkId = typeof resolvedSearchParams?.work === "string" ? resolvedSearchParams.work : null

  const club = await getClub(id)
  if (!club || club.type !== "writer") {
    redirect(`/community/clubs/${id}`)
  }

  const membership = await getMyMembership(id)
  if (!membership.isMember) {
    redirect(`/community/clubs/${id}`)
  }

  const myWorks = await getMyClubWriterWorks(id)
  const selectedWork = myWorks.find((work) => work.id === selectedWorkId) ?? null

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Write in {club.name}</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Create as many works as you like. Keep drafts private, or publish them for fellow club members.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={`/community/clubs/${club.id}`}>Back to club</Link>
            </Button>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Your works</CardTitle>
            <Button asChild variant="ghost">
              <Link href={`/community/clubs/${club.id}/write`}>New draft</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {myWorks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No works yet. Start your first draft below.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {myWorks.map((work) => {
                  const isSelected = selectedWork?.id === work.id

                  return (
                    <Link
                      key={work.id}
                      href={`/community/clubs/${club.id}/write?work=${work.id}`}
                      className={`rounded-lg border p-4 transition-colors hover:border-primary/40 ${
                        isSelected ? "border-primary bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{work.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Updated {new Date(work.updated_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={work.is_public ? "default" : "outline"}>
                            {work.is_public ? "Published" : "Draft"}
                          </Badge>
                          {work.is_completed ? <Badge variant="secondary">Complete</Badge> : null}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <ClubWriterWorkEditor clubId={club.id} initialWork={selectedWork} />
      </div>
    </div>
  )
}
