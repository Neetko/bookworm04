"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2, MessageSquarePlus } from "lucide-react"
import { useRouter } from "next/navigation"

interface DiscussionFormProps {
  bookId: string
}

export function DiscussionForm({ bookId }: DiscussionFormProps) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a discussion title")
      return
    }

    if (!content.trim()) {
      toast.error("Please enter discussion content")
      return
    }

    setIsSubmitting(true)
    try {
      // TODO: Implement createDiscussion server action
      // await createDiscussion(bookId, title, content)
      toast.success("Discussion created successfully")
      setTitle("")
      setContent("")
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error("Failed to create discussion")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquarePlus className="h-5 w-5" />
          Start a Discussion
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Discussion Title</label>
          <Input
            placeholder="What would you like to discuss?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Your Thoughts</label>
          <Textarea
            placeholder="Share your thoughts, theories, or questions about this book..."
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Post Discussion
        </Button>
      </CardContent>
    </Card>
  )
}
