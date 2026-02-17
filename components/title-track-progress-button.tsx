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
  bookId,
  trackedBookId,
}: {
  titleId: string
  title: string
  bookId?: string | null
  trackedBookId?: string | null
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const submit = async (progress: TrackReadingProgress) => {
    try {
      await trackTitleProgress({ titleId, bookId, trackedBookId, progress })
      toast.success("Progress saved")
      setOpen(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to save progress")
    }
  }

  if (!bookId && !trackedBookId) return null

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Track
      </Button>
      <TrackReadingProgressDialog open={open} onOpenChange={setOpen} title={title} onSubmit={submit} />
    </>
  )
}
