import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Navigation } from "@/components/navigation"
import { BarChart3, Sparkles, Star, Users } from "lucide-react"
import { createAdminClient, createServerClient } from "@/lib/supabase-server"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDistanceToNow } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CoverImage } from "@/components/cover-image"
import { GuestWelcomeMascot } from "@/components/mascot/guest-welcome-mascot"

export default async function HomePage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const getInitials = (name?: string | null) => {
    const normalized = name?.trim() ?? ""
    if (!normalized) return "?"
    const parts = normalized.split(/\s+/).filter(Boolean)
    const initials = parts.length >= 2
      ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`
      : normalized.slice(0, 2)
    return initials.toUpperCase()
  }

  const formatCount = (count: number | null | undefined) => {
    if (typeof count !== "number") return "0"
    return new Intl.NumberFormat("en", { notation: count >= 1000 ? "compact" : "standard" }).format(count)
  }

  if (user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id,onboarding_completed_at")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    if (!profile?.onboarding_completed_at) {
      redirect("/onboarding")
    }

    const profileId = profile?.id as string | undefined
    const [
      followRowsResult,
      booksThisYearResult,
      currentReadingResult,
      reviewsWrittenResult,
    ] = profileId
      ? await Promise.all([
          supabase
            .from("user_follows")
            .select("followed_profile_id")
            .eq("follower_profile_id", profileId),
          supabase
            .from("reading_diary_entries")
            .select("title_id", { count: "exact", head: true })
            .eq("user_profile_id", profileId)
            .eq("is_completed", true)
            .gte("entry_date", `${new Date().getFullYear()}-01-01`),
          supabase
            .from("title_user_progress")
            .select("id", { count: "exact", head: true })
            .eq("user_profile_id", profileId)
            .eq("is_completed", false)
            .gt("progress_percent", 0),
          supabase
            .from("reviews")
            .select("id", { count: "exact", head: true })
            .eq("user_id", profileId),
        ])
      : [
          { data: [] as Array<{ followed_profile_id: string | null }> },
          { count: 0 },
          { count: 0 },
          { count: 0 },
        ]

    const followRows = followRowsResult.data ?? []
    const progressStats = {
      booksThisYear: booksThisYearResult.count ?? 0,
      currentlyReading: currentReadingResult.count ?? 0,
      reviewsWritten: reviewsWrittenResult.count ?? 0,
      following: followRows.length,
    }

    const followedIds = (followRows ?? [])
      .map((row) => row.followed_profile_id)
      .filter(Boolean) as string[]

    const { data: suggestedReaderRows } = profileId
      ? await supabase
          .from("public_profiles")
          .select("id,username,avatar_url")
          .neq("id", profileId)
          .limit(8)
      : { data: [] as Array<{ id: string; username: string | null; avatar_url: string | null }> }

    const suggestedReaders = (suggestedReaderRows ?? [])
      .filter((reader) => reader.id && !followedIds.includes(reader.id))
      .slice(0, 4)

    const { data: activityRows } = followedIds.length > 0
      ? await supabase
          .from("activity_events")
          .select("id,user_profile_id,event_type,metadata,created_at")
          .in("user_profile_id", followedIds)
          .order("created_at", { ascending: false })
          .limit(50)
      : { data: [] as Array<any> }

    const activities = (activityRows ?? []) as Array<{
      id: string
      user_profile_id: string
      event_type: string
      metadata: any
      created_at: string | null
    }>

    const activityProfileIds = Array.from(
      new Set(activities.map((activity) => activity.user_profile_id).filter(Boolean))
    )

    const { data: activityProfiles } = activityProfileIds.length > 0
      ? await supabase
          .from("public_profiles")
          .select("id,username,avatar_url")
          .in("id", activityProfileIds)
      : { data: [] as Array<{ id: string; username: string | null; avatar_url: string | null }> }

    const activityProfileMap = new Map(
      (activityProfiles ?? []).map((profile) => [profile.id, profile])
    )

    const renderActivityText = (activity: (typeof activities)[number]) => {
      const titleName = activity.metadata?.title?.title ?? "a title"
      const titleId = activity.metadata?.title?.id ?? null
      const listName = activity.metadata?.list?.name ?? "a list"
      const clubName = activity.metadata?.club?.name ?? "a club"
      const achievementName = activity.metadata?.achievement?.name ?? "an achievement"
      const rating = activity.metadata?.rating

      const titleNode = titleId ? (
        <Link href={`/titles/${titleId}`} className="font-medium text-foreground hover:underline">
          {titleName}
        </Link>
      ) : (
        <span className="font-medium text-foreground">{titleName}</span>
      )

      switch (activity.event_type) {
        case "review_posted":
          return (
            <>
              reviewed {titleNode}
              {rating ? ` — ${rating}/10` : ""}.
            </>
          )
        case "title_finished":
          return <>finished reading {titleNode}.</>
        case "list_created":
          return `created the list “${listName}”.`
        case "list_item_added":
          if (listName === "Current Reading") {
            return <>started reading {titleNode}.</>
          }
          return (
            <>
              added {titleNode} to <span>“{listName}”</span>.
            </>
          )
        case "club_created":
          return `created the club “${clubName}”.`
        case "club_joined":
          return `joined “${clubName}”.`
        case "achievement_earned":
          return `earned ${achievementName}.`
        default:
          return `did something new.`
      }
    }
    return (
      <div className="min-h-screen bg-background">
        <Navigation />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Welcome back</h1>
                <p className="mt-1 text-muted-foreground">See what your fellow readers have been up to.</p>
              </div>

              <Tabs defaultValue="feed" className="w-full">
                <TabsList className="mb-6 w-full justify-start bg-transparent p-0">
                  <TabsTrigger
                    value="feed"
                    className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Sparkles className="mr-1.5 size-4" />
                    Following
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="feed" className="mt-0">
                  {activities.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
                      Your feed is empty for now.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activities.map((activity) => {
                        const profile = activityProfileMap.get(activity.user_profile_id)
                        const actorName = profile?.username ?? activity.metadata?.actor?.username ?? "Someone"
                        const actorLink = profile?.id ? `/users/${profile.id}` : null
                        const avatarUrl = profile?.avatar_url ?? activity.metadata?.actor?.avatar_url ?? null
                        const titleName = activity.metadata?.title?.title ?? "a title"
                        const titleId = activity.metadata?.title?.id ?? null
                        const coverUrl = activity.metadata?.title?.cover ?? null
                        const clubName = activity.metadata?.club?.name ?? "a club"
                        const clubAvatarUrl = activity.metadata?.club?.avatar_url ?? null
                        const isClubEvent = activity.event_type === "club_created" || activity.event_type === "club_joined"
                        const isAchievementEvent = activity.event_type === "achievement_earned"
                        const isListCreatedEvent = activity.event_type === "list_created"
                        const shouldShowCover = !isClubEvent && !isAchievementEvent && !isListCreatedEvent
                        return (
                          <div
                            key={activity.id}
                            className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
                          >
                            <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={avatarUrl || undefined} />
                                <AvatarFallback>{getInitials(actorName)}</AvatarFallback>
                              </Avatar>

                              <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-none">
                                  {actorLink ? (
                                    <Link href={actorLink} className="font-medium text-foreground hover:underline">
                                      {actorName}
                                    </Link>
                                  ) : (
                                    <span className="font-medium text-foreground">{actorName}</span>
                                  )}
                                  <span className="font-ui text-[11px] text-muted-foreground">
                                    {activity.created_at
                                      ? formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })
                                      : ""}
                                  </span>
                                </div>

                                <div className="font-ui text-sm leading-6 text-foreground">
                                  {renderActivityText(activity)}
                                </div>

                                {activity.metadata?.reviewText ? (
                                  <div className="font-ui rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm leading-6 text-muted-foreground">
                                    “{activity.metadata.reviewText}”
                                  </div>
                                ) : null}
                              </div>

                              <div className="flex-shrink-0">
                                {isClubEvent ? (
                                  <Avatar className="h-12 w-12">
                                    <AvatarImage src={clubAvatarUrl || undefined} />
                                    <AvatarFallback>{getInitials(clubName)}</AvatarFallback>
                                  </Avatar>
                                ) : isAchievementEvent ? (
                                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-border bg-muted text-[10px] font-medium text-muted-foreground">
                                    Badge
                                  </div>
                                ) : shouldShowCover ? (
                                  <Link
                                    href={titleId ? `/titles/${titleId}` : "#"}
                                    className={titleId ? "block" : "pointer-events-none"}
                                    aria-label={titleId ? `Open ${titleName}` : undefined}
                                  >
                                    <div className="relative h-28 w-20 overflow-hidden rounded-md bg-muted">
                                      <CoverImage src={coverUrl} alt={titleName} className="object-cover" />
                                    </div>
                                  </Link>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </TabsContent>

              </Tabs>
            </div>

            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-6">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                    <Users className="size-4 text-primary" />
                    Readers to follow
                  </h2>
                  {suggestedReaders.length > 0 ? (
                    <div className="space-y-3">
                      {suggestedReaders.map((reader) => {
                        const readerName = reader.username ?? "Reader"
                        return (
                          <Link
                            key={reader.id}
                            href={`/users/${reader.id}`}
                            className="flex items-center gap-3 rounded-lg border border-border/70 p-3 transition-colors hover:bg-muted/60"
                          >
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={reader.avatar_url ?? undefined} />
                              <AvatarFallback>{getInitials(readerName)}</AvatarFallback>
                            </Avatar>
                            <span className="min-w-0 truncate text-sm font-medium text-foreground">{readerName}</span>
                          </Link>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
                      Follow more readers to tune your community feed.
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="mb-4 font-semibold text-foreground">Your progress</h2>
                  <div className="font-ui grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="font-sans text-2xl font-bold text-primary">{formatCount(progressStats.booksThisYear)}</div>
                      <div className="text-xs text-muted-foreground">Books this year</div>
                    </div>
                    <div className="text-center">
                      <div className="font-sans text-2xl font-bold text-primary">{formatCount(progressStats.currentlyReading)}</div>
                      <div className="text-xs text-muted-foreground">Currently reading</div>
                    </div>
                    <div className="text-center">
                      <div className="font-sans text-2xl font-bold text-primary">{formatCount(progressStats.reviewsWritten)}</div>
                      <div className="text-xs text-muted-foreground">Reviews written</div>
                    </div>
                    <div className="text-center">
                      <div className="font-sans text-2xl font-bold text-primary">{formatCount(progressStats.following)}</div>
                      <div className="text-xs text-muted-foreground">Following</div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    )
  }

  const aggregateClient = createAdminClient()
  const [
    { count: trackedTitleCount },
    { count: reviewCount },
    { count: clubCount },
  ] = await Promise.all([
    aggregateClient.from("title_user_progress").select("id", { count: "exact", head: true }),
    supabase.from("reviews").select("id", { count: "exact", head: true }),
    supabase.from("clubs").select("id", { count: "exact", head: true }),
  ])

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:gap-16">
          <div className="text-center lg:text-left">
            <p className="font-ui mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Your next chapter starts here
            </p>
            <h1 className="text-balance text-4xl font-bold leading-[0.98] tracking-[-0.035em] text-foreground sm:text-5xl lg:text-6xl">
              Keep your reading life in one place.
            </h1>
            <p className="font-ui mx-auto mt-6 max-w-[58ch] text-base leading-7 text-muted-foreground sm:text-lg lg:mx-0">
              Discover your next read, track your progress, trade recommendations, and join book clubs and writers’
              groups - or create your own!
            </p>

            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
              <Button size="lg" asChild className="text-lg px-8 py-3">
                <Link href="/search-titles">Explore titles</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="text-lg px-8 py-3">
                <Link href="/auth">Create an account</Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto flex min-h-[350px] w-full max-w-md items-end justify-center sm:min-h-[410px]">
            <GuestWelcomeMascot />
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="text-center p-6 bg-card rounded-lg shadow-md border">
            <BarChart3 className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-card-foreground">Track reading progress</h3>
            <p className="font-ui text-muted-foreground">
              Log reading sessions, follow your progress, and keep a useful record of every title.
            </p>
          </div>

          <div className="text-center p-6 bg-card rounded-lg shadow-md border">
            <Star className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-card-foreground">Rate & Review</h3>
            <p className="font-ui text-muted-foreground">Share your thoughts and help other readers find their perfect books.</p>
          </div>

          <div className="text-center p-6 bg-card rounded-lg shadow-md border">
            <Users className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-card-foreground">Community</h3>
            <p className="font-ui text-muted-foreground">Connect with fellow book lovers and discover recommendations.</p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="font-ui grid md:grid-cols-3 gap-8 mt-16 text-center">
          <div>
            <div className="text-3xl font-bold text-primary">{formatCount(trackedTitleCount)}</div>
            <div className="text-muted-foreground">Titles Tracked</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary">{formatCount(reviewCount)}</div>
            <div className="text-muted-foreground">Reviews Written</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary">{formatCount(clubCount)}</div>
            <div className="text-muted-foreground">Clubs Created</div>
          </div>
        </div>
      </div>
    </div>
  )
}
