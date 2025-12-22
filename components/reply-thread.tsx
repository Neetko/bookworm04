"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { User, Reply, Loader2, ThumbsUp } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface ReplyData {
  id: string
  content: string
  created_at: string
  parent_id: string | null
  user_profiles: {
    username: string | null
    avatar_url: string | null
  } | null
}

interface ReplyThreadProps {
  discussionId: string
  replies: ReplyData[]
}

export function ReplyThread({ discussionId, replies }: ReplyThreadProps) {
  const [replyContent, setReplyContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmitReply = async (parentId: string | null = null) => {
    if (!replyContent.trim()) {
      toast.error("Please enter a reply")
      return
    }

    setIsSubmitting(true)
    try {
      // TODO: Implement createReply server action
      // await createReply(discussionId, replyContent, parentId)
      toast.success("Reply posted successfully")
      setReplyContent("")
      setReplyingTo(null)
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error("Failed to post reply")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Organize replies by parent
  const topLevelReplies = replies.filter((r) => !r.parent_id)
  const nestedReplies = replies.filter((r) => r.parent_id)

  const getRepliesForParent = (parentId: string) => {
    return nestedReplies.filter((r) => r.parent_id === parentId)
  }

  const ReplyItem = ({ reply, level = 0 }: { reply: ReplyData; level?: number }) => {
    const childReplies = getRepliesForParent(reply.id)
    const isReplyingToThis = replyingTo === reply.id

    return (
      <div className={`${level > 0 ? "ml-12 mt-4" : ""}`}>
        <div className="flex items-start gap-3">
          <Avatar className="flex-shrink-0 h-8 w-8">
            <AvatarImage src={reply.user_profiles?.avatar_url || undefined} />
            <AvatarFallback>
              <User className="h-3 w-3" />
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm">
                {reply.user_profiles?.username || "Anonymous"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
              </span>
            </div>

            <p className="text-sm text-foreground mb-2 whitespace-pre-wrap">{reply.content}</p>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setReplyingTo(isReplyingToThis ? null : reply.id)}
              >
                <Reply className="h-3 w-3" />
                Reply
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ThumbsUp className="h-3 w-3" />
                Like
              </Button>
            </div>

            {isReplyingToThis && (
              <div className="mt-3 space-y-2">
                <Textarea
                  placeholder={`Reply to ${reply.user_profiles?.username || "Anonymous"}...`}
                  rows={3}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSubmitReply(reply.id)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    Post Reply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReplyingTo(null)
                      setReplyContent("")
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nested replies */}
        {childReplies.length > 0 && (
          <div className="mt-4 space-y-4">
            {childReplies.map((childReply) => (
              <ReplyItem key={childReply.id} reply={childReply} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Main reply form */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <Textarea
              placeholder="Add your reply to this discussion..."
              rows={3}
              value={replyingTo === null ? replyContent : ""}
              onChange={(e) => setReplyContent(e.target.value)}
            />
            <Button
              onClick={() => handleSubmitReply(null)}
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Post Reply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Replies list */}
      {topLevelReplies.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground text-sm">
              No replies yet. Be the first to reply!
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 space-y-6">
            {topLevelReplies.map((reply) => (
              <ReplyItem key={reply.id} reply={reply} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
