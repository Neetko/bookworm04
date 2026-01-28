"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle, Circle, Loader2 } from "lucide-react"
import { toggleBookReadStatus, getReadStatus } from "@/app/actions/book"
import { supabase } from "@/lib/supabase-browser"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface MarkReadButtonProps {
  bookId: string
}

export function MarkReadButton({ bookId }: MarkReadButtonProps) {
  const [isRead, setIsRead] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setIsAuthenticated(true)
          const status = await getReadStatus(session.access_token, bookId)
          setIsRead(status)
        }
      } catch (error) {
        console.error("Failed to fetch read status", error)
      } finally {
        setIsLoading(false)
      }
    }
    checkStatus()
  }, [bookId])

  const handleToggle = async () => {
    if (!isAuthenticated) {
      toast.error("You must be logged in to mark books as read")
      return
    }

    setIsLoading(true)
    const newStatus = !isRead
    
    // Optimistic update
    setIsRead(newStatus)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error("No session")
      }

      await toggleBookReadStatus(session.access_token, bookId, newStatus)
      toast.success(newStatus ? "Marked as read" : "Marked as unread")
      router.refresh()
    } catch (error) {
      console.error(error)
      setIsRead(!newStatus) // Revert
      toast.error("Failed to update status")
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
