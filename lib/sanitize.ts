import sanitizeHtml from "sanitize-html"

const allowedTags = ["p", "b", "strong", "i", "em", "br"]

export function sanitizeDescriptionHtml(input: string | null | undefined) {
  return sanitizeHtml(input ?? "", {
    allowedTags,
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  })
}
