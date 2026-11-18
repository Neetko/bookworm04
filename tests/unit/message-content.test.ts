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

  it("keeps known sanitizer bypass markup out of rich text", () => {
    const payloads = [
      '<textarea></textarea/><img src=x onerror="alert(1)">',
      '<div><noscript></div><img src=x onerror="alert(1)"></noscript>',
      '<svg><a><animate attributeName="href" values="#safe;javascript:alert(1)"></animate></a></svg>',
      '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
    ]

    for (const payload of payloads) {
      expect(sanitizeMessageBody(payload)).not.toMatch(/<(?:img|svg|animate|script|textarea|meta)\b|onerror|javascript:/i)
    }
  })
})
