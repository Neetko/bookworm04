"use client"

import { useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, ThumbsUp, Loader2 } from "lucide-react"
import { addClubCurrentReadingComment, getClubCurrentReadingComments, upvoteClubCurrentReadingComment } from "@/app/actions/clubs"

export type ClubCurrentReadingTitle = {
  id: string
  title: string
  author: string
  cover_image_url: string | null
}

export type ClubCurrentReadingComment = {
  id: string
  content: string
  created_at: string
  likes_count: number
  user_profiles: {
    username: string | null
    avatar_url: string | null
  } | null
}

export function ClubCurrentReadingSection({
  clubId,
  title,
  canPost,
  canView,
  initialComments,
}: {
  clubId: string
  title: ClubCurrentReadingTitle | null
  canPost: boolean
  canView: boolean
  initialComments: ClubCurrentReadingComment[]
}) {
  const [comments, setComments] = useState<ClubCurrentReadingComment[]>(initialComments)
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [upvotingId, setUpvotingId] = useState<string | null>(null)

  useEffect(() => {
    setComments(initialComments)
  }, [initialComments])

  const refresh = async () => {
    setIsRefreshing(true)
    try {
      const data = await getClubCurrentReadingComments(clubId)
      const normalized = (data as any[]).map((row) => ({
        ...row,
        user_profiles: Array.isArray(row.user_profiles) ? row.user_profiles[0] ?? null : row.user_profiles,
      })) as ClubCurrentReadingComment[]
      setComments(normalized)
    } finally {
      setIsRefreshing(false)
    }
  }

  const submit = async () => {
    if (!content.trim()) return
    setIsSubmitting(true)
    try {
      await addClubCurrentReadingComment(clubId, content)
      setContent("")
      await refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  const upvote = async (commentId: string) => {
    setUpvotingId(commentId)
    try {
      await upvoteClubCurrentReadingComment(commentId)
      await refresh()
    } finally {
      setUpvotingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Current Reading
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!title ? (
          <p className="text-sm text-muted-foreground">No current reading title selected.</p>
        ) : (
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={title.cover_image_url ?? undefined} />
              <AvatarFallback>{title.title?.[0] ?? "T"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{title.title}</p>
              <p className="text-sm text-muted-foreground">{title.author}</p>
            </div>
          </div>
        )}

        {canView ? (
          <div className="space-y-4">
            {isRefreshing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading comments...
              </div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-4">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={comment.user_profiles?.avatar_url ?? undefined} />
                    <AvatarFallback>
                      {(comment.user_profiles?.username ?? "U").slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {comment.user_profiles?.username ?? "Anonymous"}
                    </div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">{comment.content}</div>
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => upvote(comment.id)}
                      disabled={upvotingId === comment.id}
                    >
                      <ThumbsUp className="h-3 w-3" />
                      {comment.likes_count}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Only members can view the current reading discussion.</p>
        )}

        {canPost ? (
          <div className="space-y-2">
            <Textarea
              placeholder="Write a comment..."
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={3}
            />
            <div className="flex justify-end">
              <Button onClick={submit} disabled={isSubmitting || !content.trim()}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Post
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Join this club to post comments.</p>
        )}
      </CardContent>
    </Card>
  )
}
