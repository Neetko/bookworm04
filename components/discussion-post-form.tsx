"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2, Send } from "lucide-react"
import { useRouter } from "next/navigation"
import { createDiscussionPost } from "@/app/actions/title"

interface DiscussionPostFormProps {
  titleId: string
}

export function DiscussionPostForm({ titleId }: DiscussionPostFormProps) {
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error("Please enter your message")
      return
    }

    setIsSubmitting(true)
    try {
      await createDiscussionPost(titleId, content)
      toast.success("Post published successfully")
      setContent("")
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error("Failed to publish post")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Share Your Thoughts</h3>
          <Textarea
            placeholder="What are your thoughts on this book? Share your insights, favorite moments, or questions..."
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="resize-none"
          />
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              {content.length} characters
            </p>
            <Button onClick={handleSubmit} disabled={isSubmitting || !content.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Post
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
