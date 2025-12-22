"use client"

import { useEffect, useState } from "react"
import { BookOpen, MessageCircle, Star, Award, Calendar, TrendingUp, Loader2, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Navigation } from "@/components/navigation"
import { useAuth } from "@/lib/auth-provider"
import { getProfileData } from "@/app/actions/profile"
import { EditProfileDialog } from "@/components/edit-profile-dialog"
import { supabase } from "@/lib/supabase"
import { formatDistanceToNow } from "date-fns"

// Mock badges for now, could be calculated from stats
const badgesList = [
  { id: 1, name: "Early Bird", description: "Joined in first month", icon: "🌅", condition: (stats: any) => true }, // Simplified
  { id: 2, name: "Bookworm", description: "Read 10 books", icon: "📚", condition: (stats: any) => stats.booksRead >= 10 },
  { id: 3, name: "Critic", description: "Written 20 reviews", icon: "✍️", condition: (stats: any) => stats.reviewsWritten >= 20 },
  { id: 4, name: "Genre Explorer", description: "Read 5 different genres", icon: "🗺️", condition: (stats: any) => false }, // Need genre data
  { id: 5, name: "Night Owl", description: "Active after midnight", icon: "🦉", condition: (stats: any) => false },
  { id: 6, name: "Speed Reader", description: "Finish 5 books in a month", icon: "⚡", condition: (stats: any) => false },
  { id: 7, name: "Community Star", description: "50 helpful reviews", icon: "⭐", condition: (stats: any) => false },
  { id: 8, name: "Century Club", description: "Read 100 books", icon: "💯", condition: (stats: any) => stats.booksRead >= 100 },
]

export default function ProfilePage() {
  const { user: authUser, loading: authLoading } = useAuth()
  const [profileData, setProfileData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      if (!authUser) return
      
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        try {
          const data = await getProfileData(session.access_token)
          setProfileData(data)
        } catch (error) {
          console.error("Failed to load profile", error)
        }
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

  const { profile, stats } = profileData

  // Calculate badges
  const earnedBadges = badgesList.map(badge => ({
    ...badge,
    earned: badge.condition(stats)
  }))

  // Prepare activities
  const activities = [
    {
      type: 'joined',
      date: new Date(profile.createdAt),
      data: null
    },
    ...(profileData.recentReviews || []).map((r: any) => ({
      type: 'review',
      date: new Date(r.created_at),
      data: r
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <div className="container px-4 py-8 max-w-5xl mx-auto">
        {/* Profile Header */}
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
                  <EditProfileDialog user={profile} />
                </div>

                <p className="text-sm leading-relaxed max-w-2xl">{profile.bio || "No bio yet."}</p>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
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
                <p className="text-3xl font-bold">{earnedBadges.filter(b => b.earned).length}</p>
                <p className="text-sm text-muted-foreground">Badges</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Badges Section */}
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
                    className={`p-4 rounded-lg border-2 transition-all ${
                      badge.earned ? "border-primary/50 bg-primary/5" : "border-muted bg-muted/30 opacity-50"
                    }`}
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

          {/* Recent Activity */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activities.map((activity, index) => (
                  <div key={index}>
                    <div className="flex items-start gap-3">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          activity.type === "review"
                            ? "bg-primary/10"
                            : "bg-secondary/10"
                        }`}
                      >
                        {activity.type === "review" && <Star className="h-4 w-4 text-primary" />}
                        {activity.type === "joined" && <User className="h-4 w-4 text-secondary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          {activity.type === 'joined' && (
                            <span className="font-medium">Joined Bookworm</span>
                          )}
                          {activity.type === 'review' && (
                            <>
                              <span className="font-medium">{activity.data.books?.title || "Unknown Book"}</span>{" "}
                              <span className="text-muted-foreground">rated {activity.data.rating}/10</span>
                            </>
                          )}
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
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
