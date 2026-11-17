"use client"

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { Message, MessageFolder } from "@/lib/messages"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RichTextEditor } from "@/components/rich-text-editor"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { messagePreviewText, sanitizeMessageBody } from "@/lib/message-content"
import { Trash } from "lucide-react"

const PAGE_SIZE = 10

const folderLabels: Record<MessageFolder, string> = {
  inbox: "Inbox",
  sent: "Sent Messages",
  drafts: "Drafts",
}

type MessageListProps = {
  messages: Message[]
  folder: MessageFolder
  onSendNewMessage?: (payload: { title: string; recipient: string; body: string; draftId?: string | null }) => void
  onSaveDraftNewMessage?: (payload: { title: string; recipient: string; body: string; draftId?: string | null }) => void
  initialDraftId?: string | null
  onDeleteMessage?: (messageId: string) => void | Promise<void>
}

export function MessageList({ messages, folder, onSendNewMessage, onSaveDraftNewMessage, initialDraftId, onDeleteMessage }: MessageListProps) {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [composeOpen, setComposeOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [recipient, setRecipient] = useState("")
  const [bodyHtml, setBodyHtml] = useState("")
  const [bodyText, setBodyText] = useState("")
  const [draftId, setDraftId] = useState<string | null>(null)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<Array<{ id: string; username: string | null; avatar_url: string | null; isFriend: boolean }>>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const suggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasSentRef = useRef(false)

  useEffect(() => {
    setPage(1)
  }, [folder, messages])

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return messages.slice(start, start + PAGE_SIZE)
  }, [messages, page])

  const totalPages = Math.max(1, Math.ceil(messages.length / PAGE_SIZE))

  const canSend = title.trim().length > 0 && recipient.trim().length > 0 && bodyText.trim().length > 0
  const hasDraftContent = title.trim().length > 0 || recipient.trim().length > 0 || bodyText.trim().length > 0

  useEffect(() => {
    if (!initialDraftId || folder !== "drafts") return
    const draft = messages.find((message) => message.id === initialDraftId)
    if (!draft) return
    openDraft(draft)
  }, [initialDraftId, folder, messages])

  useEffect(() => {
    if (!composeOpen) return
    if (!suggestionsOpen) return

    if (suggestionTimer.current) {
      clearTimeout(suggestionTimer.current)
    }

    suggestionTimer.current = setTimeout(async () => {
      setLoadingSuggestions(true)
      try {
        const response = await fetch(`/api/messages/recipients?q=${encodeURIComponent(recipient)}`)
        const data = await response.json()
        setSuggestions(Array.isArray(data?.results) ? data.results.slice(0, 3) : [])
      } catch {
        setSuggestions([])
      } finally {
        setLoadingSuggestions(false)
      }
    }, 200)

    return () => {
      if (suggestionTimer.current) {
        clearTimeout(suggestionTimer.current)
      }
    }
  }, [recipient, suggestionsOpen, composeOpen])

  const handleSend = () => {
    if (!onSendNewMessage || !canSend) return
    wasSentRef.current = true
    onSendNewMessage({ title: title.trim(), recipient: recipient.trim(), body: bodyHtml, draftId })
    setTitle("")
    setRecipient("")
    setBodyHtml("")
    setBodyText("")
    setDraftId(null)
    setComposeOpen(false)
  }

  const handleDialogChange = (open: boolean) => {
    if (open) {
      wasSentRef.current = false
      setComposeOpen(true)
      return
    }

    const shouldSaveDraft = hasDraftContent
    if (!wasSentRef.current && shouldSaveDraft && onSaveDraftNewMessage) {
      onSaveDraftNewMessage({ title: title.trim(), recipient: recipient.trim(), body: bodyHtml, draftId })
    }

    setComposeOpen(false)
    setSuggestionsOpen(false)
    setSuggestions([])
    setTitle("")
    setRecipient("")
    setBodyHtml("")
    setBodyText("")
    setDraftId(null)
  }

  const openDraft = (message: Message) => {
    setDraftId(message.id)
    setTitle(message.subject ?? "")
    setRecipient(message.to?.name ?? "")
    setBodyHtml(sanitizeMessageBody(message.body ?? ""))
    setBodyText(messagePreviewText(message.body ?? ""))
    setComposeOpen(true)
  }

  const handleDelete = async (messageId: string) => {
    if (!onDeleteMessage) return
    await onDeleteMessage(messageId)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-background px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{folderLabels[folder]}</h1>
            <p className="text-sm text-muted-foreground">
              {messages.length} {messages.length === 1 ? "message" : "messages"}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setDraftId(null)
              setTitle("")
              setRecipient("")
              setBodyHtml("")
              setBodyText("")
              setComposeOpen(true)
            }}
          >
            New Message
          </Button>
        </div>
      </div>
      <Dialog open={composeOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
            <DialogDescription>Write a new message and send it directly from your inbox.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Title</p>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Message title"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Recipient</p>
                <div className="relative">
                  <Input
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value)}
                    onFocus={() => setSuggestionsOpen(true)}
                    onBlur={() => setTimeout(() => setSuggestionsOpen(false), 150)}
                    placeholder="Search by username"
                  />
                  {suggestionsOpen ? (
                    <div className="absolute z-20 mt-2 w-full rounded-md border bg-background p-2 shadow-lg">
                      {loadingSuggestions ? (
                        <p className="px-2 py-2 text-sm text-muted-foreground">Loading suggestions...</p>
                      ) : suggestions.length === 0 ? (
                        <p className="px-2 py-2 text-sm text-muted-foreground">No matches yet.</p>
                      ) : (
                        <div className="space-y-1">
                          {suggestions.map((suggestion) => (
                            <button
                              key={suggestion.id}
                              type="button"
                              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                              onMouseDown={(event) => {
                                event.preventDefault()
                                setRecipient(suggestion.username ?? "")
                                setSuggestionsOpen(false)
                              }}
                            >
                              <Avatar className="h-8 w-8 border">
                                <AvatarImage src={suggestion.avatar_url ?? undefined} />
                                <AvatarFallback>
                                  {(suggestion.username ?? "U").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <p className="font-medium">{suggestion.username ?? "Unknown"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {suggestion.isFriend ? "Friend" : "Suggested"}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Message</p>
              <RichTextEditor
                value={bodyHtml}
                onChange={(html, text) => {
                  setBodyHtml(html)
                  setBodyText(text)
                }}
                placeholder="Write your message..."
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Fields required: Title, Recipient, Message.</p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => handleDialogChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSend} disabled={!canSend}>
                  Send
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {paginated.length === 0 ? (
          <Card className="flex items-center justify-center border-dashed p-10 text-center text-muted-foreground">
            No messages in this folder yet.
          </Card>
        ) : (
          <div className="space-y-3">
            {paginated.map((message) => {
              const counterpart = folder === "sent" ? message.to : message.from
              const counterLabel = folder === "sent" || folder === "drafts" ? "To" : "From"
              const initials = counterpart.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()

              const content = (
                <div className="flex w-full items-center justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <Avatar className="h-11 w-11 border">
                      <AvatarImage src={counterpart.avatarUrl ?? undefined} />
                      <AvatarFallback>{initials || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-foreground">
                          <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{counterLabel}</span>
                          <span className="ml-2">{counterpart.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{counterpart.email}</span>
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(message.date, { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground/90">{message.subject}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {messagePreviewText(message.body)}
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(event) => {
                          event.stopPropagation()
                        }}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent
                      onClick={(event) => {
                        event.stopPropagation()
                      }}
                    >
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete message?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this message?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel
                          onClick={(event) => {
                            event.stopPropagation()
                          }}
                        >
                          No
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDelete(message.id)
                          }}
                        >
                          Yes
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )

              const isDraft = folder === "drafts"
              const handleRowClick = () => {
                if (isDraft) {
                  openDraft(message)
                  return
                }
                router.push(`/messages/${message.id}?folder=${folder}`)
              }

              const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  handleRowClick()
                }
              }

              return (
                <div
                  key={message.id}
                  role="button"
                  tabIndex={0}
                  onClick={handleRowClick}
                  onKeyDown={handleRowKeyDown}
                  className={cn(
                    "group flex items-center gap-4 rounded-lg border bg-background p-4 text-left transition hover:border-primary/60",
                    !isDraft && !message.read && message.type === "inbox" && "border-primary/40 bg-primary/5"
                  )}
                >
                  {content}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t px-6 py-4">
        <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
