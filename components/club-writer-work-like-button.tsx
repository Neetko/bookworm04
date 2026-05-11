"use client"

import { useState } from "react"
import { ThumbsUp } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { toggleClubWriterWorkLike } from "@/app/actions/club-writer-works"

type ClubWriterWorkLikeButtonProps = {
  workId: string
  initialCount: number
  initialLiked: boolean
  disabled?: boolean
}

export function ClubWriterWorkLikeButton({
  workId,
  initialCount,
  initialLiked,
  disabled = false,
}: ClubWriterWorkLikeButtonProps) {
  const [isLiked, setIsLiked] = useState(initialLiked)
  const [likesCount, setLikesCount] = useState(initialCount)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleToggle = async () => {
    if (disabled || isSubmitting) return

    const nextLiked = !isLiked
    const nextCount = Math.max(0, likesCount + (nextLiked ? 1 : -1))

    setIsSubmitting(true)
    setIsLiked(nextLiked)
    setLikesCount(nextCount)

    try {
      await toggleClubWriterWorkLike(workId)
    } catch (error) {
      console.error(error)
      setIsLiked(!nextLiked)
      setLikesCount(likesCount)
      toast.error(error instanceof Error ? error.message : "Failed to update like")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-2 text-muted-foreground hover:text-foreground"
      onClick={handleToggle}
      disabled={disabled || isSubmitting}
    >
      <ThumbsUp className={`h-4 w-4 ${isLiked ? "text-primary" : ""}`} />
      <span>{likesCount}</span>
    </Button>
  )
}
