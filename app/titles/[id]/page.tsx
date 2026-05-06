import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Star, BookOpen, ExternalLink, Headphones, ShoppingCart } from "lucide-react"
import { createServerClient } from "@/lib/supabase-server"
import { getReviews } from "@/app/actions/reviews"
import { TitleEngagementTabs } from "@/components/title-engagement-tabs"
import { MarkReadButton } from "@/components/mark-read-button"
import { CoverImage } from "@/components/cover-image"
import { buildNoteHtmlFromText, extractPlainTextFromHtml, sanitizeDescriptionHtml } from "@/lib/sanitize"
import { getTitleReadStatus } from "@/app/actions/title"
import { TitleTrackProgressButton } from "@/components/title-track-progress-button"
import { TitleEditionsDialog } from "@/components/title-editions-dialog"
import { TitleDedupeDialog } from "@/components/title-dedupe-dialog"
import { TitleBookmarkButton } from "@/components/title-bookmark-button"
import { GENRE_BG_CLASS, isGenre, normalizeGenres } from "@/lib/types"
import { enforceGenreRulesFromList } from "@/lib/book-tagging"
import { getTitleReferenceWorkIds } from "@/lib/reference-data"
import { canReviewSuggestions, getCurrentUserAccess } from "@/lib/server/roles"
import { cn } from "@/lib/utils"
import { buildAmazonProductUrl, buildAmazonSearchUrl } from "@/lib/amazon"

type TitleRow = {
  id: string
  title: string
  author: string
  description: string | null
  cover_image_url: string | null
  published_year: number | null
  isbn: string | null
  work_id: string | null
  dupe_work_ids: string[] | null
  created_at: string
  updated_at: string
}

type EditionRow = {
  work_id: string
  isbn_10: string | null
  isbn_13: string | null
  asin: string | null
  format: string | null
  saleability: string | null
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

async function getTodayDiaryNoteForTitle(titleId: string): Promise<{ noteHtml: string | null; noteText: string | null } | null> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (profileError || !profile?.id) return null

  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from("reading_diary_entries")
    .select("note_html,note_text")
    .eq("user_profile_id", profile.id)
    .eq("title_id", titleId)
    .eq("entry_date", today)
    .maybeSingle()

  if (error || !data) return null

  const rawNoteHtml = data.note_html ?? null
  const rawNoteText = data.note_text ?? null
  const noteHtml = rawNoteHtml || (rawNoteText ? buildNoteHtmlFromText(rawNoteText) : null)
  const noteText = rawNoteText || (rawNoteHtml ? extractPlainTextFromHtml(rawNoteHtml) : null)

  return { noteHtml, noteText }
}

async function getEditionsForTitle(title: TitleRow): Promise<EditionRow[]> {
  const supabase = await createServerClient()
  const workIds = await getTitleReferenceWorkIds(supabase, {
    titleId: title.id,
    fallbackWorkIds: [title.work_id, ...(title.dupe_work_ids ?? [])],
  })
  if (workIds.length === 0) return []

  const { data, error } = await supabase
    .from("editions")
    .select("work_id,isbn_10,isbn_13,asin,format,saleability")
    .in("work_id", workIds)

  if (error) {
    console.error("Error fetching editions:", error)
    return []
  }

  return (data ?? []) as EditionRow[]
}

function isAudibleAsin(asin: string | null): boolean {
  return Boolean(asin && asin.startsWith("B0"))
}

function pickFeaturedEditions(editions: EditionRow[]): EditionRow[] {
  return editions.filter(
    (edition) =>
      edition.saleability === "FOR_SALE" &&
      (Boolean(edition.asin) || Boolean(edition.isbn_10))
  )
}

function uniqueGenres(genres: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const genre of genres) {
    if (seen.has(genre)) continue
    seen.add(genre)
    result.push(genre)
  }
  return result
}

async function getGenresForTitle(titleId: string): Promise<string[]> {
  const supabase = await createServerClient()
  const titleRow = await supabase.from("titles").select("genre").eq("id", titleId).maybeSingle()

  const fallback = normalizeGenres(
    uniqueGenres([
      ...((titleRow.data?.genre ?? []).filter(isGenre)),
    ])
  )

  return enforceGenreRulesFromList(fallback)
}

export default async function TitlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const title = await getTitle(id)

  if (!title) {
    return <div className="min-h-screen bg-background"><Navigation /><div className="max-w-3xl mx-auto p-8">Title not found</div></div>
  }

  const genres = normalizeGenres(await getGenresForTitle(title.id))
  const reviews = await getReviews(title.id)
  const canRead = await getTitleReadStatus(title.id)
  const editions = await getEditionsForTitle(title)
  const featuredEditions = pickFeaturedEditions(editions)
  const todayDiaryNote = await getTodayDiaryNoteForTitle(title.id)
  const access = await getCurrentUserAccess()

  const amazonSearchUrl = buildAmazonSearchUrl(`${title.title} ${title.author}`)
  const audibleSearchUrl = buildAmazonSearchUrl(`${title.title} ${title.author} Audible`)

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
                {title.cover_image_url ? (
                  <CoverImage
                    src={title.cover_image_url ?? undefined}
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

                {genres.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {genres.map((genre) => (
                      <Badge
                        key={genre}
                        variant="outline"
                        className={cn("border-transparent", GENRE_BG_CLASS[genre])}
                      >
                        {genre}
                      </Badge>
                    ))}
                  </div>
                ) : null}

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

                {featuredEditions.length > 0 ? (
                  <div className="mb-6 rounded-lg border border-border p-3 space-y-3">
                    <div className="text-sm font-medium">Featured editions for sale</div>
                    <div className="space-y-2">
                      {featuredEditions.map((edition, index) => {
                        const productId = edition.asin ?? edition.isbn_10 ?? ""
                        const amazonUrl = productId ? buildAmazonProductUrl(productId) : null
                        const showAudible = isAudibleAsin(edition.asin)
                        return (
                          <div key={`${edition.work_id}-${edition.asin ?? edition.isbn_10 ?? index}`} className="flex flex-wrap items-center gap-3">
                            <div className="text-xs text-muted-foreground">
                              {edition.asin ? `ASIN: ${edition.asin}` : null}
                              {!edition.asin && edition.isbn_10 ? `ISBN-10: ${edition.isbn_10}` : null}
                              {edition.format ? ` • ${edition.format}` : ""}
                            </div>
                            <div className="flex gap-2">
                              {amazonUrl ? (
                                <Button size="sm" asChild>
                                  <a href={amazonUrl} target="_blank" rel="noreferrer">
                                    Buy on Amazon
                                  </a>
                                </Button>
                              ) : null}
                              {showAudible && edition.asin ? (
                                <Button size="sm" variant="outline" asChild>
                                  <a href={buildAmazonProductUrl(edition.asin)} target="_blank" rel="noreferrer">
                                    Buy on Audible
                                  </a>
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <MarkReadButton titleId={title.id} />
                    <TitleBookmarkButton titleId={title.id} />
                    <TitleTrackProgressButton
                      titleId={title.id}
                      title={title.title}
                      initialNoteHtml={todayDiaryNote?.noteHtml ?? null}
                      initialNoteText={todayDiaryNote?.noteText ?? null}
                    />

                    <div className="hidden h-8 w-px bg-border md:block" aria-hidden="true" />
                    <div className="h-px w-full bg-border md:hidden" aria-hidden="true" />

                    <TitleEditionsDialog titleId={title.id} />
                    <TitleDedupeDialog
                      titleId={title.id}
                      canAutoApprove={canReviewSuggestions(access.role)}
                    />
                  </div>

                  <TooltipProvider>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shop</span>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" asChild>
                              <a href={amazonSearchUrl} target="_blank" rel="noreferrer" className="gap-1.5">
                                <ShoppingCart className="h-3.5 w-3.5" />
                                Amazon
                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Search on Amazon</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" asChild>
                              <a href={audibleSearchUrl} target="_blank" rel="noreferrer" className="gap-1.5">
                                <Headphones className="h-3.5 w-3.5" />
                                Audible
                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Search on Audible</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </TooltipProvider>
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
