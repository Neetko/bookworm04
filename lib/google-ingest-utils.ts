import { isIsbn10, isIsbn13 } from "@/lib/google-books"
import type { OpenLibraryEdition, OpenLibraryWorkCandidate } from "@/lib/open-library"
import { isExactTitleAuthorMatch, normalizeMatchText, type SuggestionWorkMatchType, type WorkSnapshot } from "@/lib/suggestions"
import type { Genre } from "@/lib/types"

export type LocalDuplicate = {
  id: string
  title: string
  author: string
  coverImageUrl: string | null
  source: "title" | "tracked"
}

export type WorkSelection = {
  primaryWorkId: string | null
  dupeWorkIds: string[]
}

export type SuggestionWorkMatchInsert = {
  workId: string
  matchType: SuggestionWorkMatchType
  confidenceScore: number
  reason: string
  workSnapshot: WorkSnapshot
}

export type IngestWorkMatchSummary = {
  userReviewCandidates: OpenLibraryWorkCandidate[]
  autoDupeMatches: SuggestionWorkMatchInsert[]
  bookwormSuggestedMatches: SuggestionWorkMatchInsert[]
}

export type GoogleIngestPreviewRecord = {
  token: string
  profileId: string
  volumeId: string
  createdAt: number
  suggestedGenres: Genre[]
  workCandidates: OpenLibraryWorkCandidate[]
  localDuplicates: LocalDuplicate[]
  requiresWorkConfirmation: boolean
  autoDupeMatchCount: number
  bookwormSuggestedMatchCount: number
  workMatchSummary: IngestWorkMatchSummary
}

export type FormatDerivationInput = {
  dimensions?: { height?: string; width?: string; thickness?: string } | null
  categories?: string[]
  physicalFormat?: string | null
  physicalDescription?: string | null
  physicalDimensions?: string | null
}

function normalizeToken(value: string): string {
  return normalizeMatchText(value)
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function computeStringSimilarity(a: string, b: string): number {
  const normalizedA = normalizeToken(a)
  const normalizedB = normalizeToken(b)

  if (!normalizedA && !normalizedB) return 1
  if (!normalizedA || !normalizedB) return 0
  if (normalizedA === normalizedB) return 1

  const previous = Array.from({ length: normalizedB.length + 1 }, (_, index) => index)

  for (let i = 1; i <= normalizedA.length; i += 1) {
    let diagonal = previous[0]
    previous[0] = i

    for (let j = 1; j <= normalizedB.length; j += 1) {
      const temp = previous[j]
      const cost = normalizedA[i - 1] === normalizedB[j - 1] ? 0 : 1
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + cost
      )
      diagonal = temp
    }
  }

  const distance = previous[normalizedB.length]
  return clamp(1 - distance / Math.max(normalizedA.length, normalizedB.length), 0, 1)
}

export function computeTokenOverlap(a: string, b: string): number {
  const tokensA = new Set(normalizeToken(a).split(" ").filter(Boolean))
  const tokensB = new Set(normalizeToken(b).split(" ").filter(Boolean))

  if (tokensA.size === 0 && tokensB.size === 0) return 1
  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let shared = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) shared += 1
  }

  return shared / Math.max(tokensA.size, tokensB.size)
}

export function buildWorkSnapshotFromCandidate(
  candidate: OpenLibraryWorkCandidate,
  match?: { matchType: SuggestionWorkMatchType; confidenceScore: number; reason: string }
): WorkSnapshot {
  return {
    workId: candidate.workId,
    title: candidate.title,
    author: candidate.author,
    firstPublishYear: candidate.firstPublishYear,
    editionCount: candidate.editionCount,
    forSale: null,
    coverUrl: candidate.coverUrl,
    subjects: candidate.subjects,
    matchCategory: match?.matchType ?? null,
    matchConfidence: match?.confidenceScore ?? null,
    matchReason: match?.reason ?? null,
  }
}

export function classifyOpenLibraryCandidateMatch(input: {
  title: string
  author: string
  candidate: OpenLibraryWorkCandidate
}): {
  confidenceScore: number
  matchType: SuggestionWorkMatchType | "user_review"
  reason: string
} {
  if (isExactTitleAuthorMatch({
    title: input.title,
    author: input.author,
    candidateTitle: input.candidate.title,
    candidateAuthor: input.candidate.author,
  })) {
    return {
      confidenceScore: 100,
      matchType: "exact_auto_dupe",
      reason: "Exact title and author match",
    }
  }

  const titleSimilarity = computeStringSimilarity(input.title, input.candidate.title)
  const authorSimilarity = input.author ? computeStringSimilarity(input.author, input.candidate.author) : 1
  const titleOverlap = computeTokenOverlap(input.title, input.candidate.title)
  const authorOverlap = input.author ? computeTokenOverlap(input.author, input.candidate.author) : 1

  const confidenceScore = Math.round(
    ((titleSimilarity * 0.55) + (titleOverlap * 0.2) + (authorSimilarity * 0.2) + (authorOverlap * 0.05)) * 100
  )

  if (confidenceScore >= 90 && titleSimilarity >= 0.82 && authorSimilarity >= 0.72) {
    return {
      confidenceScore,
      matchType: "bookworm_suggested",
      reason: "High-likelihood title and author match",
    }
  }

  return {
    confidenceScore,
    matchType: "user_review",
    reason: "Lower-confidence match left for user review",
  }
}

function parseCmFromText(value?: string | null): number | null {
  if (!value) return null
  const normalized = value.toLowerCase()
  const cmMatch = normalized.match(/(\d+(?:\.\d+)?)\s*cm/)
  if (cmMatch) return Number(cmMatch[1])

  const inMatch = normalized.match(/(\d+(?:\.\d+)?)\s*in/)
  if (inMatch) return Number(inMatch[1]) * 2.54

  const numberMatch = normalized.match(/(\d+(?:\.\d+)?)/)
  return numberMatch ? Number(numberMatch[1]) : null
}

export function deriveFormat(input: FormatDerivationInput): string | null {
  const categories = (input.categories ?? []).map(normalizeToken).join(" ")
  if (categories.includes("audiobook")) return "audiobook"
  if (categories.includes("electronic book") || categories.includes("ebook")) return "ebook"
  if (categories.includes("large type") || categories.includes("large print")) return "large-print"

  const heightCm =
    parseCmFromText(input.dimensions?.height) ??
    parseCmFromText(input.physicalDimensions) ??
    parseCmFromText(input.physicalDescription)
  if (heightCm) {
    if (heightCm >= 21) return "hardcover"
    if (heightCm <= 20) return "paperback"
  }

  const thicknessCm = parseCmFromText(input.dimensions?.thickness)
  if (thicknessCm) {
    if (thicknessCm >= 2.5) return "hardcover"
    return "paperback"
  }

  const fallback = normalizeToken(input.physicalFormat ?? input.physicalDescription ?? "")
  if (fallback.includes("hardcover")) return "hardcover"
  if (fallback.includes("paperback")) return "paperback"
  if (fallback.includes("audiobook")) return "audiobook"
  if (fallback.includes("ebook") || fallback.includes("electronic")) return "ebook"
  if (fallback.includes("large type") || fallback.includes("large print")) return "large-print"

  return null
}

export function mergeIsbnLists(existing: unknown, incoming: string[]): string[] {
  const existingList = Array.isArray(existing)
    ? existing.filter((value) => typeof value === "string")
    : []
  const merged = new Set<string>([...existingList, ...incoming.filter(Boolean)])
  return Array.from(merged)
}

export function mergeDupeWorkIds(existing: unknown, incoming: string[], primaryWorkId: string | null): string[] {
  const existingList = Array.isArray(existing)
    ? existing.filter((value) => typeof value === "string")
    : []
  const merged = new Set<string>([...existingList, ...incoming.filter(Boolean)])
  if (primaryWorkId) merged.delete(primaryWorkId)
  return Array.from(merged)
}

export function extractIsbnParts(identifiers: string[]): { isbn10: string | null; isbn13: string | null } {
  const cleaned = identifiers.map((value) => value.replace(/\s+/g, ""))
  const isbn13 = cleaned.find((value) => isIsbn13(value)) ?? null
  const isbn10 = cleaned.find((value) => isIsbn10(value)) ?? null
  return { isbn10, isbn13 }
}

export function findMatchingEdition(editions: OpenLibraryEdition[], identifiers: string[]): OpenLibraryEdition | null {
  if (editions.length === 0 || identifiers.length === 0) return null
  const normalized = identifiers.map((value) => value.replace(/\s+/g, ""))
  return (
    editions.find((edition) => edition.isbn13.some((isbn) => normalized.includes(isbn))) ||
    editions.find((edition) => edition.isbn10.some((isbn) => normalized.includes(isbn))) ||
    null
  )
}

export function resolveWorkSelection(selectedWorkIds: string[] | null | undefined): WorkSelection {
  const normalized = (selectedWorkIds ?? []).filter((id) => typeof id === "string" && id.trim().length > 0)
  const unique = Array.from(new Set(normalized))
  return {
    primaryWorkId: unique[0] ?? null,
    dupeWorkIds: unique.length > 1 ? unique.slice(1) : [],
  }
}
