"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Navigation } from "@/components/navigation"
import { MessageList } from "@/components/messages/message-list"
import { MessageSidebar } from "@/components/messages/message-sidebar"
import { Message, MessageFolder } from "@/lib/messages"

const normalizeFolder = (value: string | null): MessageFolder => {
  if (value === "sent") return "sent"
  if (value === "drafts") return "drafts"
  return "inbox"
}

export default function MessagesPage() {
  const searchParams = useSearchParams()
  const [activeFolder, setActiveFolder] = useState<MessageFolder>(() => normalizeFolder(searchParams?.get("folder") ?? null))
  const [messages, setMessages] = useState<Message[]>([])
  const [counts, setCounts] = useState({ inbox: 0, sent: 0, drafts: 0 })
  const draftId = searchParams?.get("draft") ?? null

  const loadMessages = useCallback(async (folder: MessageFolder) => {
    try {
      const response = await fetch(`/api/messages?folder=${folder}`)
      const data = await response.json()
      const rows = Array.isArray(data?.results) ? data.results : []
      const parsed = rows.map((row: any) => ({
        ...row,
        date: new Date(row.date),
      })) as Message[]
      setMessages(parsed)
      if (data?.counts) {
        setCounts(data.counts)
      }
    } catch {
      setMessages([])
    }
  }, [])

  useEffect(() => {
    setActiveFolder(normalizeFolder(searchParams?.get("folder") ?? null))
  }, [searchParams])

  useEffect(() => {
    loadMessages(activeFolder)
  }, [activeFolder, loadMessages])

  const folderMessages = useMemo(() => {
    const typeMap: Record<MessageFolder, "inbox" | "sent" | "draft"> = {
      inbox: "inbox",
      sent: "sent",
      drafts: "draft",
    }

    return messages
      .filter((message) => message.type === typeMap[activeFolder])
      .sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [messages, activeFolder])

  const handleSendNewMessage = async (payload: { title: string; recipient: string; body: string; draftId?: string | null }) => {
    const response = payload.draftId
      ? await fetch(`/api/messages/${payload.draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: payload.title,
            recipient: payload.recipient,
            body: payload.body,
            status: "sent",
          }),
        })
      : await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: payload.title,
            recipient: payload.recipient,
            body: payload.body,
            status: "sent",
          }),
        })

    if (!response.ok) {
      toast.error("Failed to send message")
      return
    }

    setActiveFolder("sent")
    await loadMessages("sent")
    toast.success("Message sent", {
      description: `Sent to ${payload.recipient}.`,
    })
  }

  const handleSaveDraft = async (payload: { title: string; recipient: string; body: string; draftId?: string | null }) => {
    await (payload.draftId
      ? fetch(`/api/messages/${payload.draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: payload.title,
            recipient: payload.recipient,
            body: payload.body,
            status: "draft",
          }),
        })
      : fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: payload.title,
            recipient: payload.recipient,
            body: payload.body,
            status: "draft",
          }),
        }))

    await loadMessages(activeFolder)
  }

  const handleDeleteMessage = async (messageId: string) => {
    const response = await fetch(`/api/messages/${messageId}`, { method: "DELETE" })
    if (!response.ok) {
      toast.error("Failed to delete message")
      return
    }
    await loadMessages(activeFolder)
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex min-h-[calc(100vh-4rem)] flex-col md:flex-row">
        <MessageSidebar
          activeFolder={activeFolder}
          onFolderChange={setActiveFolder}
          counts={counts}
        />
        <main className="flex-1">
          <MessageList
            messages={folderMessages}
            folder={activeFolder}
            onSendNewMessage={handleSendNewMessage}
            onSaveDraftNewMessage={handleSaveDraft}
            initialDraftId={draftId}
            onDeleteMessage={handleDeleteMessage}
          />
        </main>
      </div>
    </div>
  )
}
