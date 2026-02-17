import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Star, BookOpenText, BookOpen } from "lucide-react"
import { createServerClient } from "@/lib/supabase-server"
import { getReviews } from "@/app/actions/reviews"
import { TitleEngagementTabs } from "@/components/title-engagement-tabs"
import { MarkReadButton } from "@/components/mark-read-button"
import { CoverImage } from "@/components/cover-image"
import { sanitizeDescriptionHtml } from "@/lib/sanitize"
import { getTitleReadStatus } from "@/app/actions/title"
import { TitleTrackProgressButton } from "@/components/title-track-progress-button"

type TitleRow = {
  id: string
  title: string
  author: string
  description: string | null
  cover_image_url: string | null
  published_year: number | null
  isbn: string | null
  created_at: string
  updated_at: string
}

function normalizeCoverUrl(url: string | null): string | null {
  if (!url) return null
  return url.replace(/^http:/, "https:")
}

async function getTitle(id: string): Promise<TitleRow | null> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.from("titles").select("*").eq("id", id).maybeSingle()
  if (error) {
    console.error("Error fetching title:", error)
    return null
  }
  return data as TitleRow
}

async function getLibraryBookIdForTitle(titleId: string): Promise<string | null> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("books")
    .select("id")
    .or(`id.eq.${titleId},title_id.eq.${titleId}`)
    .maybeSingle()

  if (error) {
    console.error("Error fetching library mapping:", error)
    return null
  }

  return (data?.id as string | undefined) ?? null
}

async function getTrackedBookIdForTitle(titleId: string): Promise<string | null> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("tracked_books")
    .select("id")
    .eq("title_id", titleId)
    .maybeSingle()

  if (error) {
    console.error("Error fetching tracked mapping:", error)
    return null
  }

  return (data?.id as string | undefined) ?? null
}

export default async function TitlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const title = await getTitle(id)

  if (!title) {
    return <div className="min-h-screen bg-background"><Navigation /><div className="max-w-3xl mx-auto p-8">Title not found</div></div>
  }

  const libraryBookId = await getLibraryBookIdForTitle(title.id)
  const trackedBookId = await getTrackedBookIdForTitle(title.id)
  const reviews = await getReviews(title.id)
  const canRead = await getTitleReadStatus(title.id)

  const averageRating = reviews.length > 0
    ? (reviews.reduce((acc: number, review: any) => acc + review.rating, 0) / reviews.length).toFixed(1)
    : "N/A"

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="relative w-48 h-64 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <BookOpen className="h-16 w-16 text-muted-foreground" />
                </div>
                {normalizeCoverUrl(title.cover_image_url) ? (
                  <CoverImage
                    src={normalizeCoverUrl(title.cover_image_url) ?? undefined}
                    alt={title.title}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : null}
              </div>

              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">{title.title}</h1>
                <p className="text-xl text-muted-foreground mb-4">by {title.author}</p>

                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 fill-primary text-primary" />
                    <span className="ml-1 text-lg font-semibold">{averageRating}/10</span>
                  </div>
                  <span className="text-muted-foreground">({reviews.length} reviews)</span>
                </div>

                {title.description ? (
                  <div
                    className="text-foreground leading-relaxed mb-6 [&_p]:mb-3 last:[&_p]:mb-0"
                    dangerouslySetInnerHTML={{ __html: sanitizeDescriptionHtml(title.description) }}
                  />
                ) : null}

                <div className="flex flex-wrap gap-3">
                  {libraryBookId ? (
                    <Button asChild>
                      <Link href={`/books/${libraryBookId}/read`}>
                        <BookOpenText className="h-4 w-4 mr-2" />
                        Read
                      </Link>
                    </Button>
                  ) : null}

                  <MarkReadButton titleId={title.id} />
                  <TitleTrackProgressButton
                    titleId={title.id}
                    title={title.title}
                    bookId={libraryBookId}
                    trackedBookId={trackedBookId}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <TitleEngagementTabs titleId={title.id} reviews={reviews as any[]} canRead={canRead} />
      </div>
    </div>
  )
}
