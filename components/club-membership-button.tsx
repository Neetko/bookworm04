"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { joinClub, leaveClub } from "@/app/actions/clubs"
import { useRouter } from "next/navigation"

export function ClubMembershipButton({
  clubId,
  initialIsMember,
}: {
  clubId: string
  initialIsMember: boolean
}) {
  const [isMember, setIsMember] = useState(initialIsMember)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const onToggle = async () => {
    setIsLoading(true)
    try {
      if (isMember) {
        await leaveClub(clubId)
        setIsMember(false)
        toast.success("Left club")
      } else {
        await joinClub(clubId)
        setIsMember(true)
        toast.success("Joined club")
      }
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Failed to update membership")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button onClick={onToggle} disabled={isLoading} variant={isMember ? "outline" : "default"}>
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {isMember ? "Leave" : "Join"}
    </Button>
  )
}
