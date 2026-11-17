import { extractPlainTextFromHtml, sanitizeRichTextHtml } from "@/lib/sanitize"

export function sanitizeMessageBody(body: string) {
  return sanitizeRichTextHtml(body)
}

export function messagePreviewText(body: string) {
  return extractPlainTextFromHtml(sanitizeMessageBody(body))
}
