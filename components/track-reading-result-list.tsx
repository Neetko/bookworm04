"use client"

import { useEffect, useState, type KeyboardEvent, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen } from "lucide-react"
import type { SearchTitleResult } from "@/lib/types"
import { TrackReadingProgressDialog, type TrackReadingProgress } from "@/components/track-reading-progress-dialog"
import { claimAndTrackGoogleBook, claimAndTrackLocalBook } from "@/app/actions/track-reading"
import { toast } from "sonner"
import { sanitizeDescriptionHtml } from "@/lib/sanitize"

function Cover({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)
  const normalized = src ? src.replace(/^http:/, "https:") : null

  if (!normalized || failed) {
    return (
      <div className="w-full sm:w-48 h-48 sm:h-auto bg-muted flex items-center justify-center flex-shrink-0">
        <BookOpen className="h-12 w-12 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="w-full sm:w-48 h-48 sm:h-auto bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
      <img
        src={normalized}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  )
}

export function TrackReadingResultList({ results }: { results: SearchTitleResult[] }) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTitle, setDialogTitle] = useState("")
  const [pendingLocalId, setPendingLocalId] = useState<string | null>(null)
  const [pendingGoogleId, setPendingGoogleId] = useState<string | null>(null)
  const [googleTitleIds, setGoogleTitleIds] = useState<Record<string, string>>({})

  useEffect(() => {
    const initialMap: Record<string, string> = {}
    for (const item of results) {
      if (item.source === "google" && item.volumeId && item.titleId) {
        initialMap[item.volumeId] = item.titleId
      }
    }
    setGoogleTitleIds(initialMap)
  }, [results])

  const openLocalDialog = (result: SearchTitleResult) => {
    setPendingGoogleId(null)
    setPendingLocalId(result.id)
    setDialogTitle(result.title)
    setDialogOpen(true)
  }

  const openGoogleDialog = (result: SearchTitleResult) => {
    setPendingLocalId(null)
    setPendingGoogleId(result.volumeId ?? null)
    setDialogTitle(result.title)
    setDialogOpen(true)
  }

  const submit = async (progress: TrackReadingProgress) => {
    try {
      if (pendingLocalId) {
        await claimAndTrackLocalBook(pendingLocalId, progress)
        toast.success("Progress saved")
        setDialogOpen(false)
        setPendingLocalId(null)
        router.refresh()
        return
      }

      if (pendingGoogleId) {
        const res = await claimAndTrackGoogleBook(pendingGoogleId, progress)
        toast.success("Book claimed and progress saved")
        if (res.titleId) {
          setGoogleTitleIds((prev) => ({ ...prev, [pendingGoogleId]: res.titleId }))
        }
        setDialogOpen(false)
        setPendingGoogleId(null)
        router.refresh()
        return
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save progress")
      throw e
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

  return (
    <div className="space-y-6">
      {results.map((result) => {
        const resolvedTitleId =
          result.source === "google" && result.volumeId
            ? googleTitleIds[result.volumeId] ?? result.titleId
            : result.titleId ?? result.id
        const isClickable = Boolean(resolvedTitleId)
        const showOpenReady = Boolean(resolvedTitleId)
        const descriptionHtml = sanitizeDescriptionHtml(result.description)

        return (
          <Card
            key={`${result.source}:${result.id}`}
            className={`flex flex-col sm:flex-row hover:shadow-lg transition-shadow overflow-hidden min-h-[200px] ${
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
            <Cover src={result.coverImageUrl} alt={result.title} />

            <div className="flex flex-col flex-1">
              <CardContent className="p-6 flex-1">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-semibold text-xl mb-1">{result.title}</h3>
                    <p className="text-muted-foreground mb-3">by {result.author}</p>
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

              <CardFooter className="p-6 pt-0 flex justify-end gap-2">
                {result.source === "google" ? (
                  <Button variant="outline" onClick={() => openGoogleDialog(result)}>
                    Track
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => openLocalDialog(result)}>
                    Track
                  </Button>
                )}
              </CardFooter>
            </div>
          </Card>
        )
      })}

      <TrackReadingProgressDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogTitle}
        onSubmit={submit}
      />
    </div>
  )
}
