"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Lock } from "lucide-react"
import { DiscussionPost } from "./discussion-post"
import { DiscussionPostForm } from "./discussion-post-form"
import { getDiscussionPosts, type DiscussionPostRow } from "@/app/actions/title"

interface DiscussionForumProps {
  titleId: string
  canWrite: boolean
  isSignedIn: boolean
}

export function DiscussionForum({ titleId, canWrite, isSignedIn }: DiscussionForumProps) {
  const [isLoading, setIsLoading] = useState(true)

  const [posts, setPosts] = useState<DiscussionPostRow[]>([])

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const loaded = await getDiscussionPosts(titleId)
        setPosts(loaded)
      } catch (error) {
        console.error("Failed to load discussion", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadPosts()
  }, [titleId])

  if (isLoading) {
    return <div>Loading discussion...</div>
  }

  return (
    <div className="space-y-6">
      {canWrite ? (
        <DiscussionPostForm titleId={titleId} />
      ) : (
        <Card className="border-dashed bg-muted/40">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="rounded-full bg-muted p-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Read-only discussion</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {isSignedIn
                  ? "Mark this title as read to post. You can still browse every discussion below."
                  : "Sign in and mark this title as read to post. You can still browse every discussion below."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Posts List */}
      <div className="space-y-6">
        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-medium mb-2">No posts yet</p>
                <p className="text-sm">Be the first to share your thoughts about this book!</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <DiscussionPost key={post.id} post={post as any} canLike={canWrite} />
          ))
        )}
      </div>
    </div>
  )
}
