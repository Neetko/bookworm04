"use client"

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen } from "lucide-react"
import type { SearchTitleResult } from "@/lib/types"
import { ensureGoogleBook } from "@/app/actions/track-reading"
import { toast } from "sonner"
import { sanitizeDescriptionHtml } from "@/lib/sanitize"

type CoverStatus = "loading" | "loaded" | "failed" | "missing"

const failedCoverSrcs = new Set<string>()

function Cover({
  src,
  alt,
  onStatusChange,
}: {
  src: string | null
  alt: string
  onStatusChange?: (status: CoverStatus) => void
}) {
  const [failed, setFailed] = useState(false)
  const normalized = src ? src.replace(/^http:/, "https:") : null

  useEffect(() => {
    if (!normalized) {
      setFailed(true)
      onStatusChange?.("missing")
      return
    }

    if (failedCoverSrcs.has(normalized)) {
      setFailed(true)
      onStatusChange?.("failed")
      return
    }

    setFailed(false)
    onStatusChange?.("loading")
  }, [normalized, onStatusChange])

  if (!normalized || failed) {
    return (
      <div className="w-full sm:w-48 h-48 sm:h-auto bg-muted flex items-center justify-center flex-shrink-0">
        <BookOpen className="h-12 w-12 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="relative w-full sm:w-48 h-48 sm:h-auto bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
      <Image
        src={normalized}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, 192px"
        className="object-cover"
        referrerPolicy="no-referrer"
        onLoadingComplete={() => onStatusChange?.("loaded")}
        onError={() => {
          failedCoverSrcs.add(normalized)
          setFailed(true)
          onStatusChange?.("failed")
        }}
        unoptimized
      />
    </div>
  )
}

export function TrackReadingResultList({ results }: { results: SearchTitleResult[] }) {
  const router = useRouter()
  const [googleTitleIds, setGoogleTitleIds] = useState<Record<string, string>>({})
  const [ingestedVolumeIds, setIngestedVolumeIds] = useState<Set<string>>(new Set())
  const [coverStatus, setCoverStatus] = useState<Record<string, CoverStatus>>({})
  const [orderedResults, setOrderedResults] = useState<SearchTitleResult[]>(results)
  const hasReorderedRef = useRef(false)
  const reorderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const initialMap: Record<string, string> = {}
    for (const item of results) {
      if (item.source === "google" && item.volumeId && item.titleId) {
        initialMap[item.volumeId] = item.titleId
      }
    }
    setGoogleTitleIds(initialMap)
    setCoverStatus({})
    setOrderedResults(results)
    setIngestedVolumeIds(new Set())
    hasReorderedRef.current = false
    if (reorderTimerRef.current) {
      clearTimeout(reorderTimerRef.current)
      reorderTimerRef.current = null
    }
  }, [results])

  useEffect(() => {
    if (hasReorderedRef.current || results.length === 0) return

    if (reorderTimerRef.current) {
      clearTimeout(reorderTimerRef.current)
    }

    reorderTimerRef.current = setTimeout(() => {
      const indexMap = new Map<string, number>()
      results.forEach((result, index) => {
        indexMap.set(`${result.source}:${result.id}`, index)
      })

      const rankForStatus = (status: CoverStatus | undefined) => {
        switch (status) {
          case "loaded":
            return 0
          case "loading":
            return 1
          case "failed":
          case "missing":
          default:
            return 2
        }
      }

      const next = [...results].sort((a, b) => {
        const keyA = `${a.source}:${a.id}`
        const keyB = `${b.source}:${b.id}`
        const rankA = rankForStatus(coverStatus[keyA])
        const rankB = rankForStatus(coverStatus[keyB])
        if (rankA !== rankB) return rankA - rankB
        return (indexMap.get(keyA) ?? 0) - (indexMap.get(keyB) ?? 0)
      })

      setOrderedResults(next)
      hasReorderedRef.current = true
      reorderTimerRef.current = null
    }, 400)

    return () => {
      if (reorderTimerRef.current) {
        clearTimeout(reorderTimerRef.current)
        reorderTimerRef.current = null
      }
    }
  }, [coverStatus, results])

  const ingestExternal = async (result: SearchTitleResult) => {
    if (result.source !== "google" || !result.volumeId) return

    try {
      const res = await ensureGoogleBook(result.volumeId)
      toast.success("Title ingested")
      if (res.titleId) {
        setGoogleTitleIds((prev) => ({ ...prev, [result.volumeId as string]: res.titleId }))
      }
      setIngestedVolumeIds((prev) => {
        const next = new Set(prev)
        next.add(result.volumeId as string)
        return next
      })
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to ingest title")
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
      {orderedResults.map((result) => {
        const resultKey = `${result.source}:${result.id}`
        const resolvedTitleId =
          result.source === "google" && result.volumeId
            ? googleTitleIds[result.volumeId] ?? result.titleId
            : result.titleId ?? result.id
        const isClickable = Boolean(resolvedTitleId)
        const showOpenReady = Boolean(resolvedTitleId)
        const isIngested =
          result.source === "local" ||
          result.claimed ||
          (result.volumeId ? ingestedVolumeIds.has(result.volumeId) : false)
        const showIngest = result.source === "google" && !isIngested
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
            <Cover
              src={result.coverImageUrl}
              alt={result.title}
              onStatusChange={(status) => {
                setCoverStatus((prev) => {
                  if (prev[resultKey] === status) return prev
                  return { ...prev, [resultKey]: status }
                })
              }}
            />

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

              {showIngest ? (
                <CardFooter className="p-6 pt-0 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => ingestExternal(result)}>
                    Ingest
                  </Button>
                </CardFooter>
              ) : null}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
