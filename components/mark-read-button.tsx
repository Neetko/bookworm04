"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle, Circle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { setTitleReadStatus } from "@/app/actions/title"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface MarkReadButtonProps {
  titleId: string
  initialIsRead: boolean
  isSignedIn: boolean
}

export function MarkReadButton({ titleId, initialIsRead, isSignedIn }: MarkReadButtonProps) {
  const [isRead, setIsRead] = useState(initialIsRead)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setIsRead(initialIsRead)
  }, [initialIsRead])

  const handleToggle = async () => {
    setIsLoading(true)
    const newStatus = !isRead
    
    // Optimistic update
    setIsRead(newStatus)

    try {
      await setTitleReadStatus(titleId, newStatus)
      toast.success(newStatus ? "Marked as read" : "Marked as unread")
      router.refresh()
    } catch (error) {
      console.error(error)
      setIsRead(!newStatus) // Revert
      toast.error((error as any)?.message ?? "Failed to update status")
    } finally {
      setIsLoading(false)
    }
  }

  if (!isSignedIn) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5" asChild>
        <Link href="/auth">
          <Circle className="h-4 w-4" />
          Sign in to mark as read
        </Link>
      </Button>
    )
  }

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </Button>
    )
  }

  return (
    <Button
      variant={isRead ? "default" : "outline"}
      size="sm"
      onClick={handleToggle}
      disabled={isLoading}
      className={cn("gap-1.5", isRead ? "bg-green-600 hover:bg-green-700" : "")}
    >
      {isRead ? (
        <>
          <CheckCircle className="h-4 w-4" />
          Read
        </>
      ) : (
        <>
          <Circle className="h-4 w-4" />
          Mark as Read
        </>
      )}
    </Button>
  )
}
