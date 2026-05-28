"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RichTextEditor } from "@/components/rich-text-editor"
import { ScrollArea } from "@/components/ui/scroll-area"
import { trackTitleProgress } from "@/app/actions/track-reading"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { ReadingProgressSelector, type ReadingProgressMode } from "@/components/reading-progress-selector"

export type DiaryTitleOption = {
  id: string
  title: string
  author: string
  coverImageUrl: string | null
  listTypes: Array<"to-read" | "current-reading">
  lastProgress?: {
    currentPage: number | null
    totalPages: number | null
    minutesListened: number | null
    totalMinutes: number | null
    progressPercent: number | null
  } | null
}

export function DiaryEntryDialog({
  titles,
  canCreateToday = true,
  todayNotesByTitleId = {},
}: {
  titles: DiaryTitleOption[]
  canCreateToday?: boolean
  todayNotesByTitleId?: Record<string, { noteHtml: string; noteText: string }>
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedTitle, setSelectedTitle] = useState<DiaryTitleOption | null>(null)
  const [mode, setMode] = useState<ReadingProgressMode>("pages")
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [listFilter, setListFilter] = useState<"to-read" | "current-reading">("to-read")

  const [totalPages, setTotalPages] = useState(300)
  const [currentPage, setCurrentPage] = useState(0)

  const [totalMinutes, setTotalMinutes] = useState(600)
  const [minutesListened, setMinutesListened] = useState(0)

  const [noteHtml, setNoteHtml] = useState("")
  const [noteText, setNoteText] = useState("")

  const router = useRouter()

  useEffect(() => {
    if (!open) return
    setQuery("")
    setSelectedTitle(null)
    setMode("pages")
    setStep(1)
    setListFilter("to-read")
    setNoteHtml("")
    setNoteText("")
    setCurrentPage(0)
    setTotalPages(300)
    setMinutesListened(0)
    setTotalMinutes(600)
  }, [open])

  useEffect(() => {
    if (!open) return
    if (!selectedTitle) {
      setNoteHtml("")
      setNoteText("")
      return
    }
    const todayNote = todayNotesByTitleId[selectedTitle.id]
    if (todayNote) {
      setNoteHtml(todayNote.noteHtml ?? "")
      setNoteText(todayNote.noteText ?? "")
    } else {
      setNoteHtml("")
      setNoteText("")
    }
  }, [open, selectedTitle, todayNotesByTitleId])

  useEffect(() => {
    if (!selectedTitle) return
    const progress = selectedTitle.lastProgress
    if (!progress) return

    if (progress.totalPages != null || progress.currentPage != null) {
      setMode("pages")
      if (progress.totalPages != null) setTotalPages(progress.totalPages)
      if (progress.currentPage != null) setCurrentPage(progress.currentPage)
    } else if (progress.totalMinutes != null || progress.minutesListened != null) {
      setMode("audiobook")
      if (progress.totalMinutes != null) setTotalMinutes(progress.totalMinutes)
      if (progress.minutesListened != null) setMinutesListened(progress.minutesListened)
    }
  }, [selectedTitle])

  useEffect(() => {
    if (!selectedTitle) return
    if (!selectedTitle.listTypes.includes(listFilter)) {
      setSelectedTitle(null)
    }
  }, [listFilter, selectedTitle])

  const filteredTitles = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const scoped = titles.filter((title) => title.listTypes.includes(listFilter))
    if (!normalized) return scoped
    return scoped.filter((title) =>
      `${title.title} ${title.author}`.toLowerCase().includes(normalized)
    )
  }, [query, titles, listFilter])

  const canSubmit = useMemo(() => {
    if (!selectedTitle) return false
    if (mode === "pages") {
      return Number.isFinite(totalPages) && totalPages > 0 && Number.isFinite(currentPage) && currentPage >= 0 && currentPage <= totalPages
    }
    return Number.isFinite(totalMinutes) && totalMinutes > 0 && Number.isFinite(minutesListened) && minutesListened >= 0 && minutesListened <= totalMinutes
  }, [selectedTitle, mode, totalPages, currentPage, totalMinutes, minutesListened])

  const submit = async () => {
    if (!selectedTitle || !canSubmit) return

    setSubmitting(true)
    try {
      if (mode === "pages") {
        await trackTitleProgress({
          titleId: selectedTitle.id,
          progress: { mode: "pages", currentPage, totalPages },
          noteHtml,
          noteText,
        })
      } else {
        await trackTitleProgress({
          titleId: selectedTitle.id,
          progress: { mode: "audiobook", minutesListened, totalMinutes },
          noteHtml,
          noteText,
        })
      }

      toast.success("Diary entry saved")
      setOpen(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to save diary entry")
    } finally {
      setSubmitting(false)
    }
  }

  const noteButtonLabel = noteText.trim().length > 0 ? "Submit" : "Skip"

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="gap-2"
        disabled={titles.length === 0 || !canCreateToday}
      >
        <Plus className="h-4 w-4" />
        New entry
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New diary entry</DialogTitle>
          </DialogHeader>

          {titles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add a title to your lists to start a diary entry.</p>
          ) : (
            <div className="space-y-4">
              {step === 1 ? (
                <div className="space-y-4">
                  <Tabs value={listFilter} onValueChange={(value) => setListFilter(value as "to-read" | "current-reading")}>
                    <TabsList className="grid grid-cols-2">
                      <TabsTrigger value="to-read">Planned Reading</TabsTrigger>
                      <TabsTrigger value="current-reading">Current Reading</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="space-y-2">
                    <Label htmlFor="diaryTitleSearch">Choose a title</Label>
                    <Input
                      id="diaryTitleSearch"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search Planned or Current Reading"
                    />
                    <ScrollArea className="max-h-48 rounded-md border">
                      <div className="divide-y">
                        {filteredTitles.map((title) => (
                          <button
                            key={title.id}
                            type="button"
                            className={`w-full px-3 py-2 text-left hover:bg-accent ${
                              selectedTitle?.id === title.id ? "bg-accent" : ""
                            }`}
                            onClick={() => setSelectedTitle(title)}
                          >
                            <div className="text-sm font-medium">{title.title}</div>
                            <div className="text-xs text-muted-foreground">{title.author}</div>
                          </button>
                        ))}
                        {filteredTitles.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">No matches.</div>
                        ) : null}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => setStep(2)} disabled={!selectedTitle}>
                      Continue
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === 2 && selectedTitle ? (
                <div className="space-y-4">
                  <ReadingProgressSelector
                    value={{
                      mode,
                      currentPage,
                      totalPages,
                      minutesListened,
                      totalMinutes,
                    }}
                    onChange={(next) => {
                      setMode(next.mode)
                      setCurrentPage(next.currentPage)
                      setTotalPages(next.totalPages)
                      setMinutesListened(next.minutesListened)
                      setTotalMinutes(next.totalMinutes)
                    }}
                  />

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button onClick={() => setStep(3)} disabled={!canSubmit}>
                      Continue
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === 3 && selectedTitle ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Diary note</Label>
                    <RichTextEditor
                      value={noteHtml}
                      onChange={(html, text) => {
                        setNoteHtml(html)
                        setNoteText(text)
                      }}
                      placeholder="Add a note about this reading session..."
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setStep(2)} disabled={submitting}>
                      Back
                    </Button>
                    <Button onClick={submit} disabled={submitting || !canSubmit}>
                      {submitting ? "Saving…" : noteButtonLabel}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
