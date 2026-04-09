"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { User, Calendar, ThumbsUp, Flag, MoreHorizontal } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import { sanitizeRichTextHtml } from "@/lib/sanitize"
import Image from "next/image"
import { toggleDiscussionPostLike } from "@/app/actions/title"
import { toast } from "sonner"
import { useState } from "react"

interface PostData {
  id: string
  content: string
  created_at: string
  likes_count?: number
  viewer_has_liked?: boolean
  user_profiles: {
    username: string | null
    avatar_url: string | null
    role?: string | null
    joined_date?: string | null
    signature?: string | null
    signature_image?: string | null
  } | null
}

interface DiscussionPostProps {
  post: PostData
}

export function DiscussionPost({ post }: DiscussionPostProps) {
  const userProfile = post.user_profiles
  const [isLiked, setIsLiked] = useState(Boolean(post.viewer_has_liked))
  const [likesCount, setLikesCount] = useState(post.likes_count ?? 0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const joinedDate = userProfile?.joined_date 
    ? format(new Date(userProfile.joined_date), "MMM yyyy")
    : "Unknown"

  const handleLike = async () => {
    if (isSubmitting) return
    const nextLiked = !isLiked
    const nextCount = Math.max(0, likesCount + (nextLiked ? 1 : -1))

    setIsSubmitting(true)
    setIsLiked(nextLiked)
    setLikesCount(nextCount)

    try {
      await toggleDiscussionPostLike(post.id)
    } catch (error) {
      console.error(error)
      setIsLiked(!nextLiked)
      setLikesCount(likesCount)
      toast.error((error as any)?.message ?? "Failed to update like")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          {/* Left Sidebar - User Info */}
          <div className="w-full md:w-64 bg-muted/30 p-6 border-r flex flex-col items-center text-center">
            <Avatar className="h-24 w-24 mb-4 border-4 border-background shadow-lg">
              <AvatarImage src={userProfile?.avatar_url || undefined} />
              <AvatarFallback className="text-2xl">
                <User className="h-12 w-12" />
              </AvatarFallback>
            </Avatar>
            
            <h4 className="font-bold text-lg mb-1">
              {userProfile?.username || "Anonymous"}
            </h4>
            
            {userProfile?.role && (
              <Badge variant="secondary" className="mb-3 text-xs">
                {userProfile.role}
              </Badge>
            )}
            
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
              <Calendar className="h-3 w-3" />
              <span>Joined {joinedDate}</span>
            </div>

            <Separator className="w-full mb-4" />
            
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Posts:</span>
                <span className="font-semibold">42</span>
              </div>
              <div className="flex justify-between">
                <span>Books Read:</span>
                <span className="font-semibold">127</span>
              </div>
              <div className="flex justify-between">
                <span>Likes Given:</span>
                <span className="font-semibold">856</span>
              </div>
            </div>
          </div>

          {/* Right Side - Post Content */}
          <div className="flex-1 p-6 relative pb-12">
            {/* Post Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Posted {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </span>
              </div>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>

            {/* Post Content */}
            <div className="prose prose-sm max-w-none mb-6">
              <div
                className="text-foreground leading-relaxed [&_p]:mb-3 last:[&_p]:mb-0"
                dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(post.content) }}
              />
            </div>

            {/* User Signature */}
            {(userProfile?.signature || userProfile?.signature_image) && (
              <>
                <Separator className="my-4" />
                <div className="text-xs text-muted-foreground italic">
                  {userProfile.signature && (
                    <p className="mb-2">{userProfile.signature}</p>
                  )}
                  {userProfile.signature_image && (
                    <Image
                      src={userProfile.signature_image}
                      alt="User signature"
                      width={320}
                      height={80}
                      className="max-h-20 w-auto rounded"
                      unoptimized
                    />
                  )}
                </div>
              </>
            )}

            {/* Post Actions */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute bottom-2 left-2 gap-1 h-8 px-2"
              onClick={handleLike}
              disabled={isSubmitting}
            >
              <ThumbsUp className={`h-3 w-3 ${isLiked ? "text-primary" : ""}`} />
              <span className="text-xs">({likesCount})</span>
            </Button>
            <Button variant="ghost" size="sm" className="absolute bottom-2 right-2 gap-1 h-8 px-2">
              <Flag className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
