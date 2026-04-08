import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { createServerClient } from "@/lib/supabase-server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BookOpen, TrendingUp } from "lucide-react"
import { GENRES, GENRE_BG_CLASS, type Genre } from "@/lib/types"
import { summarizeGenrePoints } from "@/app/actions/rewards"
import { FollowButton } from "@/components/follow-button"

async function getUserProfile(profileId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, username, avatar_url, bio, auth_user_id")
    .eq("id", profileId)
    .maybeSingle()

  if (error) {
    console.error("Failed to load user profile", error)
    return null
  }

  return data
}

async function getViewerProfileId() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (error || !data?.id) return null
  return data.id as string
}

async function getReadTitles(userProfileId: string) {
  const supabase = await createServerClient()
  const { data: finishedList, error: listError } = await supabase
    .from("title_lists")
    .select("id")
    .eq("user_profile_id", userProfileId)
    .eq("list_type", "finished-reading")
    .maybeSingle()

  if (listError) {
    console.error("Failed to load finished reading list", listError)
    return []
  }

  if (!finishedList?.id) return []

  const { data, error } = await supabase
    .from("title_list_items")
    .select("title_id, created_at, titles ( id, title, author, cover_image_url )")
    .eq("list_id", finishedList.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to load read titles", error)
    return []
  }

  return data ?? []
}

async function getGenrePoints(userProfileId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("user_genre_points")
    .select("genre, points")
    .eq("user_profile_id", userProfileId)

  if (error) {
    console.error("Failed to load user points", error)
    return GENRES.reduce<Record<Genre, number>>((acc, genre) => {
      acc[genre] = 0
      return acc
    }, {} as Record<Genre, number>)
  }

  const totals = await summarizeGenrePoints((data ?? []) as Array<{ genre: string | null; points: number | null }>)
  return GENRES.reduce<Record<Genre, number>>((acc, genre) => {
    acc[genre] = totals.get(genre) ?? 0
    return acc
  }, {} as Record<Genre, number>)
}

export default async function UserReadListPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username: profileId } = await params
  const profile = await getUserProfile(profileId)

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
  const pointsByGenre = await getGenrePoints(profile.id)
  const viewerProfileId = await getViewerProfileId()
  const isSelf = viewerProfileId ? viewerProfileId === profile.id : false
  let followState: { isFollowing: boolean; isFriend: boolean } = { isFollowing: false, isFriend: false }

  if (viewerProfileId && !isSelf) {
    const supabase = await createServerClient()
    const { data } = await supabase
      .from("user_follows")
      .select("id,is_friend")
      .eq("follower_profile_id", viewerProfileId)
      .eq("followed_profile_id", profile.id)
      .maybeSingle()

    followState = {
      isFollowing: Boolean(data?.id),
      isFriend: Boolean(data?.is_friend),
    }
  }

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
            {!isSelf && viewerProfileId ? (
              <div className="ml-auto">
                <FollowButton
                  targetProfileId={profile.id}
                  initialIsFollowing={followState.isFollowing}
                  initialIsFriend={followState.isFriend}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Points by Genre
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
