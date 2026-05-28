"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export type ReadingProgressMode = "pages" | "audiobook"

export type ReadingProgressSelectorValue = {
  mode: ReadingProgressMode
  currentPage: number
  totalPages: number
  minutesListened: number
  totalMinutes: number
}

type ReadingProgressSelectorProps = {
  value: ReadingProgressSelectorValue
  onChange: (value: ReadingProgressSelectorValue) => void
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const cleanWholeNumber = (value: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.floor(value))
}

function ProgressSummary({
  value,
  total,
  unit,
  className,
}: {
  value: number
  total: number
  unit: string
  className?: string
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0

  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div>
        <div className="font-sans text-4xl font-bold leading-none text-primary">{percent}%</div>
        <div className="font-ui mt-1 text-xs text-muted-foreground">complete</div>
      </div>
      <div className="font-ui text-right text-sm text-muted-foreground">
        <span className="font-sans text-2xl font-semibold text-foreground">{value}</span>
        <span className="mx-1">/</span>
        <span>{total}</span>
        <span className="ml-1">{unit}</span>
      </div>
    </div>
  )
}

export function ReadingProgressSelector({ value, onChange }: ReadingProgressSelectorProps) {
  const totalPages = Math.max(1, cleanWholeNumber(value.totalPages, 300))
  const currentPage = clamp(cleanWholeNumber(value.currentPage, 0), 0, totalPages)
  const totalMinutes = Math.max(1, cleanWholeNumber(value.totalMinutes, 600))
  const minutesListened = clamp(cleanWholeNumber(value.minutesListened, 0), 0, totalMinutes)

  const update = (patch: Partial<ReadingProgressSelectorValue>) => {
    onChange({ ...value, ...patch })
  }

  const setMode = (mode: ReadingProgressMode) => update({ mode })

  const setTotalPages = (nextValue: number) => {
    const nextTotal = Math.max(1, cleanWholeNumber(nextValue, totalPages))
    update({
      totalPages: nextTotal,
      currentPage: clamp(currentPage, 0, nextTotal),
    })
  }

  const setCurrentPage = (nextValue: number) => {
    update({ currentPage: clamp(cleanWholeNumber(nextValue, currentPage), 0, totalPages) })
  }

  const setTotalMinutes = (nextValue: number) => {
    const nextTotal = Math.max(1, cleanWholeNumber(nextValue, totalMinutes))
    update({
      totalMinutes: nextTotal,
      minutesListened: clamp(minutesListened, 0, nextTotal),
    })
  }

  const setMinutesListened = (nextValue: number) => {
    update({ minutesListened: clamp(cleanWholeNumber(nextValue, minutesListened), 0, totalMinutes) })
  }

  return (
    <Tabs value={value.mode} onValueChange={(mode) => setMode(mode as ReadingProgressMode)} className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="pages">Pages</TabsTrigger>
        <TabsTrigger value="audiobook">Audiobook</TabsTrigger>
      </TabsList>

      <TabsContent value="pages" className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <ProgressSummary value={currentPage} total={totalPages} unit="pages" />

          <div className="mt-5 space-y-3">
            <Slider
              value={[currentPage]}
              min={0}
              max={totalPages}
              step={1}
              onValueChange={([next]) => setCurrentPage(next ?? 0)}
              aria-label="Current page"
            />

            <div className="flex flex-wrap gap-2">
              {[-10, -1, 1, 10].map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + amount)}
                >
                  {amount > 0 ? `+${amount}` : amount}
                </Button>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={() => setCurrentPage(totalPages)}>
                Finished
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="reading-current-page">Current page</Label>
            <Input
              id="reading-current-page"
              inputMode="numeric"
              type="number"
              min={0}
              max={totalPages}
              value={currentPage}
              onChange={(event) => setCurrentPage(Number(event.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reading-total-pages">Total pages</Label>
            <Input
              id="reading-total-pages"
              inputMode="numeric"
              type="number"
              min={1}
              value={totalPages}
              onChange={(event) => setTotalPages(Number(event.target.value))}
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="audiobook" className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <ProgressSummary value={minutesListened} total={totalMinutes} unit="min" />

          <div className="mt-5 space-y-3">
            <Slider
              value={[minutesListened]}
              min={0}
              max={totalMinutes}
              step={1}
              onValueChange={([next]) => setMinutesListened(next ?? 0)}
              aria-label="Minutes listened"
            />

            <div className="flex flex-wrap gap-2">
              {[-30, -5, 5, 30].map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMinutesListened(minutesListened + amount)}
                >
                  {amount > 0 ? `+${amount}` : amount}
                </Button>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={() => setMinutesListened(totalMinutes)}>
                Finished
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="reading-minutes-listened">Minutes listened</Label>
            <Input
              id="reading-minutes-listened"
              inputMode="numeric"
              type="number"
              min={0}
              max={totalMinutes}
              value={minutesListened}
              onChange={(event) => setMinutesListened(Number(event.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reading-total-minutes">Total minutes</Label>
            <Input
              id="reading-total-minutes"
              inputMode="numeric"
              type="number"
              min={1}
              value={totalMinutes}
              onChange={(event) => setTotalMinutes(Number(event.target.value))}
            />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
