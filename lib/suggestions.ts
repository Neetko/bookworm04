import { normalizeGenres, type Genre } from "@/lib/types"

export function normalizeMatchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
}

export type WorkSnapshot = {
  workId: string
  title: string
  author: string
  firstPublishYear: number | null
  editionCount: number | null
  forSale?: boolean | null
  coverUrl?: string | null
  subjects?: string[]
  matchCategory?: SuggestionWorkMatchType | null
  matchConfidence?: number | null
  matchReason?: string | null
}

export type CoverChoiceSource = "openlibrary" | "google"

export type CoverChoice = {
  cacheId?: string | null
  workId: string
  source: CoverChoiceSource
  sourceCoverKey: string
  imageUrl: string
  remoteUrl: string | null
  cachedFilePath?: string | null
}

export type SuggestionWorkMatchType = "exact_auto_dupe" | "bookworm_suggested"

export type SuggestionWorkMatch = {
  id?: string
  workId: string
  matchType: SuggestionWorkMatchType
  confidenceScore: number | null
  reason: string | null
  workSnapshot: WorkSnapshot
  createdAt?: string | null
}

export function isExactTitleAuthorMatch(input: {
  title: string
  author?: string | null
  candidateTitle: string
  candidateAuthor?: string | null
}): boolean {
  const normalizedTitle = normalizeMatchText(input.title)
  const normalizedCandidateTitle = normalizeMatchText(input.candidateTitle)

  if (!normalizedTitle || !normalizedCandidateTitle || normalizedTitle !== normalizedCandidateTitle) {
    return false
  }

  const normalizedAuthor = normalizeMatchText(input.author ?? "")
  const normalizedCandidateAuthor = normalizeMatchText(input.candidateAuthor ?? "")

  if (!normalizedAuthor) return true

  return normalizedAuthor === normalizedCandidateAuthor
}

export function isExactWorkSnapshotMatch(snapshot: WorkSnapshot | null | undefined, input: {
  title: string
  author?: string | null
}): boolean {
  if (!snapshot) return false

  return isExactTitleAuthorMatch({
    title: input.title,
    author: input.author,
    candidateTitle: snapshot.title,
    candidateAuthor: snapshot.author,
  })
}

export function buildFallbackWorkSnapshot(workId: string): WorkSnapshot {
  return {
    workId,
    title: workId,
    author: "",
    firstPublishYear: null,
    editionCount: null,
    forSale: null,
    coverUrl: null,
    subjects: [],
    matchCategory: null,
    matchConfidence: null,
    matchReason: null,
  }
}

export function normalizeWorkSnapshot(value: unknown, fallbackWorkId?: string | null): WorkSnapshot | null {
  if (!value || typeof value !== "object") {
    return fallbackWorkId ? buildFallbackWorkSnapshot(fallbackWorkId) : null
  }

  const row = value as Record<string, unknown>
  const workId = typeof row.workId === "string" && row.workId.trim().length > 0
    ? row.workId.trim()
    : (fallbackWorkId?.trim() || "")

  if (!workId) return null

  return {
    workId,
    title: typeof row.title === "string" ? row.title : workId,
    author: typeof row.author === "string" ? row.author : "",
    firstPublishYear: typeof row.firstPublishYear === "number" ? row.firstPublishYear : null,
    editionCount: typeof row.editionCount === "number" ? row.editionCount : null,
    forSale: typeof row.forSale === "boolean" ? row.forSale : null,
    coverUrl: typeof row.coverUrl === "string" ? row.coverUrl : null,
    subjects: Array.isArray(row.subjects)
      ? row.subjects.filter((entry): entry is string => typeof entry === "string")
      : [],
    matchCategory: row.matchCategory === "exact_auto_dupe" || row.matchCategory === "bookworm_suggested"
      ? row.matchCategory
      : null,
    matchConfidence: typeof row.matchConfidence === "number" ? row.matchConfidence : null,
    matchReason: typeof row.matchReason === "string" ? row.matchReason : null,
  }
}

export function normalizeWorkSnapshots(value: unknown): WorkSnapshot[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => normalizeWorkSnapshot(entry))
    .filter((entry): entry is WorkSnapshot => Boolean(entry))
}

export function normalizeCoverChoice(value: unknown): CoverChoice | null {
  if (!value || typeof value !== "object") return null

  const row = value as Record<string, unknown>
  const workId = typeof row.workId === "string"
    ? row.workId.trim()
    : typeof row.work_id === "string"
      ? row.work_id.trim()
      : ""
  const source = row.source === "openlibrary" || row.source === "google"
    ? row.source
    : null
  const sourceCoverKey = typeof row.sourceCoverKey === "string"
    ? row.sourceCoverKey.trim()
    : typeof row.source_cover_key === "string"
      ? row.source_cover_key.trim()
      : ""
  const imageUrl = typeof row.imageUrl === "string"
    ? row.imageUrl.trim()
    : typeof row.image_url === "string"
      ? row.image_url.trim()
      : ""
  const remoteUrl = typeof row.remoteUrl === "string"
    ? row.remoteUrl.trim()
    : typeof row.remote_url === "string"
      ? row.remote_url.trim()
      : null
  const cachedFilePath = typeof row.cachedFilePath === "string"
    ? row.cachedFilePath.trim()
    : typeof row.cached_file_path === "string"
      ? row.cached_file_path.trim()
      : null

  if (!workId || !source || !sourceCoverKey || !imageUrl) return null

  return {
    cacheId: typeof row.cacheId === "string"
      ? row.cacheId
      : typeof row.id === "string"
        ? row.id
        : null,
    workId,
    source,
    sourceCoverKey,
    imageUrl,
    remoteUrl,
    cachedFilePath,
  }
}

export function normalizeSuggestionWorkMatch(value: unknown): SuggestionWorkMatch | null {
  if (!value || typeof value !== "object") return null

  const row = value as Record<string, unknown>
  const fallbackWorkId = typeof row.workId === "string"
    ? row.workId
    : typeof row.work_id === "string"
      ? row.work_id
      : null

  const matchType = row.matchType === "exact_auto_dupe" || row.matchType === "bookworm_suggested"
    ? row.matchType
    : row.match_type === "exact_auto_dupe" || row.match_type === "bookworm_suggested"
      ? row.match_type
      : null

  if (!fallbackWorkId || !matchType) return null

  const snapshot = normalizeWorkSnapshot(
    row.workSnapshot ?? row.work_snapshot,
    fallbackWorkId
  )

  if (!snapshot) return null

  return {
    id: typeof row.id === "string" ? row.id : undefined,
    workId: fallbackWorkId,
    matchType,
    confidenceScore: typeof row.confidenceScore === "number"
      ? row.confidenceScore
      : typeof row.confidence_score === "number"
        ? row.confidence_score
        : null,
    reason: typeof row.reason === "string" ? row.reason : null,
    workSnapshot: {
      ...snapshot,
      matchCategory: matchType,
      matchConfidence: typeof row.confidenceScore === "number"
        ? row.confidenceScore
        : typeof row.confidence_score === "number"
          ? row.confidence_score
          : null,
      matchReason: typeof row.reason === "string" ? row.reason : null,
    },
    createdAt: typeof row.createdAt === "string"
      ? row.createdAt
      : typeof row.created_at === "string"
        ? row.created_at
        : null,
  }
}

export function normalizeSuggestionWorkMatches(value: unknown): SuggestionWorkMatch[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => normalizeSuggestionWorkMatch(entry))
    .filter((entry): entry is SuggestionWorkMatch => Boolean(entry))
}

export function normalizeWorkIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(new Set(
    value
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim())
  ))
}

export function normalizeCoverChoices(value: unknown): CoverChoice[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => normalizeCoverChoice(entry))
    .filter((entry): entry is CoverChoice => Boolean(entry))
}

export function buildSuggestionReviewUpdate(input: {
  adminFinalGenres: unknown
  adminFinalSelectedWorkIds?: unknown
  adminFinalSelectedWorkSnapshots?: unknown
  adminFinalCoverSelection?: unknown
}): {
  adminFinalGenres: Genre[]
  adminFinalSelectedWorkIds: string[]
  adminFinalSelectedWorkSnapshots: WorkSnapshot[]
  adminFinalCoverSelection: CoverChoice | null
} {
  const adminFinalGenres = normalizeGenres(input.adminFinalGenres)
  const adminFinalSelectedWorkIds = normalizeWorkIdList(input.adminFinalSelectedWorkIds)
  const explicitSelectedWorkSnapshots = normalizeWorkSnapshots(input.adminFinalSelectedWorkSnapshots)
  const adminFinalCoverSelection = normalizeCoverChoice(input.adminFinalCoverSelection)
  const adminFinalSelectedWorkSnapshots = adminFinalSelectedWorkIds.map((workId) => {
    return explicitSelectedWorkSnapshots.find((snapshot) => snapshot.workId === workId)
      ?? buildFallbackWorkSnapshot(workId)
  })

  return {
    adminFinalGenres,
    adminFinalSelectedWorkIds,
    adminFinalSelectedWorkSnapshots,
    adminFinalCoverSelection,
  }
}