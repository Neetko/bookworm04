import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { User, Star, Bookmark, Heart, TrendingUp } from "lucide-react"

export default function ProfilePage() {
  // Mock user data - replace with actual user data from Kinde
  const user = {
    username: "bookworm_reader",
    email: "reader@example.com",
    avatar: null,
    bio: "Passionate reader who loves discovering new worlds through books.",
    joinDate: "March 2024",
    stats: {
      booksRead: 47,
      reviewsWritten: 23,
      favorites: 12,
      bookmarks: 8,
    },
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user.avatar || ""} />
                <AvatarFallback className="text-2xl">
                  <User className="h-12 w-12" />
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">{user.username}</h1>
                <p className="text-gray-600 mb-4">{user.bio}</p>
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <span>Joined {user.joinDate}</span>
                  <span>•</span>
                  <span>{user.email}</span>
                </div>
              </div>

              <Button variant="outline">Edit Profile</Button>
            </div>
          </CardContent>
        </Card>

        {/* Activity Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold">{user.stats.booksRead}</div>
              <div className="text-sm text-gray-600">Books Read</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <Star className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">{user.stats.reviewsWritten}</div>
              <div className="text-sm text-gray-600">Reviews</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <Heart className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">{user.stats.favorites}</div>
              <div className="text-sm text-gray-600">Favorites</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <Bookmark className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold">{user.stats.bookmarks}</div>
              <div className="text-sm text-gray-600">Bookmarks</div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Tabs */}
        <Tabs defaultValue="reviews" className="space-y-4">
          <TabsList>
            <TabsTrigger value="reviews">My Reviews</TabsTrigger>
            <TabsTrigger value="favorites">My Favorites</TabsTrigger>
            <TabsTrigger value="bookmarks">My Bookmarks</TabsTrigger>
          </TabsList>

          <TabsContent value="reviews" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border-b pb-4 last:border-b-0">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold">The Great Gatsby</h4>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, j) => (
                            <Star
                              key={j}
                              className={`h-4 w-4 ${j < 4 ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm mb-2">
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
                        labore et dolore magna aliqua.
                      </p>
                      <span className="text-xs text-gray-500">2 days ago</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="favorites">
            <Card>
              <CardHeader>
                <CardTitle>Favorite Books</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Your favorite books will appear here.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bookmarks">
            <Card>
              <CardHeader>
                <CardTitle>Bookmarked Books</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Your bookmarked books will appear here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
