"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { followUser, unfollowUser } from "@/app/actions/follow"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

type FollowButtonProps = {
  targetProfileId: string
  initialIsFollowing: boolean
  initialIsFriend: boolean
}

export function FollowButton({
  targetProfileId,
  initialIsFollowing,
  initialIsFriend,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [isFriend, setIsFriend] = useState(initialIsFriend)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleClick = async () => {
    if (loading) return
    setLoading(true)

    try {
      if (isFollowing) {
        await unfollowUser(targetProfileId)
        setIsFollowing(false)
        setIsFriend(false)
        toast.success("Unfollowed")
      } else {
        await followUser(targetProfileId)
        setIsFollowing(true)
        toast.success("Following")
      }

      router.refresh()
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to update follow")
    } finally {
      setLoading(false)
    }
  }

  const label = isFriend ? "Friends" : isFollowing ? "Following" : "Follow"

  return (
    <Button variant={isFollowing ? "outline" : "default"} onClick={handleClick} disabled={loading}>
      {label}
    </Button>
  )
}
