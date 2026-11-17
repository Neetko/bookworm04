import { describe, expect, it } from "vitest"
import { messagePreviewText, sanitizeMessageBody } from "@/lib/message-content"

describe("message content", () => {
  it("removes executable markup from a previously stored message", () => {
    const body = '<p>Hello <strong>reader</strong></p><img src="x" onerror="alert(1)"><svg onload="alert(2)"></svg>'

    expect(sanitizeMessageBody(body)).toBe("<p>Hello <strong>reader</strong></p>")
    expect(messagePreviewText(body)).toBe("Hello reader")
  })

  it("keeps safe formatting and rejects scriptable links", () => {
    const body = '<p>Read <a href="javascript:alert(1)" onclick="alert(2)">this</a> instead.</p>'

    const cleaned = sanitizeMessageBody(body)
    expect(cleaned).toContain(">this</a> instead.</p>")
    expect(cleaned).not.toMatch(/javascript:|onclick|onerror|<script|<img/i)
  })
})
