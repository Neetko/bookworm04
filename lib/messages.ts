export type MessageFolder = "inbox" | "sent" | "drafts"

export type MessageType = "inbox" | "sent" | "draft"

export type MessageContact = {
  name: string
  email: string
  avatarUrl?: string | null
}

export type Message = {
  id: string
  from: MessageContact
  to: MessageContact
  subject: string
  body: string
  date: Date
  read: boolean
  type: MessageType
  replyTo?: string | null
}
