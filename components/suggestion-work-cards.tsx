"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { type WorkSnapshot } from "@/lib/suggestions"

type LinkedTitleSummary = {
  titleId: string
  title: string
}

export type { WorkSnapshot } from "@/lib/suggestions"

function SaleBadge({ forSale }: { forSale?: boolean | null }) {
  if (forSale === true) return <Badge>For sale</Badge>
  if (forSale === false) return <Badge variant="secondary">Not for sale</Badge>
  return <Badge variant="outline">Sale unknown</Badge>
}

function WorkMiniCard({ snapshot }: { snapshot: WorkSnapshot }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">{snapshot.title || "Untitled"}</div>
      <div className="text-xs text-muted-foreground">{snapshot.author || "Unknown author"}</div>
      <div className="text-xs">First publish: {snapshot.firstPublishYear ?? "Unknown"}</div>
      <div className="text-xs">Editions: {snapshot.editionCount ?? "Unknown"}</div>
      <div className="pt-1">
        <SaleBadge forSale={snapshot.forSale ?? null} />
      </div>
      {snapshot.matchConfidence != null || snapshot.matchReason ? (
        <div className="space-y-1 pt-1">
          {snapshot.matchConfidence != null ? (
            <div className="text-xs text-muted-foreground">Confidence: {snapshot.matchConfidence}%</div>
          ) : null}
          {snapshot.matchReason ? (
            <div className="text-xs text-muted-foreground">{snapshot.matchReason}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function SuggestionWorkCards({
  works,
  selectedWorkIds,
  onToggleSelected,
  selectedBadgeLabel,
  selectLabel,
  unselectLabel,
  emptyMessage,
  linkedElsewhereByWorkId,
}: {
  works: WorkSnapshot[]
  selectedWorkIds?: string[] | null
  onToggleSelected?: (workId: string) => void
  selectedBadgeLabel?: string
  selectLabel?: string
  unselectLabel?: string
  emptyMessage?: string
  linkedElsewhereByWorkId?: Record<string, LinkedTitleSummary[]>
}) {
  if (works.length === 0) {
    return <div className="text-xs text-muted-foreground">{emptyMessage ?? "No work selections"}</div>
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {works.map((snapshot) => {
        const isSelected = Boolean(selectedWorkIds?.includes(snapshot.workId))
        const linkedElsewhereTitles = linkedElsewhereByWorkId?.[snapshot.workId] ?? []

        return (
          <div key={snapshot.workId} className="space-y-2 rounded-md border border-border p-3">
            <div className="flex flex-wrap gap-2">
              {isSelected ? <Badge>{selectedBadgeLabel ?? "Selected"}</Badge> : null}
              {snapshot.matchCategory === "exact_auto_dupe" ? <Badge variant="outline">Exact auto-dupe</Badge> : null}
              {snapshot.matchCategory === "bookworm_suggested" ? <Badge variant="outline">Bookworm suggested</Badge> : null}
              {linkedElsewhereTitles.length > 0 ? <Badge variant="secondary">Linked elsewhere</Badge> : null}
            </div>
            <WorkMiniCard snapshot={snapshot} />
            {linkedElsewhereTitles.length > 0 ? (
              <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
                Linked to other titles: {linkedElsewhereTitles.map((title) => title.title).join(" • ")}
              </div>
            ) : null}
            {onToggleSelected ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" size="sm" variant={isSelected ? "default" : "outline"} onClick={() => onToggleSelected(snapshot.workId)}>
                  {isSelected ? (unselectLabel ?? "Remove") : (selectLabel ?? "Select")}
                </Button>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
