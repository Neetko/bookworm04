import sanitizeHtml from "sanitize-html"

const allowedTags = ["p", "b", "strong", "i", "em", "br"]

const richTextTags = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "blockquote",
  "ul",
  "ol",
  "li",
  "code",
  "pre",
  "a",
]

const richTextAttributes: Record<string, sanitizeHtml.AllowedAttribute[]> = {
  a: ["href", "target", "rel"],
}

export function sanitizeDescriptionHtml(input: string | null | undefined) {
  return sanitizeHtml(input ?? "", {
    allowedTags,
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  })
}

export function sanitizeRichTextHtml(input: string | null | undefined) {
  return sanitizeHtml(input ?? "", {
    allowedTags: richTextTags,
    allowedAttributes: richTextAttributes,
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

export function extractPlainTextFromHtml(input: string | null | undefined) {
  return sanitizeHtml(input ?? "", {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim()
}
