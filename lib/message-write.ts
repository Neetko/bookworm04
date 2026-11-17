import { z } from "zod"
import { sanitizeMessageBody } from "@/lib/message-content"
import { extractPlainTextFromHtml } from "@/lib/sanitize"

export const MAX_MESSAGE_SUBJECT_LENGTH = 200
export const MAX_MESSAGE_BODY_LENGTH = 10_000
export const MAX_MESSAGE_REQUEST_BYTES = 100_000

const messageWriteSchema = z.object({
  title: z.string().trim().min(1).max(MAX_MESSAGE_SUBJECT_LENGTH),
  recipient: z.string().trim().max(100).default(""),
  body: z.string().trim().min(1).max(20_000),
  status: z.enum(["sent", "draft"]).default("sent"),
  replyTo: z.string().uuid().nullable().optional(),
}).strict()

export type MessageWrite = {
  title: string
  recipient: string
  body: string
  status: "sent" | "draft"
  replyTo: string | null
}

export function parseMessageWrite(input: unknown): MessageWrite | null {
  const parsed = messageWriteSchema.safeParse(input)
  if (!parsed.success) return null

  const { title, recipient, status } = parsed.data
  if (status === "sent" && !recipient) return null

  const body = sanitizeMessageBody(parsed.data.body)
  if (body.length > MAX_MESSAGE_BODY_LENGTH || !extractPlainTextFromHtml(body).trim()) return null

  return {
    title,
    recipient,
    body,
    status,
    replyTo: parsed.data.replyTo ?? null,
  }
}

type JsonReadResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 | 415; error: string }

export async function readMessageJson(request: Request): Promise<JsonReadResult> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return { ok: false, status: 415, error: "JSON request required" }
  }

  const statedLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(statedLength) && statedLength > MAX_MESSAGE_REQUEST_BYTES) {
    return { ok: false, status: 413, error: "Message is too large" }
  }

  if (!request.body) return { ok: false, status: 400, error: "Invalid JSON" }

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let byteCount = 0
  let text = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteCount += value.byteLength
      if (byteCount > MAX_MESSAGE_REQUEST_BYTES) {
        await reader.cancel()
        return { ok: false, status: 413, error: "Message is too large" }
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON" }
  } finally {
    reader.releaseLock()
  }
}
