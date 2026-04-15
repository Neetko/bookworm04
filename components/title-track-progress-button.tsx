"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { TrackReadingProgressDialog, type TrackReadingProgress } from "@/components/track-reading-progress-dialog"
import { trackTitleProgress } from "@/app/actions/track-reading"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function TitleTrackProgressButton({
  titleId,
  title,
  initialNoteHtml,
  initialNoteText,
}: {
  titleId: string
  title: string
  initialNoteHtml?: string | null
  initialNoteText?: string | null
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const submit = async (progress: TrackReadingProgress) => {
    try {
      await trackTitleProgress({
        titleId,
        progress,
        noteHtml: progress.noteHtml,
        noteText: progress.noteText,
      })
      toast.success("Progress saved")
      setOpen(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to save progress")
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Track
      </Button>
      <TrackReadingProgressDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        onSubmit={submit}
        initialNoteHtml={initialNoteHtml}
        initialNoteText={initialNoteText}
      />
    </>
  )
}
