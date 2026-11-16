"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BarChart3 } from "lucide-react"
import { TrackReadingProgressDialog, type TrackReadingProgress } from "@/components/track-reading-progress-dialog"
import { trackTitleProgress } from "@/app/actions/track-reading"
import { getErrorMessage } from "@/lib/errors"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function TitleTrackProgressButton({
  titleId,
  title,
  isSignedIn,
  initialNoteHtml,
  initialNoteText,
}: {
  titleId: string
  title: string
  isSignedIn: boolean
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
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to save progress"))
    }
  }

  if (!isSignedIn) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5" asChild>
        <Link href="/auth">
          <BarChart3 className="h-4 w-4" />
          Sign in to track
        </Link>
      </Button>
    )
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <BarChart3 className="h-4 w-4" />
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
