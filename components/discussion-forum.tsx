"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Lock } from "lucide-react"
import { DiscussionPost } from "./discussion-post"
import { DiscussionPostForm } from "./discussion-post-form"
import { getDiscussionPosts, getTitleReadStatus, type DiscussionPostRow } from "@/app/actions/title"

interface DiscussionForumProps {
  titleId: string
}

export function DiscussionForum({ titleId }: DiscussionForumProps) {
  const [canView, setCanView] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [posts, setPosts] = useState<DiscussionPostRow[]>([])

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const isRead = await getTitleReadStatus(titleId)
        setCanView(isRead)

        if (isRead) {
          const loaded = await getDiscussionPosts(titleId)
          setPosts(loaded)
        }
      } catch (error) {
        console.error("Failed to check access", error)
      } finally {
        setIsLoading(false)
      }
    }
    checkAccess()
  }, [titleId])

  if (isLoading) {
    return <div>Loading discussion...</div>
  }

  if (!canView) {
    return (
      <Card className="mt-8 bg-muted/50 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-muted p-4 rounded-full mb-4">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Discussion Locked</h3>
          <p className="text-muted-foreground max-w-md">
            You must mark this book as "Read" to view and participate in the discussion forum. This helps prevent spoilers for other readers!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Post Form */}
      <DiscussionPostForm titleId={titleId} />

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
          posts.map((post) => <DiscussionPost key={post.id} post={post as any} />)
        )}
      </div>
    </div>
  )
}
