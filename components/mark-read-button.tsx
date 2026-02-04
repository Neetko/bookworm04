"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle, Circle, Loader2 } from "lucide-react"
import { getTitleReadStatus, setTitleReadStatus } from "@/app/actions/title"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface MarkReadButtonProps {
  titleId: string
}

export function MarkReadButton({ titleId }: MarkReadButtonProps) {
  const [isRead, setIsRead] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await getTitleReadStatus(titleId)
        setIsRead(status)
      } catch (error) {
        console.error("Failed to fetch read status", error)
      } finally {
        setIsLoading(false)
      }
    }
    checkStatus()
  }, [titleId])

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

  if (isLoading) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </Button>
    )
  }

  return (
    <Button 
      variant={isRead ? "default" : "outline"} 
      onClick={handleToggle}
      disabled={isLoading}
      className={isRead ? "bg-green-600 hover:bg-green-700" : ""}
    >
      {isRead ? (
        <>
          <CheckCircle className="h-4 w-4 mr-2" />
          Read
        </>
      ) : (
        <>
          <Circle className="h-4 w-4 mr-2" />
          Mark as Read
        </>
      )}
    </Button>
  )
}
