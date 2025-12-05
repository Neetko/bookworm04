"use client"

import { useEffect, useState } from "react"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { User, Star, Bookmark, Heart, TrendingUp, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-provider"
import { getProfileData } from "@/app/actions/profile"
import { EditProfileDialog } from "@/components/edit-profile-dialog"
import { supabase } from "@/lib/supabase"

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold">Please sign in to view your profile</h1>
        </div>
      </div>
    )
  }

  if (!profileData) {
     return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold">Profile not found</h1>
        </div>
      </div>
    )
  }

  const { profile, stats } = profileData

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Left Column: Profile Info & Stats */}
          <div className="md:col-span-4 space-y-6">
            <Card>
              <CardContent className="p-6 flex flex-col items-center text-center">
                <Avatar className="h-32 w-32 mb-4">
                  <AvatarImage src={profile.avatarUrl || ""} />
                  <AvatarFallback className="text-4xl">
                    <User className="h-16 w-16" />
                  </AvatarFallback>
                </Avatar>
                
                <h1 className="text-2xl font-bold mb-1">{profile.username || "Anonymous"}</h1>
                <p className="text-gray-500 text-sm mb-4">{profile.email}</p>
                <p className="text-gray-600 mb-6">{profile.bio || "No bio yet."}</p>
                
                <div className="w-full grid grid-cols-2 gap-4 mb-6">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                    <div className="font-bold text-lg">{stats.booksRead}</div>
                    <div className="text-xs text-gray-500">Read</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Star className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
                    <div className="font-bold text-lg">{stats.reviewsWritten}</div>
                    <div className="text-xs text-gray-500">Reviews</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Heart className="h-5 w-5 text-red-500 mx-auto mb-1" />
                    <div className="font-bold text-lg">{stats.favorites}</div>
                    <div className="text-xs text-gray-500">Favorites</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Bookmark className="h-5 w-5 text-green-600 mx-auto mb-1" />
                    <div className="font-bold text-lg">{stats.bookmarks}</div>
                    <div className="text-xs text-gray-500">Bookmarks</div>
                  </div>
                </div>

                <div className="text-sm text-gray-400 mb-6">
                  Joined {new Date(profile.createdAt).toLocaleDateString()}
                </div>

                <EditProfileDialog user={profile} />
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Activities List */}
          <div className="md:col-span-8 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {/* Combine and sort activities */}
                  {[
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
                  ]
                  .sort((a, b) => b.date.getTime() - a.date.getTime())
                  .map((activity, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
                        {i !== (profileData.recentReviews?.length || 0) && (
                          <div className="w-0.5 flex-1 bg-gray-100 my-1" />
                        )}
                      </div>
                      <div className="pb-6">
                        <p className="text-sm text-gray-500 mb-1">
                          {activity.date.toLocaleDateString(undefined, { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                        
                        {activity.type === 'joined' && (
                          <p className="font-medium">Joined Bookworm</p>
                        )}

                        {activity.type === 'review' && (
                          <div>
                            <p className="font-medium">
                              Reviewed <span className="text-blue-600">{activity.data.books?.title || "Unknown Book"}</span>
                            </p>
                            <div className="flex items-center gap-1 my-2">
                              {[...Array(5)].map((_, j) => (
                                <Star
                                  key={j}
                                  className={`h-4 w-4 ${j < activity.data.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                                />
                              ))}
                            </div>
                            {activity.data.review_text && (
                              <p className="text-gray-600 text-sm mt-2 bg-gray-50 p-3 rounded-md">
                                "{activity.data.review_text}"
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
