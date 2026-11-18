"use client"

import { useState } from "react"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { GitMerge } from "lucide-react"
import { getErrorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import { getTitleDedupeCandidatesAction, submitTitleDedupeSuggestionAction } from "@/app/actions/title"
import { toast } from "sonner"

type LinkedTitleSummary = {
  titleId: string
  title: string
}

export function TitleDedupeDialog({
  titleId,
  isSignedIn,
  canAutoApprove = false,
}: {
  titleId: string
  isSignedIn: boolean
  canAutoApprove?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [candidates, setCandidates] = useState<Array<{
    workId: string
    title: string
    author: string
    coverUrl: string | null
    firstPublishYear: number | null
    editionCount: number | null
    subjects: string[]
    linkedElsewhereTitles?: LinkedTitleSummary[]
    alreadySelectedForReview?: boolean
  }>>([])
  const [selected, setSelected] = useState<string[]>([])
  const [linkedElsewhere, setLinkedElsewhere] = useState<Record<string, LinkedTitleSummary[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const loadCandidates = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getTitleDedupeCandidatesAction(titleId)
      setCandidates(res.candidates)
      setSelected(res.selected)
      setLinkedElsewhere(res.linkedElsewhere)
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to load work matches"))
    } finally {
      setLoading(false)
    }
  }

  const toggleWork = (workId: string) => {
    const candidate = candidates.find((entry) => entry.workId === workId)
    if (candidate?.alreadySelectedForReview) return
    setSelected((prev) => (prev.includes(workId) ? prev.filter((id) => id !== workId) : [...prev, workId]))
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const selectedWorks = candidates.filter((candidate) => selected.includes(candidate.workId))
      const result = await submitTitleDedupeSuggestionAction({
        titleId,
        selectedWorks,
      })
      toast.success(result.autoApproved ? "Dedupe changes verified" : "Dedupe suggestion sent for review")
      setOpen(false)
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to submit dedupe suggestion"))
    } finally {
      setSaving(false)
    }
  }

  if (!isSignedIn) {
    return (
      <Button variant="ghost" size="sm" className="gap-1.5" asChild>
        <Link href="/auth">
          <GitMerge className="h-4 w-4" />
          Sign in to suggest
        </Link>
      </Button>
    )
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => { setOpen(true); loadCandidates() }}>
        <GitMerge className="h-4 w-4" />
        Dedupe
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dedupe work IDs</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            {canAutoApprove
              ? "Select possible work IDs to verify now. They will be applied to this title immediately."
              : "Select possible work IDs to send for moderator review. They will not be added to this title until approved."}
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading matches...</div>
          ) : error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : candidates.length === 0 ? (
            <div className="text-sm text-muted-foreground">No candidates found.</div>
          ) : (
            <div className="space-y-2">
              {(showAll ? candidates.slice(0, 15) : candidates.slice(0, 5)).map((candidate) => (
                <div
                  key={candidate.workId}
                  className={cn(
                    "flex items-start gap-3 rounded-md border p-2",
                    candidate.alreadySelectedForReview
                      ? "border-border bg-muted/40 opacity-70"
                      : selected.includes(candidate.workId)
                        ? "border-primary"
                        : "border-border"
                  )}
                >
                  <div className="flex-1 space-y-1">
                    <div className="text-sm font-medium">{candidate.title || "Untitled"}</div>
                    <div className="text-xs text-muted-foreground">{candidate.author || "Unknown author"}</div>
                    <div className="text-xs text-muted-foreground">{candidate.workId}</div>
                    <div className="text-xs">First publish: {candidate.firstPublishYear ?? "Unknown"}</div>
                    <div className="text-xs">Editions: {candidate.editionCount ?? "Unknown"}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {(candidate.subjects ?? []).slice(0, 3).join(" / ") || "No subjects"}
                    </div>
                    {(linkedElsewhere[candidate.workId] ?? candidate.linkedElsewhereTitles ?? []).length > 0 ? (
                      <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
                        Linked to other titles: {(linkedElsewhere[candidate.workId] ?? candidate.linkedElsewhereTitles ?? [])
                          .map((title) => title.title)
                          .join(" • ")}
                      </div>
                    ) : null}
                  </div>
                  <Button
                    variant={candidate.alreadySelectedForReview ? "secondary" : selected.includes(candidate.workId) ? "default" : "outline"}
                    size="sm"
                    disabled={candidate.alreadySelectedForReview}
                    onClick={() => toggleWork(candidate.workId)}
                  >
                    {candidate.alreadySelectedForReview
                      ? "Already in review"
                      : selected.includes(candidate.workId)
                        ? "Selected"
                        : "Select"}
                  </Button>
                </div>
              ))}
              {candidates.length > 5 ? (
                <Button variant="ghost" size="sm" onClick={() => setShowAll((prev) => !prev)}>
                  {showAll ? "Show less" : "Show more"}
                </Button>
              ) : null}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || selected.length === 0}>
              {saving ? "Submitting..." : canAutoApprove ? "Verify now" : "Submit for review"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
