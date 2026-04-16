"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  checkUsernameAvailability,
  completeOnboardingUsername,
  getOnboardingFollowSuggestions,
  saveOnboardingSelections,
  searchOnboardingTitles,
  type OnboardingFollowSuggestion,
} from "@/app/actions/onboarding"
import { CoverImage } from "@/components/cover-image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { Progress } from "@/components/ui/progress"
import { sanitizeUsernameInput } from "@/lib/onboarding"
import type { SearchTitleResult } from "@/lib/types"
import { BookOpen, Check, Loader2, Search, UserPlus, Users } from "lucide-react"
import { toast } from "sonner"

type ShelfKey = "finished" | "current" | "planned"

type UsernameStatus = "idle" | "checking" | "available" | "error"

type UsernameFeedback = {
  status: UsernameStatus
  message: string
}

type OnboardingClientProps = {
  initialUsername: string | null
  initialTitles: SearchTitleResult[]
}

const STEPS = [
  "Choose username",
  "Finished books",
  "Current reads",
  "Planned reads",
  "Find readers",
] as const

const BOOK_STEP_ORDER: ShelfKey[] = ["finished", "current", "planned"]

const BOOK_STEP_COPY: Record<
  ShelfKey,
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

function getInitials(name: string) {
  const normalized = name.trim()
  if (!normalized) return "?"
  const parts = normalized.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()
  }
  return normalized.slice(0, 2).toUpperCase()
}

export function OnboardingClient({ initialUsername, initialTitles }: OnboardingClientProps) {
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [username, setUsername] = useState(sanitizeUsernameInput(initialUsername))
  const [usernameSaved, setUsernameSaved] = useState(false)
  const [usernameFeedback, setUsernameFeedback] = useState<UsernameFeedback>({
    status: "idle",
    message: "Choose the username other readers will see.",
  })
  const [usernameSubmitting, setUsernameSubmitting] = useState(false)

  const [selections, setSelections] = useState<Record<ShelfKey, SearchTitleResult[]>>({
    finished: [],
    current: [],
    planned: [],
  })
  const [queries, setQueries] = useState<Record<ShelfKey, string>>({
    finished: "",
    current: "",
    planned: "",
  })
  const [searchResults, setSearchResults] = useState<Record<ShelfKey, SearchTitleResult[]>>({
    finished: [],
    current: [],
    planned: [],
  })
  const [searchLoading, setSearchLoading] = useState<Record<ShelfKey, boolean>>({
    finished: false,
    current: false,
    planned: false,
  })
  const [followSuggestions, setFollowSuggestions] = useState<OnboardingFollowSuggestion[]>([])
  const [followLoading, setFollowLoading] = useState(false)
  const [selectedFollowIds, setSelectedFollowIds] = useState<string[]>([])
  const [finishing, setFinishing] = useState(false)

  const activeShelf = step >= 1 && step <= 3 ? BOOK_STEP_ORDER[step - 1] : null

  const allSelectedTitleIds = useMemo(
    () => Array.from(new Set(Object.values(selections).flat().map((title) => title.id))),
    [selections]
  )

  useEffect(() => {
    if (usernameSaved) return

    const sanitized = sanitizeUsernameInput(username)
    if (!sanitized) {
      setUsernameFeedback({ status: "error", message: "Username is required" })
      return
    }

    setUsernameFeedback({ status: "checking", message: "Checking availability..." })

    const handle = window.setTimeout(async () => {
      try {
        const result = await checkUsernameAvailability(sanitized)
        setUsernameFeedback({
          status: result.available ? "available" : "error",
          message: result.message,
        })
      } catch (error) {
        setUsernameFeedback({ status: "error", message: "Could not check username right now" })
      }
    }, 300)

    return () => {
      window.clearTimeout(handle)
    }
  }, [username, usernameSaved])

  useEffect(() => {
    if (!activeShelf) return

    const query = queries[activeShelf].trim()
    if (!query) {
      setSearchResults((prev) => ({ ...prev, [activeShelf]: [] }))
      setSearchLoading((prev) => ({ ...prev, [activeShelf]: false }))
      return
    }

    const handle = window.setTimeout(async () => {
      setSearchLoading((prev) => ({ ...prev, [activeShelf]: true }))
      try {
        const results = await searchOnboardingTitles(query, allSelectedTitleIds)
        setSearchResults((prev) => ({ ...prev, [activeShelf]: results }))
      } catch (error) {
        toast.error("Failed to search titles")
      } finally {
        setSearchLoading((prev) => ({ ...prev, [activeShelf]: false }))
      }
    }, 250)

    return () => {
      window.clearTimeout(handle)
    }
  }, [activeShelf, allSelectedTitleIds, queries])

  useEffect(() => {
    if (step !== 4) return

    if (allSelectedTitleIds.length === 0) {
      setFollowSuggestions([])
      return
    }

    const handle = window.setTimeout(async () => {
      setFollowLoading(true)
      try {
        const results = await getOnboardingFollowSuggestions(allSelectedTitleIds)
        setFollowSuggestions(results)
        setSelectedFollowIds((prev) => prev.filter((profileId) => results.some((item) => item.profileId === profileId)))
      } catch (error) {
        toast.error("Failed to load reader suggestions")
      } finally {
        setFollowLoading(false)
      }
    }, 200)

    return () => {
      window.clearTimeout(handle)
    }
  }, [allSelectedTitleIds, step])

  const progressValue = ((step + 1) / STEPS.length) * 100

  const visibleResults = useMemo(() => {
    if (!activeShelf) return []

    const query = queries[activeShelf].trim().toLowerCase()
    if (query) return searchResults[activeShelf]

    return initialTitles.filter((title) => {
      if (allSelectedTitleIds.includes(title.id)) return false
      return true
    })
  }, [activeShelf, allSelectedTitleIds, initialTitles, queries, searchResults])

  const updateQuery = (shelf: ShelfKey, value: string) => {
    setQueries((prev) => ({ ...prev, [shelf]: value }))
  }

  const addTitle = (shelf: ShelfKey, title: SearchTitleResult) => {
    setSelections((prev) => {
      const alreadySelected = Object.values(prev).some((items) => items.some((item) => item.id === title.id))
      if (alreadySelected) return prev
      return {
        ...prev,
        [shelf]: [...prev[shelf], title],
      }
    })
  }

  const removeTitle = (shelf: ShelfKey, titleId: string) => {
    setSelections((prev) => ({
      ...prev,
      [shelf]: prev[shelf].filter((title) => title.id !== titleId),
    }))
  }

  const handleUsernameContinue = async () => {
    const sanitized = sanitizeUsernameInput(username)
    if (!sanitized) {
      setUsernameFeedback({ status: "error", message: "Username is required" })
      return
    }

    setUsernameSubmitting(true)
    try {
      const result = await completeOnboardingUsername(sanitized)
      if (result.error) {
        setUsernameFeedback({ status: "error", message: result.error })
        toast.error(result.error)
        return
      }

      setUsernameSaved(true)
      setUsername(result.username ?? sanitized)
      setUsernameFeedback({ status: "available", message: "Username saved" })
      setStep(1)
      toast.success("Username saved")
    } catch (error) {
      toast.error("Failed to save username")
    } finally {
      setUsernameSubmitting(false)
    }
  }

  const goNext = () => setStep((current) => Math.min(current + 1, STEPS.length - 1))
  const goBack = () => setStep((current) => Math.max(current - 1, 0))

  const toggleFollow = (profileId: string) => {
    setSelectedFollowIds((prev) =>
      prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId]
    )
  }

  const handleFinish = async () => {
    setFinishing(true)
    try {
      const result = await saveOnboardingSelections({
        finishedTitleIds: selections.finished.map((title) => title.id),
        currentTitleIds: selections.current.map((title) => title.id),
        plannedTitleIds: selections.planned.map((title) => title.id),
        followProfileIds: selectedFollowIds,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Welcome to Bookworm")
      router.push("/")
      router.refresh()
    } catch (error) {
      toast.error("Failed to finish onboarding")
    } finally {
      setFinishing(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">New account</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">Set up your reading world</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Pick your username first. Everything after that is optional, and you can always change your books or follows later.
          </p>
        </div>
        <Badge variant="outline">Step {step + 1} of {STEPS.length}</Badge>
      </div>

      <div className="mb-8 space-y-3">
        <Progress value={progressValue} className="h-2" />
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-5">
          {STEPS.map((label, index) => (
            <div
              key={label}
              className={index === step ? "font-semibold text-foreground" : undefined}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {step === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Choose your username</CardTitle>
            <CardDescription>
              This is the only required onboarding step. We preserve your casing, but availability is checked case-insensitively.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="onboarding-username">
                Username
              </label>
              <Input
                id="onboarding-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your username"
                autoFocus
                maxLength={100}
              />
            </div>
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
              <p
                className={
                  usernameFeedback.status === "error"
                    ? "text-destructive"
                    : usernameFeedback.status === "available"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                }
              >
                {usernameFeedback.status === "checking" ? "Checking availability..." : usernameFeedback.message}
              </p>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              onClick={handleUsernameContinue}
              disabled={usernameSubmitting || usernameFeedback.status === "checking" || usernameFeedback.status === "error"}
            >
              {usernameSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {activeShelf ? (
        <Card>
          <CardHeader>
            <CardTitle>{BOOK_STEP_COPY[activeShelf].title}</CardTitle>
            <CardDescription>{BOOK_STEP_COPY[activeShelf].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor={`search-${activeShelf}`}>
                Search ingested titles
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id={`search-${activeShelf}`}
                  value={queries[activeShelf]}
                  onChange={(event) => updateQuery(activeShelf, event.target.value)}
                  placeholder="Search by title or author"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-foreground">Selected titles</h2>
                <Badge variant="secondary">{selections[activeShelf].length}</Badge>
              </div>
              {selections[activeShelf].length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {selections[activeShelf].map((title) => (
                    <div key={`${activeShelf}-${title.id}`} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="relative h-16 w-12 overflow-hidden rounded bg-muted">
                        <CoverImage src={title.coverImageUrl} alt={title.title} sizes="48px" />
                        {!title.coverImageUrl ? (
                          <div className="flex h-full w-full items-center justify-center">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-foreground">{title.title}</div>
                        <div className="truncate text-sm text-muted-foreground">{title.author}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeTitle(activeShelf, title.id)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {BOOK_STEP_COPY[activeShelf].empty}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-foreground">Suggestions</h2>
                {searchLoading[activeShelf] ? (
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
                      key={`${activeShelf}-result-${title.id}`}
                      type="button"
                      onClick={() => addTitle(activeShelf, title)}
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
                        <div className="line-clamp-2 font-medium text-foreground">{title.title}</div>
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
            <Button variant="outline" onClick={goBack}>Back</Button>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={goNext}>Skip</Button>
              <Button onClick={goNext}>Continue</Button>
            </div>
          </CardFooter>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card>
          <CardHeader>
            <CardTitle>Find readers with overlap</CardTitle>
            <CardDescription>
              Follow people who already share some of the books you picked. This step is optional too.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {allSelectedTitleIds.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Add at least one title in the earlier steps if you want tailored follow suggestions.
              </div>
            ) : null}

            {followLoading ? (
              <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Looking for readers with overlapping books...
              </div>
            ) : null}

            {!followLoading && allSelectedTitleIds.length > 0 && followSuggestions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No reader suggestions yet, but you can always discover people later in the community views.
              </div>
            ) : null}

            {!followLoading && followSuggestions.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {followSuggestions.map((suggestion) => {
                  const selected = selectedFollowIds.includes(suggestion.profileId)
                  return (
                    <button
                      key={suggestion.profileId}
                      type="button"
                      onClick={() => toggleFollow(suggestion.profileId)}
                      className="rounded-lg border p-4 text-left transition hover:border-primary hover:bg-muted/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={suggestion.avatarUrl ?? undefined} alt={suggestion.username} />
                            <AvatarFallback>{getInitials(suggestion.username)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-foreground">{suggestion.username}</div>
                            <div className="text-sm text-muted-foreground">
                              {suggestion.overlapCount} overlapping {suggestion.overlapCount === 1 ? "title" : "titles"}
                            </div>
                          </div>
                        </div>
                        <span
                          className={selected ? "rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground" : "rounded-full border px-3 py-1 text-xs text-muted-foreground"}
                        >
                          {selected ? (
                            <span className="inline-flex items-center gap-1">
                              <Check className="h-3.5 w-3.5" /> Selected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <UserPlus className="h-3.5 w-3.5" /> Follow
                            </span>
                          )}
                        </span>
                      </div>
                      {suggestion.matchedTitles.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {suggestion.matchedTitles.map((title) => (
                            <Badge key={`${suggestion.profileId}-${title}`} variant="secondary">
                              {title}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="justify-between gap-3">
            <Button variant="outline" onClick={goBack} disabled={finishing}>Back</Button>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={handleFinish} disabled={finishing}>
                Finish without more
              </Button>
              <Button onClick={handleFinish} disabled={finishing}>
                {finishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                Finish setup
              </Button>
            </div>
          </CardFooter>
        </Card>
      ) : null}
    </div>
  )
}
