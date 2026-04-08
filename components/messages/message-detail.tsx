"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft, Reply, Save } from "lucide-react"
import { Message, MessageFolder } from "@/lib/messages"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RichTextEditor } from "@/components/rich-text-editor"

const folderLabels: Record<MessageFolder, string> = {
  inbox: "Inbox",
  sent: "Sent Messages",
  drafts: "Drafts",
}

type MessageDetailProps = {
  message: Message
  folder: MessageFolder
  onSend: (content: string) => void
  onSaveDraft: (content: string) => void
}

export function MessageDetail({ message, folder, onSend, onSaveDraft }: MessageDetailProps) {
  const [value, setValue] = useState("")
  const [plainText, setPlainText] = useState("")

  const counterpart = folder === "sent" ? message.to : message.from
  const label = folder === "sent" || folder === "drafts" ? "To" : "From"

  const isReplyDisabled = plainText.trim().length === 0

  const initials = useMemo(() => {
    const parts = counterpart.name.split(" ")
    return parts.map((part) => part[0]).join("").slice(0, 2).toUpperCase()
  }, [counterpart.name])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/messages?folder=${folder}`}>
              <ArrowLeft className="h-4 w-4" />
              <span className="ml-2">Back to {folderLabels[folder]}</span>
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <Card className="border-2 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12 border">
                <AvatarImage src={counterpart.avatarUrl ?? undefined} />
                <AvatarFallback>{initials || "U"}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold">{counterpart.name}</p>
                <p className="text-xs text-muted-foreground">{counterpart.email}</p>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>{format(message.date, "PPPp")}</p>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Subject</p>
            <h1 className="mt-2 text-2xl font-semibold">{message.subject}</h1>
          </div>

          <div
            className="prose prose-sm mt-6 max-w-none text-foreground"
            dangerouslySetInnerHTML={{ __html: message.body }}
          />
        </Card>

        <Card className="mt-6 border-2 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Reply</p>
              <h2 className="text-lg font-semibold">Write a response</h2>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSaveDraft(value)}
                disabled={isReplyDisabled}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
              <Button
                size="sm"
                onClick={() => onSend(value)}
                disabled={isReplyDisabled}
              >
                <Reply className="mr-2 h-4 w-4" />
                Send Reply
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <RichTextEditor
              value={value}
              onChange={(html, text) => {
                setValue(html)
                setPlainText(text)
              }}
              placeholder="Write your reply..."
            />
          </div>
        </Card>
      </div>
    </div>
  )
}
