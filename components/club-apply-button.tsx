"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { acceptClubInvitation, applyToClub, declineClubInvitation } from "@/app/actions/clubs"
import { useRouter } from "next/navigation"

export function ClubApplyButton({
  clubId,
  pending = false,
  invitationId = null,
}: {
  clubId: string
  pending?: boolean
  invitationId?: string | null
}) {
  const [isLoading, setIsLoading] = useState<"apply" | "accept" | "decline" | null>(null)
  const [hasPendingApplication, setHasPendingApplication] = useState(pending)
  const router = useRouter()

  useEffect(() => {
    setHasPendingApplication(pending)
  }, [pending])

  const onApply = async () => {
    setIsLoading("apply")
    try {
      await applyToClub(clubId)
      setHasPendingApplication(true)
      toast.success("Application submitted")
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error("Failed to apply")
    } finally {
      setIsLoading(null)
    }
  }

  const onAcceptInvite = async () => {
    if (!invitationId) return
    setIsLoading("accept")
    try {
      await acceptClubInvitation(invitationId)
      toast.success("Invitation accepted")
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error("Failed to accept invitation")
    } finally {
      setIsLoading(null)
    }
  }

  const onDeclineInvite = async () => {
    if (!invitationId) return
    setIsLoading("decline")
    try {
      await declineClubInvitation(invitationId)
      toast.success("Invitation declined")
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error("Failed to decline invitation")
    } finally {
      setIsLoading(null)
    }
  }

  if (invitationId) {
    return (
      <div className="flex items-center gap-2">
        <Button onClick={onAcceptInvite} disabled={isLoading !== null}>
          {isLoading === "accept" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Accept invite
        </Button>
        <Button onClick={onDeclineInvite} disabled={isLoading !== null} variant="outline">
          {isLoading === "decline" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Decline
        </Button>
      </div>
    )
  }

  return (
    <Button
      onClick={onApply}
      disabled={hasPendingApplication || isLoading !== null}
      variant={hasPendingApplication ? "outline" : "default"}
    >
      {isLoading === "apply" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {hasPendingApplication ? "Application pending" : "Apply"}
    </Button>
  )
}
