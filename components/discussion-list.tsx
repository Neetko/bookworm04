"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { User, MessageCircle, ThumbsUp } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useState } from "react"

interface DiscussionPost {
  id: string
  title: string
  content: string
  created_at: string
  user_profiles: {
    username: string | null
    avatar_url: string | null
  } | null
  _count?: {
    replies: number
  }
}

interface DiscussionListProps {
  discussions: DiscussionPost[]
  onSelectDiscussion?: (discussionId: string) => void
}

export function DiscussionList({ discussions, onSelectDiscussion }: DiscussionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (discussions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No discussions yet</p>
            <p className="text-sm">Be the first to start a discussion about this book!</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {discussions.map((discussion) => {
        const isExpanded = expandedId === discussion.id
        const contentPreview = discussion.content.slice(0, 200)
        const needsTruncation = discussion.content.length > 200

        return (
          <Card key={discussion.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Avatar className="flex-shrink-0">
                  <AvatarImage src={discussion.user_profiles?.avatar_url || undefined} />
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold">
                      {discussion.user_profiles?.username || "Anonymous"}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(discussion.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold mb-2 text-foreground">
                    {discussion.title}
                  </h3>

                  {/* Content */}
                  <div className="text-foreground mb-3 whitespace-pre-wrap">
                    {isExpanded || !needsTruncation
                      ? discussion.content
                      : `${contentPreview}...`}
                  </div>

                  {needsTruncation && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : discussion.id)}
                      className="mb-3 -ml-2"
                    >
                      {isExpanded ? "Show less" : "Read more"}
                    </Button>
                  )}

                  {/* Footer Actions */}
                  <div className="flex items-center gap-4 text-sm">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-muted-foreground hover:text-foreground"
                      onClick={() => onSelectDiscussion?.(discussion.id)}
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>
                        {discussion._count?.replies || 0} {discussion._count?.replies === 1 ? "reply" : "replies"}
                      </span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-muted-foreground hover:text-foreground"
                    >
                      <ThumbsUp className="h-4 w-4" />
                      <span>Like</span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
