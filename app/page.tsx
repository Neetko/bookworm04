import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Navigation } from "@/components/navigation"
import { BookOpen, Sparkles, Star, TrendingUp, Users } from "lucide-react"
import { createServerClient } from "@/lib/supabase-server"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDistanceToNow } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CoverImage } from "@/components/cover-image"

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
    const { data: followRows } = profileId
      ? await supabase
          .from("user_follows")
          .select("followed_profile_id")
          .eq("follower_profile_id", profileId)
      : { data: [] as Array<{ followed_profile_id: string | null }> }

    const followedIds = (followRows ?? [])
      .map((row) => row.followed_profile_id)
      .filter(Boolean) as string[]

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
          return (
            <>
              added {titleNode} to “{listName}”.
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
                  <TabsTrigger
                    value="news"
                    className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <TrendingUp className="mr-1.5 size-4" />
                    Trending
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
                          <div key={activity.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage src={avatarUrl || undefined} />
                                    <AvatarFallback>{getInitials(actorName)}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-wrap items-center gap-2 text-sm">
                                    {actorLink ? (
                                      <Link href={actorLink} className="font-medium text-foreground hover:underline">
                                        {actorName}
                                      </Link>
                                    ) : (
                                      <span className="font-medium text-foreground">{actorName}</span>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      {activity.created_at
                                        ? formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })
                                        : ""}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-sm text-foreground">
                                  {renderActivityText(activity)}
                                </div>
                                {activity.metadata?.reviewText ? (
                                  <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
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

                <TabsContent value="news" className="mt-0">
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
                    <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
                      <TrendingUp className="size-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground">Trending coming soon</h3>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      Discover what&apos;s popular across the community.
                    </p>
                  </div>
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
                  <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
                    Suggestions are coming soon.
                  </div>
                  <Button variant="ghost" className="mt-4 w-full" asChild>
                    <Link href="/discover/people">Explore readers</Link>
                  </Button>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="mb-4 font-semibold text-foreground">Your progress</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">—</div>
                      <div className="text-xs text-muted-foreground">Books this year</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">—</div>
                      <div className="text-xs text-muted-foreground">Currently reading</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">—</div>
                      <div className="text-xs text-muted-foreground">Reviews written</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">—</div>
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

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-foreground mb-6">Welcome! Ready to start reading?</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Discover your next favorite book, share reviews with fellow readers, and build your personal library of
            literary adventures.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button size="lg" asChild className="text-lg px-8 py-3">
              <Link href="/library">Browse Library</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-lg px-8 py-3">
              <Link href="/auth">Join Now</Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="text-center p-6 bg-card rounded-lg shadow-md border">
            <BookOpen className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-card-foreground">Vast Library</h3>
            <p className="text-muted-foreground">
              Explore thousands of books across all genres and discover your next great read.
            </p>
          </div>

          <div className="text-center p-6 bg-card rounded-lg shadow-md border">
            <Star className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-card-foreground">Rate & Review</h3>
            <p className="text-muted-foreground">Share your thoughts and help other readers find their perfect books.</p>
          </div>

          <div className="text-center p-6 bg-card rounded-lg shadow-md border">
            <Users className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-card-foreground">Community</h3>
            <p className="text-muted-foreground">Connect with fellow book lovers and discover recommendations.</p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid md:grid-cols-3 gap-8 mt-16 text-center">
          <div>
            <div className="text-3xl font-bold text-primary">10K+</div>
            <div className="text-muted-foreground">Books Available</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary">5K+</div>
            <div className="text-muted-foreground">Active Readers</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary">25K+</div>
            <div className="text-muted-foreground">Reviews Written</div>
          </div>
        </div>
      </div>
    </div>
  )
}
