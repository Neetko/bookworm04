"use client"

import { useEffect, useState, type KeyboardEvent, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { GENRES, type Genre, GENRE_BG_CLASS, normalizeGenres } from "@/lib/types"
import type { SearchTitleResult } from "@/lib/types"
import { confirmGoogleBookIngest, getGoogleIngestSuggestion } from "@/app/actions/track-reading"
import { toast } from "sonner"
import { sanitizeDescriptionHtml } from "@/lib/sanitize"
import { cn } from "@/lib/utils"
import { GenreToggleButton } from "@/components/genre-toggle-button"

type CoverStatus = "loading" | "loaded" | "failed" | "missing"

const failedCoverSrcs = new Set<string>()

function Cover({
  src,
  alt,
  onStatusChange,
}: {
  src: string | null
  alt: string
  onStatusChange?: (status: CoverStatus) => void
}) {
  const [failed, setFailed] = useState(false)
  const normalized = src ?? null

  useEffect(() => {
    if (!normalized) {
      setFailed(true)
      onStatusChange?.("missing")
      return
    }

    if (failedCoverSrcs.has(normalized)) {
      setFailed(true)
      onStatusChange?.("failed")
      return
    }

    setFailed(false)
    onStatusChange?.("loading")
  }, [normalized, onStatusChange])

  if (!normalized || failed) {
    return (
      <div className="w-full sm:w-48 h-48 sm:h-auto bg-muted flex items-center justify-center flex-shrink-0">
        <BookOpen className="h-12 w-12 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="relative w-full sm:w-48 h-48 sm:h-auto bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
      <Image
        src={normalized}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, 192px"
        className="object-cover"
        referrerPolicy="no-referrer"
        onLoadingComplete={() => onStatusChange?.("loaded")}
        onError={() => {
          failedCoverSrcs.add(normalized)
          setFailed(true)
          onStatusChange?.("failed")
        }}
        unoptimized
      />
    </div>
  )
}

type TrackReadingResultListProps = {
  results: SearchTitleResult[]
  canAutoApproveSuggestions?: boolean
  actionLabel?: string
  actionDisabledLabel?: string
  actionLoadingId?: string | null
  onAction?: (titleId: string, result: SearchTitleResult) => void | Promise<void>
  isActionDisabled?: (titleId: string, result: SearchTitleResult) => boolean
}

export function TrackReadingResultList({
  results,
  canAutoApproveSuggestions = false,
  actionLabel = "Add to list",
  actionDisabledLabel = "Added",
  actionLoadingId = null,
  onAction,
  isActionDisabled,
}: TrackReadingResultListProps) {
  const router = useRouter()
  const [ingestedVolumeIds, setIngestedVolumeIds] = useState<Set<string>>(new Set())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogResult, setDialogResult] = useState<SearchTitleResult | null>(null)
  const [loadingSuggestion, setLoadingSuggestion] = useState(false)
  const [submittingIngest, setSubmittingIngest] = useState(false)
  const [suggestedGenres, setSuggestedGenres] = useState<Genre[]>([])
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([])
  const [workCandidates, setWorkCandidates] = useState<Array<{
    workId: string
    title: string
    author: string
    coverUrl: string | null
    firstPublishYear: number | null
    editionCount: number | null
    subjects: string[]
  }>>([])
  const [selectedWorkIds, setSelectedWorkIds] = useState<string[]>([])
  const [localDuplicates, setLocalDuplicates] = useState<Array<{
    id: string
    title: string
    author: string
    coverImageUrl: string | null
    source: "title" | "tracked"
  }>>([])
  const [requiresWorkConfirmation, setRequiresWorkConfirmation] = useState(false)
  const [showAllDuplicates, setShowAllDuplicates] = useState(false)
  const [autoDupeMatchCount, setAutoDupeMatchCount] = useState(0)
  const [bookwormSuggestedMatchCount, setBookwormSuggestedMatchCount] = useState(0)

  useEffect(() => {
    setIngestedVolumeIds(new Set())
  }, [results])

  const openIngestDialog = async (result: SearchTitleResult) => {
    if (result.source !== "google" || !result.volumeId) return

    setDialogResult(result)
    setDialogOpen(true)
    setSuggestedGenres([])
    setSelectedGenres([])
    setWorkCandidates([])
    setSelectedWorkIds([])
    setLocalDuplicates([])
    setRequiresWorkConfirmation(false)
    setShowAllDuplicates(false)
    setAutoDupeMatchCount(0)
    setBookwormSuggestedMatchCount(0)
    setLoadingSuggestion(true)

    try {
      const suggestion = await getGoogleIngestSuggestion(result.volumeId)
      const initial = normalizeGenres(suggestion.suggestedGenres)
      setSuggestedGenres(initial)
      setSelectedGenres(initial)
      setWorkCandidates(suggestion.workCandidates ?? [])
      setRequiresWorkConfirmation(Boolean(suggestion.requiresWorkConfirmation))
      setLocalDuplicates(suggestion.localDuplicates ?? [])
      setAutoDupeMatchCount(suggestion.autoDupeMatchCount ?? 0)
      setBookwormSuggestedMatchCount(suggestion.bookwormSuggestedMatchCount ?? 0)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load ingest details")
      setDialogOpen(false)
      setDialogResult(null)
    } finally {
      setLoadingSuggestion(false)
    }
  }

  const toggleGenre = (genre: Genre) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    )
  }

  const confirmIngest = async () => {
    if (!dialogResult?.volumeId) return
    if (selectedGenres.length === 0) {
      toast.error("Select at least one genre")
      return
    }

    setSubmittingIngest(true)
    try {
      const res = await confirmGoogleBookIngest({
        volumeId: dialogResult.volumeId,
        selectedGenres,
        selectedWorkIds,
        requiresWorkSelection: requiresWorkConfirmation,
        algorithmSuggestedGenres: suggestedGenres,
        workCandidates,
      })
      toast.success(res.autoApproved ? "Title ingested and verified" : "Title ingested")

      setIngestedVolumeIds((prev) => {
        const next = new Set(prev)
        if (dialogResult.volumeId) next.add(dialogResult.volumeId)
        return next
      })

      setDialogOpen(false)
      setDialogResult(null)
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to ingest title")
    } finally {
      setSubmittingIngest(false)
    }
  }

  const handleCardClick = (
    event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>,
    href: string
  ) => {
    if ("target" in event) {
      const target = event.target as HTMLElement
      if (target.closest("button, a")) return
    }
    router.push(href)
  }

  const closeDialog = () => {
    if (submittingIngest) return
    setDialogOpen(false)
    setDialogResult(null)
    setSuggestedGenres([])
    setSelectedGenres([])
    setWorkCandidates([])
    setSelectedWorkIds([])
    setLocalDuplicates([])
    setRequiresWorkConfirmation(false)
    setShowAllDuplicates(false)
    setAutoDupeMatchCount(0)
    setBookwormSuggestedMatchCount(0)
  }

  const toggleWorkCandidate = (workId: string) => {
    setSelectedWorkIds((prev) =>
      prev.includes(workId) ? prev.filter((id) => id !== workId) : [...prev, workId]
    )
  }

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ingest title</DialogTitle>
          </DialogHeader>

          {!dialogResult ? null : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {dialogResult.title} — {dialogResult.author}
              </div>

              {loadingSuggestion ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Loading suggestions...</p>
                  <p className="text-xs text-muted-foreground">
                    Fetching genre tags and duplicate matches.
                  </p>
                </div>
              ) : null}

              {!loadingSuggestion ? (
                <div className="space-y-3">
                  {localDuplicates.length > 0 ? (
                    <div className="space-y-2 rounded-lg border border-border p-3">
                      <p className="text-sm font-medium">Possible duplicates</p>
                      <p className="text-xs text-muted-foreground">
                        We found similar titles in your library. Review before ingesting.
                      </p>
                      <div className="space-y-2">
                        {(showAllDuplicates ? localDuplicates.slice(0, 15) : localDuplicates.slice(0, 5)).map((dupe) => (
                          <div key={`${dupe.source}-${dupe.id}`} className="flex items-center gap-3 text-sm">
                            <div className="h-10 w-8 bg-muted rounded overflow-hidden">
                              {dupe.coverImageUrl ? (
                                <Image
                                  src={dupe.coverImageUrl}
                                  alt={dupe.title}
                                  width={32}
                                  height={40}
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">{dupe.title}</div>
                              <div className="text-xs text-muted-foreground">{dupe.author}</div>
                            </div>
                            {dupe.source === "title" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/titles/${dupe.id}`)}
                              >
                                View
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">Tracked</span>
                            )}
                          </div>
                        ))}
                      </div>
                      {localDuplicates.length > 5 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAllDuplicates((prev) => !prev)}
                        >
                          {showAllDuplicates ? "Show less" : "Show more"}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  {workCandidates.length > 0 ? (
                    <div className="space-y-2 rounded-lg border border-border p-3">
                      <p className="text-sm font-medium">Open Library matches to review</p>
                      <p className="text-xs text-muted-foreground">
                        {canAutoApproveSuggestions
                          ? "These are lower-confidence matches. Select any that you want to verify now."
                          : "These are lower-confidence matches. Select any that you want a moderator to review."}
                      </p>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {workCandidates.map((candidate) => (
                          <div
                            key={candidate.workId}
                            className={cn(
                              "flex items-start gap-3 rounded-md border p-2",
                              selectedWorkIds.includes(candidate.workId) ? "border-primary" : "border-border"
                            )}
                          >
                            <div className="h-14 w-10 bg-muted rounded overflow-hidden">
                              {candidate.coverUrl ? (
                                <Image
                                  src={candidate.coverUrl}
                                  alt={candidate.workId}
                                  width={40}
                                  height={56}
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="text-sm font-medium">{candidate.title || "Untitled"}</div>
                              <div className="text-xs text-muted-foreground">{candidate.author || "Unknown author"}</div>
                              <div className="text-xs">First publish: {candidate.firstPublishYear ?? "Unknown"}</div>
                              <div className="text-xs">Editions: {candidate.editionCount ?? "Unknown"}</div>
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {(candidate.subjects ?? []).slice(0, 3).join(" / ") || "No subjects"}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button
                                variant={selectedWorkIds.includes(candidate.workId) ? "default" : "outline"}
                                size="sm"
                                onClick={() => toggleWorkCandidate(candidate.workId)}
                              >
                                {selectedWorkIds.includes(candidate.workId)
                                  ? canAutoApproveSuggestions ? "Selected to verify" : "Selected for review"
                                  : canAutoApproveSuggestions ? "Select to verify" : "Select for review"}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {autoDupeMatchCount > 0 || bookwormSuggestedMatchCount > 0 ? (
                    <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground space-y-1">
                      {autoDupeMatchCount > 0 ? (
                        <p>
                          Bookworm auto-classified {autoDupeMatchCount} exact match{autoDupeMatchCount === 1 ? "" : "es"} and hid {autoDupeMatchCount === 1 ? "it" : "them"} from this picker.
                        </p>
                      ) : null}
                      {bookwormSuggestedMatchCount > 0 ? (
                        <p>
                          {canAutoApproveSuggestions
                            ? `Bookworm also found ${bookwormSuggestedMatchCount} high-likelihood match${bookwormSuggestedMatchCount === 1 ? "" : "es"} you can verify right now.`
                            : `Bookworm also queued ${bookwormSuggestedMatchCount} high-likelihood match${bookwormSuggestedMatchCount === 1 ? "" : "es"} for moderator review.`}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <p className="text-sm font-medium">Review suggested tags and adjust if needed</p>
                  {suggestedGenres.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Suggested: {suggestedGenres.join(", ")}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No suggested tags found. Please select at least one.</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {GENRES.map((genre) => (
                      <GenreToggleButton
                        key={genre}
                        genre={genre}
                        selected={selectedGenres.includes(genre)}
                        onToggle={toggleGenre}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeDialog} disabled={submittingIngest}>
                  Cancel
                </Button>
                <Button
                  onClick={confirmIngest}
                  disabled={
                    loadingSuggestion ||
                    submittingIngest ||
                    selectedGenres.length === 0
                  }
                >
                  {submittingIngest ? "Ingesting..." : "Ingest"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {results.map((result) => {
        const resolvedTitleId = result.source === "local" ? (result.titleId ?? result.id) : undefined
        const isClickable = Boolean(resolvedTitleId)
        const showOpenReady = Boolean(resolvedTitleId)
        const isIngested =
          result.source === "local" ||
          (result.volumeId ? ingestedVolumeIds.has(result.volumeId) : false)
        const showIngest = result.source === "google" && !isIngested
        const canTakeAction = Boolean(onAction && resolvedTitleId && !showIngest)
        const isActionLoading = Boolean(actionLoadingId && resolvedTitleId && actionLoadingId === resolvedTitleId)
        const actionDisabled = Boolean(
          isActionDisabled && resolvedTitleId && isActionDisabled(resolvedTitleId, result)
        )
        const descriptionHtml = sanitizeDescriptionHtml(result.description)

        return (
          <Card
            key={`${result.source}:${result.id}`}
            className={`flex flex-col sm:flex-row hover:shadow-lg transition-all duration-200 overflow-hidden min-h-[200px] ${
              isClickable ? "cursor-pointer" : ""
            } ${showOpenReady ? "ring-2 ring-primary/30 dark:ring-primary/60 ring-inset" : ""}`}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onClick={
              isClickable
                ? (event) => handleCardClick(event, `/titles/${resolvedTitleId}`)
                : undefined
            }
            onKeyDown={
              isClickable
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      handleCardClick(event, `/titles/${resolvedTitleId}`)
                    }
                  }
                : undefined
            }
          >
            <Cover
              src={result.coverImageUrl}
              alt={result.title}
              onStatusChange={() => {}}
            />

            <div className="flex flex-col flex-1">
              <CardContent className="p-6 flex-1">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-semibold text-xl mb-1">{result.title}</h3>
                    <p className="text-muted-foreground mb-3">by {result.author}</p>
                    {result.source === "local" && normalizeGenres(result.genres).length > 0 ? (
                      <div className="flex items-center gap-1.5 mb-3">
                        {normalizeGenres(result.genres).map((genre) => (
                          <span
                            key={genre}
                            className={cn("h-2.5 w-2.5 shrink-0 rounded-full", GENRE_BG_CLASS[genre])}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {result.engagement > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      {result.engagement} engagement
                    </div>
                  ) : null}
                </div>

                {descriptionHtml ? (
                  <div
                    className="text-muted-foreground line-clamp-2 [&_p]:mb-2 last:[&_p]:mb-0"
                    dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                  />
                ) : null}
              </CardContent>

              {showIngest || canTakeAction ? (
                <CardFooter className="p-6 pt-0 flex justify-end gap-2">
                  {showIngest ? (
                    <Button variant="outline" onClick={() => openIngestDialog(result)}>
                      Ingest
                    </Button>
                  ) : null}
                  {canTakeAction && resolvedTitleId ? (
                    <Button
                      onClick={() => onAction?.(resolvedTitleId, result)}
                      disabled={isActionLoading || actionDisabled}
                    >
                      {isActionLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Adding...
                        </span>
                      ) : actionDisabled ? (
                        actionDisabledLabel
                      ) : (
                        actionLabel
                      )}
                    </Button>
                  ) : null}
                </CardFooter>
              ) : null}
            </div>
          </Card>
        )
      })}
      </div>
    </>
  )
}
