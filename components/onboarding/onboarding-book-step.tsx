"use client"

import { CoverImage } from "@/components/cover-image"
import { MAX_ONBOARDING_SEARCH_LENGTH } from "@/lib/onboarding-limits"
import { TitleGenreDots } from "@/components/title-genre-dots"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { SearchTitleResult } from "@/lib/types"
import { BookOpen, Loader2, Search } from "lucide-react"

export type OnboardingShelf = "finished" | "current" | "planned"

const SHELF_COPY: Record<
  OnboardingShelf,
  {
    title: string
    description: string
    empty: string
  }
> = {
  finished: {
    title: "What have you already finished?",
    description: "Pick any ingested titles you have completed. We'll add them to your Finished Reading list.",
    empty: "No finished titles selected yet.",
  },
  current: {
    title: "What are you reading right now?",
    description: "Add titles you are currently reading. Anything chosen earlier is automatically hidden here.",
    empty: "No current reads selected yet.",
  },
  planned: {
    title: "What do you plan to read next?",
    description: "Build your Planned Reading list. Titles already chosen in other onboarding steps stay out of the suggestions.",
    empty: "No planned reads selected yet.",
  },
}

type OnboardingBookStepProps = {
  shelf: OnboardingShelf
  query: string
  selectedTitles: SearchTitleResult[]
  visibleResults: SearchTitleResult[]
  searchLoading: boolean
  onQueryChange: (value: string) => void
  onAddTitle: (title: SearchTitleResult) => void
  onRemoveTitle: (titleId: string) => void
  onBack: () => void
  onNext: () => void
}

export function OnboardingBookStep({
  shelf,
  query,
  selectedTitles,
  visibleResults,
  searchLoading,
  onQueryChange,
  onAddTitle,
  onRemoveTitle,
  onBack,
  onNext,
}: OnboardingBookStepProps) {
  const copy = SHELF_COPY[shelf]

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          {copy.title}
        </CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor={`search-${shelf}`}>
            Search ingested titles
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`search-${shelf}`}
              value={query}
              maxLength={MAX_ONBOARDING_SEARCH_LENGTH}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search by title or author"
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-foreground">Selected titles</h2>
            <Badge variant="secondary">{selectedTitles.length}</Badge>
          </div>
          {selectedTitles.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {selectedTitles.map((title) => (
                <div key={`${shelf}-${title.id}`} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="relative h-16 w-12 overflow-hidden rounded bg-muted">
                    <CoverImage src={title.coverImageUrl} alt={title.title} sizes="48px" />
                    {!title.coverImageUrl ? (
                      <div className="flex h-full w-full items-center justify-center">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate font-medium text-foreground">{title.title}</div>
                      <TitleGenreDots genres={title.genres} />
                    </div>
                    <div className="truncate text-sm text-muted-foreground">{title.author}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onRemoveTitle(title.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {copy.empty}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-foreground">Suggestions</h2>
            {searchLoading ? (
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading
              </span>
            ) : null}
          </div>
          {visibleResults.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleResults.slice(0, 18).map((title) => (
                <button
                  key={`${shelf}-result-${title.id}`}
                  type="button"
                  onClick={() => onAddTitle(title)}
                  className="flex items-center gap-3 rounded-lg border p-3 text-left transition hover:border-primary hover:bg-muted/40"
                >
                  <div className="relative h-20 w-14 overflow-hidden rounded bg-muted">
                    <CoverImage src={title.coverImageUrl} alt={title.title} sizes="56px" />
                    {!title.coverImageUrl ? (
                      <div className="flex h-full w-full items-center justify-center">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <div className="line-clamp-2 font-medium text-foreground">{title.title}</div>
                      <TitleGenreDots genres={title.genres} className="mt-1" />
                    </div>
                    <div className="truncate text-sm text-muted-foreground">{title.author}</div>
                  </div>
                  <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">Add</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No matching ingested titles yet.
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="justify-between gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onNext}>
            Skip
          </Button>
          <Button onClick={onNext}>Continue</Button>
        </div>
      </CardFooter>
    </Card>
  )
}
