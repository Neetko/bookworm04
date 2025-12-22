"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { getReadStatus } from "@/app/actions/book"
import { Lock } from "lucide-react"
import { DiscussionPost } from "./discussion-post"
import { DiscussionPostForm } from "./discussion-post-form"

interface DiscussionForumProps {
  bookId: string
}

export function DiscussionForum({ bookId }: DiscussionForumProps) {
  const [canView, setCanView] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Mock posts for demonstration - will be replaced with actual server data
  const mockPosts = [
    {
      id: "1",
      content: "I just finished this book and I'm absolutely blown away! The character development was phenomenal, especially the protagonist's journey from self-doubt to confidence. What did everyone else think?",
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      user_profiles: {
        username: "BookLover23",
        avatar_url: null,
        role: "Book Club Leader",
        joined_date: new Date(2023, 0, 15).toISOString(),
        signature: "📚 Currently reading 5 books at once!",
        signature_image: null,
      },
    },
    {
      id: "2",
      content: "That twist in chapter 15 though! 🤯 I had to put the book down and just process what happened. Looking back, there were so many clues I completely missed on my first read.",
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      user_profiles: {
        username: "MysteryFan",
        avatar_url: null,
        role: "Regular Reader",
        joined_date: new Date(2024, 5, 10).toISOString(),
        signature: "Always trust the quiet ones 🕵️",
        signature_image: null,
      },
    },
    {
      id: "3",
      content: "Can we talk about the ending? I know it's divisive but I actually loved it. It felt true to the story and the characters. The ambiguity leaves room for interpretation which I appreciate in literature.",
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      user_profiles: {
        username: "LiteraryAnalyst",
        avatar_url: null,
        role: "Book Critic",
        joined_date: new Date(2022, 8, 3).toISOString(),
        signature: "\"The best books are those that make you think\" - Me",
        signature_image: null,
      },
    },
  ]

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
    return <div>Loading discussion...</div>
  }

  if (!canView) {
    return (
      <Card className="mt-8 bg-muted/50 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-muted p-4 rounded-full mb-4">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Discussion Locked</h3>
          <p className="text-muted-foreground max-w-md">
            You must mark this book as "Read" to view and participate in the discussion forum. This helps prevent spoilers for other readers!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Post Form */}
      <DiscussionPostForm bookId={bookId} />

      {/* Posts List */}
      <div className="space-y-6">
        {mockPosts.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-medium mb-2">No posts yet</p>
                <p className="text-sm">Be the first to share your thoughts about this book!</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          mockPosts.map((post) => <DiscussionPost key={post.id} post={post} />)
        )}
      </div>
    </div>
  )
}
