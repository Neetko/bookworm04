import { Navigation } from "@/components/navigation"
import { createServerClient } from "@/lib/supabase-server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BookOpen } from "lucide-react"

async function getUserProfile(username: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, username, avatar_url, bio")
    .eq("username", username)
    .maybeSingle()

  if (error) {
    console.error("Failed to load user profile", error)
    return null
  }

  return data
}

async function getReadTitles(userProfileId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("title_reads")
    .select("title_id, created_at, titles ( id, title, author, cover_image_url )")
    .eq("user_profile_id", userProfileId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to load read titles", error)
    return []
  }

  return data ?? []
}

export default async function UserReadListPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const profile = await getUserProfile(username)

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-5xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-lg font-medium">User not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const readTitles = await getReadTitles(profile.id)

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Card className="border-2">
          <CardContent className="pt-6 flex items-center gap-4">
            <Avatar className="h-16 w-16 border">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback>{profile.username?.[0]?.toUpperCase() ?? "U"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-2xl font-bold">{profile.username ?? "Anonymous"}</p>
              {profile.bio ? <p className="text-sm text-muted-foreground">{profile.bio}</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Read Titles
            </CardTitle>
          </CardHeader>
          <CardContent>
            {readTitles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No titles marked as read yet.</p>
            ) : (
              <div className="space-y-4">
                {readTitles.map((entry: any) => (
                  <div key={entry.title_id} className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={entry.titles?.cover_image_url || undefined} />
                      <AvatarFallback>{entry.titles?.title?.[0] ?? "T"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{entry.titles?.title ?? "Untitled"}</p>
                      <p className="text-sm text-muted-foreground truncate">{entry.titles?.author ?? "Unknown author"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
