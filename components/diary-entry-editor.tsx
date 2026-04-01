"use client"

import { useEffect, useMemo, useState } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { RichTextEditor } from "@/components/rich-text-editor"
import { updateDiaryEntry } from "@/app/actions/track-reading"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export type DiaryEntryEditorProps = {
  entryId: string
  initialMode: "pages" | "audiobook"
  initialCurrentPage: number | null
  initialTotalPages: number | null
  initialMinutesListened: number | null
  initialTotalMinutes: number | null
  initialNoteHtml: string | null
}

export function DiaryEntryEditor({
  entryId,
  initialMode,
  initialCurrentPage,
  initialTotalPages,
  initialMinutesListened,
  initialTotalMinutes,
  initialNoteHtml,
}: DiaryEntryEditorProps) {
  const [open, setOpen] = useState(false)
  const [noteHtml, setNoteHtml] = useState(initialNoteHtml ?? "")
  const [noteText, setNoteText] = useState("")
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    setNoteHtml(initialNoteHtml ?? "")
    setNoteText("")
  }, [open, initialNoteHtml])

  const submit = async () => {
    setSaving(true)
    try {
      await updateDiaryEntry({ entryId, noteHtml, noteText })
      toast.success("Entry updated")
      setOpen(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to update entry")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button variant="outline" onClick={() => setOpen((prev) => !prev)}>
        {open ? "Close editor" : "Edit entry"}
      </Button>

      {open ? (
        <div className="rounded-lg border border-border bg-background p-4 space-y-4">
          <div className="space-y-2">
            <Label>Diary note</Label>
            <RichTextEditor
              value={noteHtml}
              onChange={(html, text) => {
                setNoteHtml(html)
                setNoteText(text)
              }}
              placeholder="Write your diary note..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
