"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BookOpen, MessageCircle, Star, Award, Calendar, TrendingUp, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Navigation } from "@/components/navigation"
import { useAuth } from "@/lib/auth-provider"
import { getProfileData } from "@/app/actions/profile"
import { EditProfileDialog } from "@/components/edit-profile-dialog"
import { supabase } from "@/lib/supabase-browser"
import { formatDistanceToNow } from "date-fns"
import { GENRES, GENRE_BG_CLASS } from "@/lib/types"

const badgesList = [
  { id: 1, name: "Early Bird", description: "Joined in first month", icon: "🌅", condition: (stats: any) => true },
  { id: 2, name: "Bookworm", description: "Read 10 books", icon: "📚", condition: (stats: any) => stats.booksRead >= 10 },
  { id: 3, name: "Critic", description: "Written 20 reviews", icon: "✍️", condition: (stats: any) => stats.reviewsWritten >= 20 },
  {
    id: 4,
    name: "Genre Explorer",
    description: "Read 5 different genres",
    icon: "🗺️",
    condition: (stats: any) => {
      const points = stats?.genrePoints ?? {}
      return GENRES.filter((genre) => (points[genre] ?? 0) > 0).length >= 5
    },
  },
  { id: 5, name: "Night Owl", description: "Active after midnight", icon: "🦉", condition: (stats: any) => false },
  { id: 6, name: "Speed Reader", description: "Finish 5 books in a month", icon: "⚡", condition: (stats: any) => false },
  { id: 7, name: "Community Star", description: "50 helpful reviews", icon: "⭐", condition: (stats: any) => false },
  { id: 8, name: "Century Club", description: "Read 100 books", icon: "💯", condition: (stats: any) => stats.booksRead >= 100 },
]

type ProfilePageContentProps = {
  profileData: any
}

export default function ProfilePage() {
  const { user: authUser, loading: authLoading } = useAuth()
  const [profileData, setProfileData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  const reloadProfile = async (token: string) => {
    try {
      const data = await getProfileData(token)
      setProfileData(data)
    } catch (error) {
      console.error("Failed to load profile", error)
    }
  }

  useEffect(() => {
    async function loadProfile() {
      if (!authUser) return
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        setSessionToken(session.access_token)
        await reloadProfile(session.access_token)
      }
      setLoading(false)
    }

    if (!authLoading) {
      if (authUser) {
        loadProfile()
      } else {
        setLoading(false)
      }
    }
  }, [authUser, authLoading])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold">Please sign in to view your profile</h1>
        </div>
      </div>
    )
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold">Profile not found</h1>
        </div>
      </div>
    )
  }

  return <ProfilePageContent profileData={profileData} />
}

function ProfilePageContent({ profileData }: ProfilePageContentProps) {
  const [activeList, setActiveList] = useState<string>("to-read")

  const { profile, stats, pointsByGenre } = profileData
  const finishedReadingTitles = profileData.finishedReadingTitles || []
  const toReadTitles = profileData.toReadTitles || []
  const currentReadingTitles = profileData.currentReadingTitles || []
  const customLists = profileData.customLists || []

  const earnedBadges = badgesList.map((badge) => ({
    ...badge,
    earned: badge.condition(stats),
  }))

  const activities = (profileData.recentActivity || []).map((activity: any) => ({
    ...activity,
    date: activity.created_at ? new Date(activity.created_at) : new Date(),
  }))

  const renderActivityText = (activity: any) => {
    const actorName = activity.metadata?.actor?.username ?? profile.username ?? "Someone"
    const titleName = activity.metadata?.title?.title ?? "a title"
    const listName = activity.metadata?.list?.name ?? "a list"
    const clubName = activity.metadata?.club?.name ?? "a club"
    const achievementName = activity.metadata?.achievement?.name ?? "an achievement"
    const rating = activity.metadata?.rating

    switch (activity.event_type) {
      case "review_posted":
        return `${actorName} reviewed ${titleName}${rating ? ` (${rating}/10)` : ""}.`
      case "title_finished":
        return `${actorName} finished reading ${titleName}.`
      case "list_created":
        return `${actorName} created the list “${listName}”.`
      case "list_item_added":
        if (listName === "Current Reading") {
          return `${actorName} started reading ${titleName}.`
        }
        return `${actorName} added ${titleName} to “${listName}”.`
      case "club_created":
        return `${actorName} created the club “${clubName}”.`
      case "club_joined":
        return `${actorName} joined “${clubName}”.`
      case "achievement_earned":
        return `${actorName} earned ${achievementName}.`
      default:
        return `${actorName} did something new.`
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <div className="container px-4 py-8 max-w-5xl mx-auto">
        <Card className="mb-8 border-2">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6">
              <Avatar className="h-28 w-28 border-4 border-primary/20">
                <AvatarImage src={profile.avatarUrl || "/placeholder.svg"} alt={profile.username} />
                <AvatarFallback className="text-2xl">{profile.username?.[0]?.toUpperCase() || "U"}</AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="font-sans text-3xl font-bold tracking-tight mb-1">{profile.username || "Anonymous"}</h1>
                    <p className="text-muted-foreground">{profile.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" asChild>
                      <Link href="#title-lists">Title lists</Link>
                    </Button>
                    <EditProfileDialog user={profile} />
                  </div>
                </div>

                <p className="text-sm leading-relaxed max-w-2xl">{profile.bio || "No bio yet."}</p>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Member since {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                </div>

                <div className="pt-2">
                  <div className="grid grid-cols-7 gap-3 text-center">
                    {GENRES.map((genre) => (
                      <div key={genre} className="flex flex-col items-center gap-2">
                        <span className={`h-3 w-3 rounded-full ${GENRE_BG_CLASS[genre]}`} />
                        <span className="text-xs font-medium text-muted-foreground">
                          {pointsByGenre?.[genre] ?? 0}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <Card className="border-2">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold">{stats.booksRead}</p>
                <p className="text-sm text-muted-foreground">Books Read</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold">{stats.reviewsWritten}</p>
                <p className="text-sm text-muted-foreground">Reviews</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold">{earnedBadges.filter((b) => b.earned).length}</p>
                <p className="text-sm text-muted-foreground">Badges</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="border-2" id="title-lists">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Title Lists
              </CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/profile/edit-lists">Edit lists</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-3">
                <Button
                  variant={activeList === "to-read" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveList("to-read")}
                >
                  Planned Reading
                </Button>
                <Button
                  variant={activeList === "current-reading" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveList("current-reading")}
                >
                  Current Reading
                </Button>
                <Button
                  variant={activeList === "finished" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveList("finished")}
                >
                  Finished Reading
                </Button>
                {customLists.map((list: any) => (
                  <Button
                    key={list.id}
                    variant={activeList === list.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveList(list.id)}
                  >
                    {list.name}
                  </Button>
                ))}
              </div>

              {activeList === "finished" ? (
                finishedReadingTitles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">You haven’t finished any titles yet.</p>
                ) : (
                  <div className="max-h-80 space-y-3 overflow-y-auto pr-2">
                    {finishedReadingTitles.map((entry: any) => (
                      <div key={entry.title_id} className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={entry.titles?.cover_image_url || undefined} />
                          <AvatarFallback>{entry.titles?.title?.[0] ?? "T"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/titles/${entry.titles?.id ?? entry.title_id}`}
                            className="font-medium truncate hover:underline"
                          >
                            {entry.titles?.title ?? "Untitled"}
                          </Link>
                          <p className="text-sm text-muted-foreground truncate">{entry.titles?.author ?? "Unknown author"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : activeList === "to-read" ? (
                <div className="space-y-3">
                  {toReadTitles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Your Planned Reading list is empty.</p>
                  ) : (
                    <div className="max-h-80 space-y-3 overflow-y-auto pr-2">
                      {toReadTitles.map((entry: any) => (
                        <div key={entry.title_id} className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={entry.titles?.cover_image_url || undefined} />
                            <AvatarFallback>{entry.titles?.title?.[0] ?? "T"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/titles/${entry.titles?.id ?? entry.title_id}`}
                              className="font-medium truncate hover:underline"
                            >
                              {entry.titles?.title ?? "Untitled"}
                            </Link>
                            <p className="text-sm text-muted-foreground truncate">{entry.titles?.author ?? "Unknown author"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : activeList === "current-reading" ? (
                <div className="space-y-3">
                  {currentReadingTitles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">You have no titles in Current Reading.</p>
                  ) : (
                    <div className="max-h-80 space-y-3 overflow-y-auto pr-2">
                      {currentReadingTitles.map((entry: any) => (
                        <div key={entry.title_id} className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={entry.titles?.cover_image_url || undefined} />
                            <AvatarFallback>{entry.titles?.title?.[0] ?? "T"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/titles/${entry.titles?.id ?? entry.title_id}`}
                              className="font-medium truncate hover:underline"
                            >
                              {entry.titles?.title ?? "Untitled"}
                            </Link>
                            <p className="text-sm text-muted-foreground truncate">{entry.titles?.author ?? "Unknown author"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                (() => {
                  const list = customLists.find((item: any) => item.id === activeList)
                  if (!list) return <p className="text-sm text-muted-foreground">Select a list.</p>
                  const items = list.items ?? []
                  return (
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground">Likes: {list.likesCount ?? 0}</div>
                      {items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">This list is empty.</p>
                      ) : (
                        <div className="max-h-80 space-y-3 overflow-y-auto pr-2">
                          {items.map((entry: any) => (
                            <div key={entry.title_id} className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={entry.titles?.cover_image_url || undefined} />
                                <AvatarFallback>{entry.titles?.title?.[0] ?? "T"}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <Link
                                  href={`/titles/${entry.titles?.id ?? entry.title_id}`}
                                  className="font-medium truncate hover:underline"
                                >
                                  {entry.titles?.title ?? "Untitled"}
                                </Link>
                                <p className="text-sm text-muted-foreground truncate">{entry.titles?.author ?? "Unknown author"}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()
              )}
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Achievement Badges
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {earnedBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`p-4 rounded-lg border-2 transition-all ${badge.earned ? "border-primary/50 bg-primary/5" : "border-muted bg-muted/30 opacity-50"}`}
                  >
                    <div className="text-3xl mb-2">{badge.icon}</div>
                    <p className="font-semibold text-sm mb-1">{badge.name}</p>
                    <p className="text-xs text-muted-foreground">{badge.description}</p>
                    {badge.earned && (
                      <Badge variant="secondary" className="mt-2 text-xs">
                        Earned
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity yet.</p>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity: any, index: number) => (
                    <div key={activity.id ?? index}>
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Star className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{renderActivityText(activity)}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(activity.date, { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      {index < activities.length - 1 && <Separator className="mt-4" />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

    </main>
  )
}
