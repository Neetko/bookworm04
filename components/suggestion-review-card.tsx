"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  approveSuggestionAction,
  dismissSuggestionAction,
  getSuggestionCoverChoicesAction,
  saveSuggestionReviewAction,
} from "@/app/actions/suggestions"
import { SuggestionCoverPicker } from "@/components/suggestion-cover-picker"
import { CanonGenreToggleGroup } from "@/components/canon-genre-toggle-group"
import { SuggestionWorkCards } from "@/components/suggestion-work-cards"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { getErrorMessage } from "@/lib/errors"
import type { Genre } from "@/lib/types"
import {
  buildFallbackWorkSnapshot,
  isExactWorkSnapshotMatch,
  type CoverChoice,
  type SuggestionWorkMatch,
  type WorkSnapshot,
} from "@/lib/suggestions"

type LinkedTitleSummary = {
  titleId: string
  title: string
}

type SuggestionReviewCardProps = {
  suggestion: {
    id: string
    titleId: string
    title: string
    author: string
    suggestedBy: string
    suggestedGenres: Genre[]
    algorithmSuggestedGenres: Genre[]
    suggestedWorkIds: string[]
    suggestedWorkSnapshots: WorkSnapshot[]
    bookwormMatches: SuggestionWorkMatch[]
    adminFinalGenres: Genre[]
    adminFinalSelectedWorkIds: string[]
    adminFinalSelectedWorkSnapshots: WorkSnapshot[]
    adminFinalCoverSelection: CoverChoice | null
    adminReviewedAt: string | null
  }
}

function GenreRow({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <Badge key={value} variant="secondary">
              {value}
            </Badge>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">None</div>
      )}
    </div>
  )
}

export function SuggestionReviewCard({ suggestion }: SuggestionReviewCardProps) {
  const isExactMatch = useCallback((snapshot: WorkSnapshot | null | undefined) => {
    return isExactWorkSnapshotMatch(snapshot, {
      title: suggestion.title,
      author: suggestion.author,
    })
  }, [suggestion.author, suggestion.title])

  const dedupeWorks = useCallback((works: WorkSnapshot[]) => {
    const unique: WorkSnapshot[] = []
    for (const snapshot of works) {
      if (!snapshot.workId) continue
      if (isExactMatch(snapshot)) continue
      if (unique.some((entry) => entry.workId === snapshot.workId)) continue
      unique.push(snapshot)
    }
    return unique
  }, [isExactMatch])

  const suggestedWorks = useMemo(() => {
    const snapshots = suggestion.suggestedWorkIds.map((workId) => {
      return suggestion.suggestedWorkSnapshots.find((snapshot) => snapshot.workId === workId)
        ?? buildFallbackWorkSnapshot(workId)
    })

    return dedupeWorks(snapshots)
  }, [dedupeWorks, suggestion.suggestedWorkIds, suggestion.suggestedWorkSnapshots])

  const reviewedWorks = useMemo(() => {
    const snapshots = suggestion.adminFinalSelectedWorkIds.map((workId) => {
      return suggestion.adminFinalSelectedWorkSnapshots.find((snapshot) => snapshot.workId === workId)
        ?? buildFallbackWorkSnapshot(workId)
    })

    return dedupeWorks(snapshots)
  }, [dedupeWorks, suggestion.adminFinalSelectedWorkIds, suggestion.adminFinalSelectedWorkSnapshots])

  const bookwormWorks = useMemo(() => {
    const works: WorkSnapshot[] = []
    for (const match of suggestion.bookwormMatches) {
      if (isExactMatch(match.workSnapshot)) continue
      if (!works.some((entry) => entry.workId === match.workSnapshot.workId)) {
        works.push(match.workSnapshot)
      }
    }
    return works
  }, [isExactMatch, suggestion.bookwormMatches])

  const router = useRouter()
  const [removed, setRemoved] = useState(false)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<0 | 1>(0)
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>(suggestion.adminFinalGenres)
  const [selectedWorkIds, setSelectedWorkIds] = useState<string[]>(reviewedWorks.map((snapshot) => snapshot.workId))
  const [selectedCoverChoice, setSelectedCoverChoice] = useState<CoverChoice | null>(suggestion.adminFinalCoverSelection)
  const [coverChoices, setCoverChoices] = useState<CoverChoice[]>(
    suggestion.adminFinalCoverSelection ? [suggestion.adminFinalCoverSelection] : []
  )
  const [coverError, setCoverError] = useState<string | null>(null)
  const [hasReviewed, setHasReviewed] = useState(Boolean(suggestion.adminReviewedAt))
  const [isSaving, startSavingTransition] = useTransition()
  const [isApproving, startApproveTransition] = useTransition()
  const [isDismissing, startDismissTransition] = useTransition()
  const [isLoadingCoverChoices, startCoverTransition] = useTransition()

  const allKnownWorks = useMemo(() => {
    const merged = [...suggestedWorks]
    for (const snapshot of bookwormWorks) {
      if (!merged.some((entry) => entry.workId === snapshot.workId)) {
        merged.push(snapshot)
      }
    }
    return merged
  }, [bookwormWorks, suggestedWorks])

  const selectedWorkSnapshots = useMemo(() => {
    return selectedWorkIds.map((workId) => {
      return allKnownWorks.find((snapshot) => snapshot.workId === workId) ?? buildFallbackWorkSnapshot(workId)
    })
  }, [allKnownWorks, selectedWorkIds])

  const visibleCoverChoices = useMemo(() => {
    const merged = [...coverChoices]
    if (selectedCoverChoice) {
      const exists = merged.some((choice) =>
        choice.workId === selectedCoverChoice.workId
        && choice.source === selectedCoverChoice.source
        && choice.sourceCoverKey === selectedCoverChoice.sourceCoverKey
      )

      if (!exists) merged.unshift(selectedCoverChoice)
    }

    const deduped: CoverChoice[] = []
    for (const choice of merged) {
      if (deduped.some((entry) =>
        entry.workId === choice.workId
        && entry.source === choice.source
        && entry.sourceCoverKey === choice.sourceCoverKey
      )) {
        continue
      }
      deduped.push(choice)
    }

    return deduped
  }, [coverChoices, selectedCoverChoice])

  useEffect(() => {
    if (selectedCoverChoice && !selectedWorkIds.includes(selectedCoverChoice.workId)) {
      setSelectedCoverChoice(null)
    }
  }, [selectedCoverChoice, selectedWorkIds])

  if (removed) return null

  const toggleGenre = (genre: Genre) => {
    setSelectedGenres((prev) => (prev.includes(genre) ? prev.filter((value) => value !== genre) : [...prev, genre]))
  }

  const toggleWorkSelection = (workId: string) => {
    setSelectedWorkIds((prev) => {
      if (prev.includes(workId)) return prev.filter((value) => value !== workId)
      return [...prev, workId]
    })
  }

  const loadCoverChoices = () => {
    startCoverTransition(async () => {
      setCoverError(null)
      try {
        const result = await getSuggestionCoverChoicesAction({
          selectedWorkIds,
          selectedWorkSnapshots,
        })

        setCoverChoices(result)
      } catch (error: unknown) {
        setCoverError(getErrorMessage(error, "Failed to load cover options"))
      }
    })
  }

  const saveReview = () => {
    startSavingTransition(async () => {
      try {
        await saveSuggestionReviewAction({
          suggestionId: suggestion.id,
          adminFinalGenres: selectedGenres,
          adminFinalSelectedWorkIds: selectedWorkIds,
          adminFinalSelectedWorkSnapshots: selectedWorkSnapshots,
          adminFinalCoverSelection: selectedCoverChoice,
        })

        setHasReviewed(true)
        setOpen(false)
        setStep(0)
        toast.success("Review saved")
        router.refresh()
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Failed to save review"))
      }
    })
  }

  const approve = () => {
    startApproveTransition(async () => {
      try {
        await approveSuggestionAction({ suggestionId: suggestion.id })
        setRemoved(true)
        toast.success("Suggestion approved")
        router.refresh()
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Failed to approve suggestion"))
      }
    })
  }

  const dismiss = () => {
    startDismissTransition(async () => {
      try {
        await dismissSuggestionAction({ suggestionId: suggestion.id })
        setRemoved(true)
        toast.success("Suggestion dismissed")
        router.refresh()
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Failed to dismiss suggestion"))
      }
    })
  }

  const busy = isSaving || isApproving || isDismissing

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {suggestion.title || "Untitled"}
            <span className="text-muted-foreground font-normal"> — {suggestion.author || "Unknown author"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Suggested by {suggestion.suggestedBy}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(true)} disabled={busy}>
              Review
            </Button>
            <Button type="button" onClick={approve} disabled={!hasReviewed || busy}>
              {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Approve
            </Button>
            <Button type="button" variant="outline" onClick={dismiss} disabled={busy}>
              {isDismissing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Dismiss
            </Button>
          </div>

          {!hasReviewed ? (
            <div className="text-xs text-muted-foreground">Save a review before approving.</div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setStep(0)
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Review suggestion: {suggestion.title || "Untitled"}
            </DialogTitle>
          </DialogHeader>

          {step === 0 ? (
            <div className="space-y-6">
              <GenreRow title="Bookworm suggested genre tags" values={suggestion.algorithmSuggestedGenres} />
              <GenreRow title="User suggested genre tags" values={suggestion.suggestedGenres} />

              <div className="space-y-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Admin final genre selection</div>
                <CanonGenreToggleGroup
                  selectedGenres={selectedGenres}
                  onToggle={toggleGenre}
                  className="flex-wrap"
                />
                <div className="text-xs text-muted-foreground">None are selected by default.</div>
              </div>

              <div className="flex justify-between gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                  Close
                </Button>
                <Button type="button" onClick={() => setStep(1)} disabled={busy}>
                  Proceed
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Bookworm suggested matches</div>
                <SuggestionWorkCards
                  works={bookwormWorks}
                  selectedWorkIds={selectedWorkIds}
                  onToggleSelected={toggleWorkSelection}
                  selectedBadgeLabel="Selected"
                  selectLabel="Select"
                  unselectLabel="Remove"
                  emptyMessage="No Bookworm-classified matches"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">User-selected works</div>
                <SuggestionWorkCards
                  works={suggestedWorks}
                  selectedWorkIds={selectedWorkIds}
                  onToggleSelected={toggleWorkSelection}
                  selectedBadgeLabel="Selected"
                  selectLabel="Select"
                  unselectLabel="Remove"
                  emptyMessage="No user-selected works"
                />
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Cover image picker</div>
                  <Button type="button" variant="outline" onClick={loadCoverChoices} disabled={isLoadingCoverChoices || busy || selectedWorkIds.length === 0}>
                    {isLoadingCoverChoices ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {coverChoices.length > 0 ? "Refresh cover options" : "Load cover options"}
                  </Button>
                </div>

                {coverError ? <div className="text-sm text-destructive">{coverError}</div> : null}

                <SuggestionCoverPicker
                  options={visibleCoverChoices}
                  selectedCover={selectedCoverChoice}
                  onSelect={setSelectedCoverChoice}
                  onClear={() => setSelectedCoverChoice(null)}
                  emptyMessage={selectedWorkIds.length === 0
                    ? "Select one or more works above to load cover options"
                    : "No cover options loaded yet"}
                />
              </div>

              <div className="flex justify-between gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(0)} disabled={busy}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                    Close
                  </Button>
                  <Button type="button" onClick={saveReview} disabled={busy}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save review
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
