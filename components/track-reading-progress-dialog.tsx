"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { RichTextEditor } from "@/components/rich-text-editor"

type Mode = "pages" | "audiobook"

export type TrackReadingProgress =
  | { mode: "pages"; currentPage: number; totalPages: number; noteHtml: string; noteText: string }
  | { mode: "audiobook"; minutesListened: number; totalMinutes: number; noteHtml: string; noteText: string }

export function TrackReadingProgressDialog({
  open,
  onOpenChange,
  onSubmit,
  title,
  initialNoteHtml,
  initialNoteText,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (progress: TrackReadingProgress) => Promise<void>
  title: string
  initialNoteHtml?: string | null
  initialNoteText?: string | null
}) {
  const [mode, setMode] = useState<Mode>("pages")
  const [submitting, setSubmitting] = useState(false)

  const [totalPages, setTotalPages] = useState(300)
  const [currentPage, setCurrentPage] = useState(0)

  const [totalMinutes, setTotalMinutes] = useState(600)
  const [minutesListened, setMinutesListened] = useState(0)
  const [noteHtml, setNoteHtml] = useState("")
  const [noteText, setNoteText] = useState("")

  useEffect(() => {
    if (!open) return
    setNoteHtml(initialNoteHtml ?? "")
    setNoteText(initialNoteText ?? "")
  }, [open, initialNoteHtml, initialNoteText])

  const canSubmit = useMemo(() => {
    if (mode === "pages") {
      return Number.isFinite(totalPages) && totalPages > 0 && Number.isFinite(currentPage) && currentPage >= 0
    }
    return Number.isFinite(totalMinutes) && totalMinutes > 0 && Number.isFinite(minutesListened) && minutesListened >= 0
  }, [mode, totalPages, currentPage, totalMinutes, minutesListened])

  const submit = async () => {
    if (!canSubmit) return

    setSubmitting(true)
    try {
      if (mode === "pages") {
        await onSubmit({ mode: "pages", currentPage, totalPages, noteHtml, noteText })
      } else {
        await onSubmit({ mode: "audiobook", minutesListened, totalMinutes, noteHtml, noteText })
      }
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Track progress: {title}</DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="pages">Pages</TabsTrigger>
            <TabsTrigger value="audiobook">Audiobook</TabsTrigger>
          </TabsList>

          <TabsContent value="pages" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="totalPages">Total pages</Label>
              <Input
                id="totalPages"
                inputMode="numeric"
                type="number"
                min={1}
                value={totalPages}
                onChange={(e) => setTotalPages(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentPage">Current page</Label>
              <Input
                id="currentPage"
                inputMode="numeric"
                type="number"
                min={0}
                value={currentPage}
                onChange={(e) => setCurrentPage(Number(e.target.value))}
              />
            </div>
          </TabsContent>

          <TabsContent value="audiobook" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="totalMinutes">Total minutes</Label>
              <Input
                id="totalMinutes"
                inputMode="numeric"
                type="number"
                min={1}
                value={totalMinutes}
                onChange={(e) => setTotalMinutes(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minutesListened">Minutes listened</Label>
              <Input
                id="minutesListened"
                inputMode="numeric"
                type="number"
                min={0}
                value={minutesListened}
                onChange={(e) => setMinutesListened(Number(e.target.value))}
              />
            </div>
          </TabsContent>
        </Tabs>

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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || !canSubmit}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
