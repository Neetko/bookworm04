import sanitizeHtml from "sanitize-html"
import { MAX_DIARY_NOTE_LENGTH } from "./validation"

export function diaryNoteText(noteText: string | null | undefined, noteHtml?: string | null): string {
  const source = noteText?.trim()
    ? noteText
    : sanitizeHtml(noteHtml ?? "", { allowedTags: [], allowedAttributes: {} })
  return source.replace(/\r\n?/g, "\n").trim().slice(0, MAX_DIARY_NOTE_LENGTH)
}

export function diaryNoteHtml(noteText: string): string | null {
  const normalized = noteText.replace(/\r\n?/g, "\n").trim().slice(0, MAX_DIARY_NOTE_LENGTH)
  if (!normalized) return null
  const escaped = normalized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
  return `<p>${escaped.replace(/\n/g, "<br />")}</p>`
}
