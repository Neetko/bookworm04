"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CoverImage } from "@/components/cover-image"
import { type CoverChoice } from "@/lib/suggestions"
import { cn } from "@/lib/utils"

export function SuggestionCoverPicker({
  options,
  selectedCover,
  onSelect,
  onClear,
  emptyMessage,
}: {
  options: CoverChoice[]
  selectedCover: CoverChoice | null
  onSelect: (choice: CoverChoice) => void
  onClear?: () => void
  emptyMessage?: string
}) {
  if (options.length === 0) {
    return <div className="text-xs text-muted-foreground">{emptyMessage ?? "No cover options available"}</div>
  }

  return (
    <div className="space-y-3">
      {selectedCover ? (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Clear cover choice
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => {
          const isSelected = Boolean(
            selectedCover
            && selectedCover.workId === option.workId
            && selectedCover.source === option.source
            && selectedCover.sourceCoverKey === option.sourceCoverKey
          )

          return (
            <button
              key={`${option.workId}:${option.source}:${option.sourceCoverKey}`}
              type="button"
              className={cn(
                "overflow-hidden rounded-md border text-left transition-colors",
                isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
              )}
              onClick={() => onSelect(option)}
            >
              <div className="relative aspect-[2/3] bg-muted">
                <CoverImage
                  src={option.imageUrl}
                  alt={`Cover candidate for ${option.workId}`}
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 20vw"
                />
              </div>
              <div className="space-y-2 p-3">
                <div className="flex flex-wrap gap-2">
                  {isSelected ? <Badge>Selected</Badge> : null}
                  <Badge variant="outline">{option.source === "openlibrary" ? "Open Library" : "Google"}</Badge>
                  {option.source === "openlibrary" && option.cachedFilePath ? <Badge variant="secondary">Cached</Badge> : null}
                </div>
                <div className="text-xs text-muted-foreground break-all">{option.workId}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
