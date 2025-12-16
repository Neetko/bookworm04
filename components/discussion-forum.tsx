"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { getReadStatus } from "@/app/actions/book"
import { Lock } from "lucide-react"

interface DiscussionForumProps {
  bookId: string
}

export function DiscussionForum({ bookId }: DiscussionForumProps) {
  const [canView, setCanView] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const isRead = await getReadStatus(session.access_token, bookId)
          setCanView(isRead)
        }
      } catch (error) {
        console.error("Failed to check access", error)
      } finally {
        setIsLoading(false)
      }
    }
    checkAccess()
  }, [bookId])

  if (isLoading) {
    return <div>Loading discussions...</div>
  }

  if (!canView) {
    return (
      <Card className="mt-8 bg-gray-50 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-gray-200 p-4 rounded-full mb-4">
            <Lock className="h-8 w-8 text-gray-500" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Discussion Locked</h3>
          <p className="text-gray-500 max-w-md">
            You must mark this book as "Read" to view and participate in the discussion forum. This helps prevent spoilers for other readers!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Discussion Forum</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-500 italic">Discussion forum content coming soon...</p>
      </CardContent>
    </Card>
  )
}
