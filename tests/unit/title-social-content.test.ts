import { describe, expect, it } from "vitest"
import {
  sanitizeTitleRichText,
  titleRichTextPlainText,
} from "../../apps/start/src/features/titles/social-content"

describe("title social rich text", () => {
  it("keeps supported formatting and removes executable markup", () => {
    const result = sanitizeTitleRichText(
      '<p>Hello <strong>reader</strong></p><script>alert(1)</script><img src=x onerror=alert(2)>',
    )

    expect(result).toBe("<p>Hello <strong>reader</strong></p>")
  })

  it("hardens links opened from reviews and discussions", () => {
    const result = sanitizeTitleRichText('<a href="https://example.com">Example</a>')

    expect(result).toContain('target="_blank"')
    expect(result).toContain('rel="noopener noreferrer"')
  })

  it("extracts plain text for validation and activity metadata", () => {
    expect(titleRichTextPlainText("<p>One</p><p>Two</p>")).toBe("OneTwo")
  })
})
