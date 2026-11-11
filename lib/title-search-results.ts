import type { SearchTitleResult } from "@/lib/types"

export const normalizeTitleSearchText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

export function buildTitleAuthorSearchKey(result: Pick<SearchTitleResult, "title" | "author">) {
  return `${normalizeTitleSearchText(result.title)}||${normalizeTitleSearchText(result.author)}`
}

export function scoreSearchTitleResult(
  result: Pick<SearchTitleResult, "title" | "author">,
  query: {
    title?: string
    author?: string
    raw?: string
  }
) {
  const queryText = normalizeTitleSearchText(
    [query.title, query.author, query.raw].filter(Boolean).join(" ")
  )
  const queryTerms = queryText.split(" ").filter((term) => term.length > 1)
  const titleText = normalizeTitleSearchText(result.title)
  const authorText = normalizeTitleSearchText(result.author)

  let score = 0
  for (const term of queryTerms) {
    if (titleText === term) score += 12
    else if (titleText.startsWith(term)) score += 7
    else if (titleText.includes(term)) score += 4

    if (authorText === term) score += 8
    else if (authorText.startsWith(term)) score += 5
    else if (authorText.includes(term)) score += 3
  }

  return score
}

export function compareSearchTitleResults(
  a: SearchTitleResult,
  b: SearchTitleResult,
  query: {
    title?: string
    author?: string
    raw?: string
  }
) {
  const scoreA = scoreSearchTitleResult(a, query)
  const scoreB = scoreSearchTitleResult(b, query)
  if (scoreB !== scoreA) return scoreB - scoreA
  if (b.engagement !== a.engagement) return b.engagement - a.engagement
  return a.title.localeCompare(b.title)
}

export function pickPreferredSearchResult(
  existing: SearchTitleResult,
  next: SearchTitleResult,
  query: {
    title?: string
    author?: string
    raw?: string
  }
) {
  if (existing.source !== next.source) {
    return existing.source === "local" ? existing : next
  }

  const existingScore = scoreSearchTitleResult(existing, query)
  const nextScore = scoreSearchTitleResult(next, query)
  if (nextScore !== existingScore) return nextScore > existingScore ? next : existing
  if (next.engagement !== existing.engagement) {
    return next.engagement > existing.engagement ? next : existing
  }

  return existing
}

export function mergeSearchTitleResults({
  localResults,
  externalResults,
  query,
}: {
  localResults: SearchTitleResult[]
  externalResults: SearchTitleResult[]
  query: {
    title?: string
    author?: string
    raw?: string
  }
}) {
  const deduped = new Map<string, SearchTitleResult>()

  for (const result of [...localResults, ...externalResults]) {
    const key = buildTitleAuthorSearchKey(result)
    const existing = deduped.get(key)
    deduped.set(key, existing ? pickPreferredSearchResult(existing, result, query) : result)
  }

  return Array.from(deduped.values()).sort((a, b) => compareSearchTitleResults(a, b, query))
}
