"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface BookContentTabsProps {
  reviewsContent: React.ReactNode
  discussionContent: React.ReactNode
}

export function BookContentTabs({ reviewsContent, discussionContent }: BookContentTabsProps) {
  return (
    <Tabs defaultValue="reviews" className="w-full mt-8">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="reviews">Reviews</TabsTrigger>
        <TabsTrigger value="discussion">Discussion</TabsTrigger>
      </TabsList>
      <TabsContent value="reviews" className="mt-6 space-y-8">
        {reviewsContent}
      </TabsContent>
      <TabsContent value="discussion" className="mt-6">
        {discussionContent}
      </TabsContent>
    </Tabs>
  )
}
