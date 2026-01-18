"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { applyToClub } from "@/app/actions/clubs"
import { useRouter } from "next/navigation"

export function ClubApplyButton({ clubId }: { clubId: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const onApply = async () => {
    setIsLoading(true)
    try {
      await applyToClub(clubId)
      toast.success("Application submitted")
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error("Failed to apply")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button onClick={onApply} disabled={isLoading}>
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Apply
    </Button>
  )
}
