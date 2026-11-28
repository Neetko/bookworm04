import sanitizeHtml from "sanitize-html"

const richTextTags = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "blockquote",
  "ul", "ol", "li", "code", "pre", "a",
]

export function sanitizeTitleRichText(input: string | null | undefined): string {
  return sanitizeHtml(input ?? "", {
    allowedTags: richTextTags,
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: attribs.href
          ? { ...attribs, target: "_blank", rel: "noopener noreferrer" }
          : attribs,
      }),
    },
    disallowedTagsMode: "discard",
  })
}

export function titleRichTextPlainText(input: string | null | undefined): string {
  return sanitizeHtml(sanitizeTitleRichText(input), {
    allowedTags: [],
    allowedAttributes: {},
  }).replace(/\s+/g, " ").trim()
}
