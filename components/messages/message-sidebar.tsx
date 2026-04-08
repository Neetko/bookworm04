"use client"

import { MessageFolder } from "@/lib/messages"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Inbox, Send, FileText } from "lucide-react"

const items: Array<{ folder: MessageFolder; label: string; icon: typeof Inbox }> = [
  { folder: "inbox", label: "Inbox", icon: Inbox },
  { folder: "sent", label: "Sent Messages", icon: Send },
  { folder: "drafts", label: "Drafts", icon: FileText },
]

type MessageSidebarProps = {
  activeFolder: MessageFolder
  onFolderChange: (folder: MessageFolder) => void
  counts: Record<MessageFolder, number>
}

export function MessageSidebar({ activeFolder, onFolderChange, counts }: MessageSidebarProps) {
  return (
    <aside className="w-full border-b bg-muted/40 md:w-72 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between px-6 py-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Messages</p>
          <h2 className="text-xl font-semibold">Inbox</h2>
        </div>
      </div>
      <nav className="flex flex-row gap-2 px-4 pb-4 md:flex-col">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = item.folder === activeFolder
          return (
            <Button
              key={item.folder}
              variant={isActive ? "secondary" : "ghost"}
              onClick={() => onFolderChange(item.folder)}
              className={cn("justify-between md:w-full", isActive && "border border-border")}
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
              {counts[item.folder] > 0 ? (
                <Badge variant={isActive ? "default" : "secondary"}>
                  {counts[item.folder]}
                </Badge>
              ) : null}
            </Button>
          )
        })}
      </nav>
    </aside>
  )
}
