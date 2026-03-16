"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getTitleDedupeCandidatesAction, updateTitleDedupeAction } from "@/app/actions/title"

export function TitleDedupeDialog({ titleId }: { titleId: string }) {
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
  }>>([])
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const loadCandidates = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getTitleDedupeCandidatesAction(titleId)
      setCandidates(res.candidates)
      setSelected(res.selected)
    } catch (e: any) {
      setError(e?.message ?? "Failed to load work matches")
    } finally {
      setLoading(false)
    }
  }

  const toggleWork = (workId: string) => {
    setSelected((prev) => (prev.includes(workId) ? prev.filter((id) => id !== workId) : [...prev, workId]))
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await updateTitleDedupeAction(titleId, selected)
      setOpen(false)
    } catch (e: any) {
      setError(e?.message ?? "Failed to update dedupe list")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => { setOpen(true); loadCandidates() }}>
        Dedupe
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dedupe work IDs</DialogTitle>
          </DialogHeader>
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
                    selected.includes(candidate.workId) ? "border-primary" : "border-border"
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
                  </div>
                  <Button
                    variant={selected.includes(candidate.workId) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleWork(candidate.workId)}
                  >
                    {selected.includes(candidate.workId) ? "Selected" : "Select"}
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
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
