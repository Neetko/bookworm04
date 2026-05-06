"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Bookmark, Loader2 } from "lucide-react"
import { getTitleBookmarkStatus, toggleTitleBookmark } from "@/app/actions/title"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface TitleBookmarkButtonProps {
  titleId: string
}

export function TitleBookmarkButton({ titleId }: TitleBookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const status = await getTitleBookmarkStatus(titleId)
        setIsBookmarked(status)
      } catch (error) {
        console.error("Failed to load bookmark status", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadStatus()
  }, [titleId])

  const handleToggle = async () => {
    if (isLoading) return
    const nextValue = !isBookmarked
    setIsBookmarked(nextValue)
    setIsLoading(true)

    try {
      const result = await toggleTitleBookmark(titleId)
      setIsBookmarked(result.bookmarked)
      toast.success(result.bookmarked ? "Title bookmarked" : "Bookmark removed")
      router.refresh()
     } catch (error) {
       console.error(error)
      setIsBookmarked(!nextValue)
       toast.error((error as any)?.message ?? "Failed to update bookmark")
     } finally {
       setIsLoading(false)
     }
   }

   return (
     <Button
       variant={isBookmarked ? "default" : "outline"}
       size="sm"
       onClick={handleToggle}
       disabled={isLoading}
       className="gap-1.5"
     >
       {isLoading ? (
         <Loader2 className="h-4 w-4 animate-spin" />
       ) : (
         <Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`} />
       )}
       {isBookmarked ? "Bookmarked" : "Bookmark"}
     </Button>
   )
}
