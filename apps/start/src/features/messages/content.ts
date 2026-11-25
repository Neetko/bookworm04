import sanitizeHtml from "sanitize-html"

const richTextTags = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "blockquote",
  "ul", "ol", "li", "code", "pre", "a",
]

export function sanitizeMessageBody(body: string | null | undefined): string {
  return sanitizeHtml(body ?? "", {
    allowedTags: richTextTags,
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href"],
    transformTags: {
      a: (tagName, attribs) => {
        const next = { ...attribs }
        if (next.href) {
          next.target = "_blank"
          next.rel = "noopener noreferrer"
        }
        return { tagName, attribs: next }
      },
    },
    disallowedTagsMode: "discard",
  })
}

export function messagePreviewText(body: string | null | undefined): string {
  return sanitizeHtml(sanitizeMessageBody(body), {
    allowedTags: [],
    allowedAttributes: {},
  }).replace(/\s+/g, " ").trim()
}
