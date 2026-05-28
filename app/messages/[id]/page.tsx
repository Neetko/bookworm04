"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Navigation } from "@/components/navigation"
import { MessageDetail } from "@/components/messages/message-detail"
import { MessageSidebar } from "@/components/messages/message-sidebar"
import { Message, MessageFolder } from "@/lib/messages"

const normalizeFolder = (value: string | null): MessageFolder => {
  if (value === "sent") return "sent"
  if (value === "drafts") return "drafts"
  return "inbox"
}

export default function MessageDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [message, setMessage] = useState<Message | null>(null)
  const [counts, setCounts] = useState({ inbox: 0, sent: 0, drafts: 0 })

  const messageId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params?.id[0] : ""

  useEffect(() => {
    const loadMessage = async () => {
      const response = await fetch(`/api/messages/${messageId}`)
      const data = await response.json()
      if (data?.message) {
        setMessage({
          ...data.message,
          date: new Date(data.message.date),
        })
      }
      if (data?.counts) {
        setCounts(data.counts)
      }
    }

    if (messageId) {
      loadMessage()
    }
  }, [messageId])

  const activeFolder = useMemo<MessageFolder>(() => {
    const fromQuery = normalizeFolder(searchParams?.get("folder") ?? null)
    if (fromQuery) return fromQuery
    if (message?.type === "sent") return "sent"
    if (message?.type === "draft") return "drafts"
    return "inbox"
  }, [searchParams, message])

  useEffect(() => {
    if (!message) return
    if (message.type === "inbox" && !message.read) {
      fetch(`/api/messages/${message.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      }).catch(() => undefined)
      setCounts((prev) => ({
        ...prev,
        inbox: Math.max(0, prev.inbox - 1),
      }))
    }
  }, [message])

  if (!message) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="font-ui mx-auto max-w-3xl px-6 py-12 text-center text-muted-foreground">
          Message not found.
        </div>
      </div>
    )
  }

  if (message.type === "draft") {
    router.replace(`/messages?folder=drafts&draft=${message.id}`)
    return null
  }

  const handleSend = async (content: string) => {
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: message.subject.startsWith("RE:") ? message.subject : `RE: ${message.subject}`,
        recipient: message.from.name,
        body: content,
        status: "sent",
        replyTo: message.id,
      }),
    })

    if (!response.ok) {
      toast.error("Failed to send reply")
      return
    }

    toast.success("Message sent", {
      description: `Your reply to ${message.from.name} has been sent.`,
    })
    router.push("/messages?folder=sent")
  }

  const handleSaveDraft = async (content: string) => {
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: message.subject.startsWith("RE:") ? message.subject : `RE: ${message.subject}`,
        recipient: message.from.name,
        body: content,
        status: "draft",
        replyTo: message.id,
      }),
    })

    toast.success("Draft saved", {
      description: "Your message has been saved to drafts.",
    })
    router.push("/messages?folder=drafts")
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="font-ui flex min-h-[calc(100vh-4rem)] flex-col md:flex-row">
        <MessageSidebar
          activeFolder={activeFolder}
          onFolderChange={(folder) => router.push(`/messages?folder=${folder}`)}
          counts={counts}
        />
        <main className="flex-1">
          <MessageDetail
            message={message}
            folder={activeFolder}
            onSend={handleSend}
            onSaveDraft={handleSaveDraft}
          />
        </main>
      </div>
    </div>
  )
}
