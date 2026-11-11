import { fetchExternalJson } from "@/lib/external-json"

export interface RawGoogleBook {
  id: string
  volumeInfo?: {
    title?: string
    authors?: string[]
    description?: string
    mainCategory?: string
    categories?: string[]
    dimensions?: {
      height?: string
      width?: string
      thickness?: string
    }
    imageLinks?: {
      thumbnail?: string
      smallThumbnail?: string
    }
    publishedDate?: string
    industryIdentifiers?: Array<{ type?: string; identifier?: string }>
  }
  saleInfo?: {
    saleability?: string
  }
}

export interface RefinedBook {
  source: "google"
  volumeId: string
  title: string
  authors: string[]
  description: string | null
  mainCategory: string | null
  categories: string[]
  thumbnailUrl: string | null
  publishedYear: number | null
  isbn: string | null
}

export type GoogleBook = RefinedBook

export type MergedWork = {
  source: "google-openlibrary"
  workId: string | null
  authorIds: string[]
  volumeId: string
  title: string
  authors: string[]
  publisher: string | null
  publishedYear: number | null
  description: string | null
  thumbnailUrl: string | null
  googleIdentifiers: string[]
  identifiers: string[]
  isbn: string | null
  mainCategory: string | null
  categories: string[]
}

type GoogleDimensions = NonNullable<RawGoogleBook["volumeInfo"]>["dimensions"]

type StructuredQueryParts = {
  title: string
  author?: string
}

function parsePublishedYear(publishedDate?: string): number | null {
  if (!publishedDate) return null
  // Google can return YYYY or YYYY-MM or YYYY-MM-DD
  const match = /^\d{4}/.exec(publishedDate)
  if (!match) return null
  const year = Number(match[0])
  return Number.isFinite(year) ? year : null
}

function pickIsbn(identifiers?: Array<{ type?: string; identifier?: string }>): string | null {
  if (!identifiers || identifiers.length === 0) return null
  const preferred = ["ISBN_13", "ISBN_10"]
  for (const type of preferred) {
    const found = identifiers.find((x) => x?.type === type && x?.identifier)
    if (found?.identifier) return found.identifier
  }
  const any = identifiers.find((x) => x?.identifier)?.identifier
  return any ?? null
}

export function extractIsbns(identifiers?: Array<{ type?: string; identifier?: string }>): string[] {
  if (!identifiers || identifiers.length === 0) return []
  const values = identifiers
    .map((entry) => entry?.identifier?.replace(/\s+/g, ""))
    .filter(Boolean) as string[]
  return Array.from(new Set(values))
}

export function extractAsins(identifiers?: Array<{ type?: string; identifier?: string }>): string[] {
  if (!identifiers || identifiers.length === 0) return []
  const values = identifiers
    .filter((entry) => entry?.type?.toUpperCase() === "ASIN")
    .map((entry) => entry?.identifier?.replace(/\s+/g, ""))
    .filter(Boolean) as string[]
  return Array.from(new Set(values))
}

function pickIsbn13(identifiers?: Array<{ type?: string; identifier?: string }>): string | null {
  if (!identifiers || identifiers.length === 0) return null
  const found = identifiers.find((x) => x?.type === "ISBN_13" && x?.identifier)
  return found?.identifier?.replace(/\s+/g, "") ?? null
}

function pickGroupingIdentifier(identifiers?: Array<{ type?: string; identifier?: string }>): string | null {
  if (!identifiers || identifiers.length === 0) return null
  const preferred = ["ISBN_13", "OCLC"]
  for (const type of preferred) {
    const found = identifiers.find((x) => x?.type?.toUpperCase() === type && x?.identifier)
    if (found?.identifier) return found.identifier.replace(/\s+/g, "")
  }
  return null
}

function normalizeTitle(rawTitle: string): string {
  const base = rawTitle.split(":")[0] ?? rawTitle
  return base
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeAuthorLastName(authors?: string[]): string {
  const primary = authors?.[0]?.trim() ?? ""
  if (!primary) return "unknown"
  const parts = primary.split(/\s+/).filter(Boolean)
  const last = parts[parts.length - 1] ?? primary
  const normalized = last.toLowerCase().replace(/[^a-z0-9]/g, "").trim()
  return normalized || "unknown"
}

function buildGroupingKey(title: string, authors?: string[]): string {
  const normalizedTitle = normalizeTitle(title)
  const authorLastName = normalizeAuthorLastName(authors)
  return `${normalizedTitle}|${authorLastName}`
}

function parsePublishedDateValue(publishedDate?: string): number {
  if (!publishedDate) return 0
  const match = publishedDate.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/)?.slice(1)
  if (!match) return 0
  const [year, month, day] = match.map((value) => Number(value ?? 0))
  if (!year) return 0
  const safeMonth = Math.min(Math.max(month || 1, 1), 12)
  const safeDay = Math.min(Math.max(day || 1, 1), 31)
  return year * 10000 + safeMonth * 100 + safeDay
}

function pickPrimaryItem(items: RawGoogleBook[]): RawGoogleBook | null {
  let best: RawGoogleBook | null = null
  let bestScore: [number, number, number] | null = null

  for (const item of items) {
    const info = item.volumeInfo
    if (!info?.title) continue

    const hasThumb = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail ? 1 : 0
    const descLength = info.description?.length ?? 0
    const publishedValue = parsePublishedDateValue(info.publishedDate)

    const score: [number, number, number] = [hasThumb, descLength, publishedValue]

    if (!bestScore) {
      best = item
      bestScore = score
      continue
    }

    if (score[0] !== bestScore[0]) {
      if (score[0] > bestScore[0]) {
        best = item
        bestScore = score
      }
      continue
    }

    if (score[1] !== bestScore[1]) {
      if (score[1] > bestScore[1]) {
        best = item
        bestScore = score
      }
      continue
    }

    if (score[2] > bestScore[2]) {
      best = item
      bestScore = score
    }
  }

  return best
}

export function collapseGoogleBooksItems(items: RawGoogleBook[]): RefinedBook[] {
  type Group = { key: string; items: RawGoogleBook[] }

  const groupsByKey = new Map<string, Group>()
  const groupsByIdentifier = new Map<string, Group>()

  for (const item of items) {
    const title = item.volumeInfo?.title?.trim()
    if (!item.id || !title) continue

    const key = buildGroupingKey(title, item.volumeInfo?.authors)
    const identifier = pickGroupingIdentifier(item.volumeInfo?.industryIdentifiers)

    let group = identifier ? groupsByIdentifier.get(identifier) : undefined
    if (!group) group = groupsByKey.get(key)

    if (!group) {
      group = { key, items: [] }
      groupsByKey.set(key, group)
    }

    group.items.push(item)

    if (identifier && !groupsByIdentifier.has(identifier)) {
      groupsByIdentifier.set(identifier, group)
    }
  }

  const uniqueGroups = new Set<Group>(groupsByKey.values())
  const refined: RefinedBook[] = []

  for (const group of uniqueGroups) {
    const primary = pickPrimaryItem(group.items)
    if (!primary) continue
    const mapped = mapVolume(primary)
    if (mapped) refined.push(mapped)
  }

  return refined.sort((a, b) => {
    const titleA = a.title.toLowerCase()
    const titleB = b.title.toLowerCase()
    if (titleA !== titleB) return titleA.localeCompare(titleB)

    const authorA = (a.authors[0] ?? "").toLowerCase()
    const authorB = (b.authors[0] ?? "").toLowerCase()
    if (authorA !== authorB) return authorA.localeCompare(authorB)

    return a.volumeId.localeCompare(b.volumeId)
  })
}

function mapVolume(item: RawGoogleBook): RefinedBook | null {
  const info = item.volumeInfo
  const title = info?.title?.trim()
  if (!item.id || !title) return null

  const rawThumb = info?.imageLinks?.thumbnail ?? info?.imageLinks?.smallThumbnail ?? null
  const thumbnailUrl = rawThumb ? rawThumb.replace(/^http:/, "https:") : null

  return {
    source: "google",
    volumeId: item.id,
    title,
    authors: info?.authors?.filter(Boolean) ?? [],
    description: info?.description ?? null,
    mainCategory: info?.mainCategory ?? null,
    categories: info?.categories?.filter(Boolean) ?? [],
    thumbnailUrl,
    publishedYear: parsePublishedYear(info?.publishedDate),
    isbn: pickIsbn(info?.industryIdentifiers),
  }
}

async function fetchGoogleBooksRaw(query: string): Promise<RawGoogleBook[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const structuredQuery = buildGoogleBooksQuery(trimmed)
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY

  const url = new URL("https://www.googleapis.com/books/v1/volumes")
  url.searchParams.set("q", structuredQuery)
  url.searchParams.set("orderBy", "relevance")
  url.searchParams.set("printType", "books")
  url.searchParams.set("maxResults", "20")
  if (apiKey) url.searchParams.set("key", apiKey)

  const json = await fetchExternalJson<{ items?: RawGoogleBook[] }>(url, {
    source: "Google Books search",
  })
  return json?.items ?? []
}

type OpenLibraryData = {
  workId: string | null
  authors: string[]
  authorIds: string[]
  publisher: string | null
  publishedYear: number | null
  identifiers: string[]
  coverUrl: string | null
}

type OpenLibrarySearchDoc = {
  key?: string
  title?: string
  author_name?: string[]
  author_key?: string[]
  first_publish_year?: number
  isbn?: string[]
  cover_i?: number
}

type OpenLibrarySearchResponse = {
  docs?: OpenLibrarySearchDoc[]
}

function normalizeWorkOlid(workId?: string | null): string | null {
  if (!workId) return null
  const trimmed = workId.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("/works/")) return trimmed.replace("/works/", "")
  return trimmed
}

function normalizeAuthorOlid(authorId?: string | null): string | null {
  if (!authorId) return null
  const trimmed = authorId.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("/authors/")) return trimmed.replace("/authors/", "")
  return trimmed
}

export function isIsbn13(value: string): boolean {
  return /^\d{13}$/.test(value)
}

export function isIsbn10(value: string): boolean {
  return /^\d{9}[\dXx]$/.test(value)
}

function buildOpenLibraryCoverUrl(options: { isbn?: string | null; workId?: string | null }): string | null {
  const isbn = options.isbn?.replace(/\s+/g, "") ?? null
  if (isbn) {
    return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`
  }

  const workOlid = normalizeWorkOlid(options.workId)
  if (workOlid) {
    return `https://covers.openlibrary.org/b/olid/${encodeURIComponent(workOlid)}-L.jpg?default=false`
  }

  return null
}

function buildOpenLibraryCoverUrlFromCoverId(coverId?: number | null): string | null {
  if (!coverId || !Number.isFinite(coverId)) return null
  return `https://covers.openlibrary.org/b/id/${encodeURIComponent(String(coverId))}-L.jpg?default=false`
}

function buildOpenLibraryCoverUrlFromIdentifiers(identifiers: string[], workId?: string | null): string | null {
  const cleaned = identifiers.map((value) => value.replace(/\s+/g, "")).filter(Boolean)
  const isbn13 = cleaned.find((value) => isIsbn13(value))
  if (isbn13) return buildOpenLibraryCoverUrl({ isbn: isbn13 })

  const isbn10 = cleaned.find((value) => isIsbn10(value))
  if (isbn10) return buildOpenLibraryCoverUrl({ isbn: isbn10 })

  return buildOpenLibraryCoverUrl({ workId })
}

async function fetchOpenLibrarySearchByIsbn(isbns: string[]): Promise<OpenLibrarySearchDoc[]> {
  if (isbns.length === 0) return []
  const query = isbns.map((isbn) => `isbn:${isbn}`).join(" OR ")
  const url = new URL("https://openlibrary.org/search.json")
  url.searchParams.set("q", query)
  url.searchParams.set("fields", "key,title,author_name,author_key,first_publish_year,isbn,cover_i")
  url.searchParams.set("limit", "20")

  const json = await fetchExternalJson<OpenLibrarySearchResponse>(url, {
    source: "Open Library ISBN search",
  })
  return json?.docs ?? []
}

function buildOpenLibraryDataFromSearchDoc(doc: OpenLibrarySearchDoc): OpenLibraryData | null {
  const workId = normalizeWorkOlid(doc.key) ?? null
  if (!workId) return null

  const identifiers = Array.from(
    new Set((doc.isbn ?? []).map((isbn) => isbn.replace(/\s+/g, "")).filter(Boolean))
  )
  const authorIds = (doc.author_key ?? [])
    .map((key) => normalizeAuthorOlid(key))
    .filter(Boolean) as string[]
  const authors = (doc.author_name ?? []).filter(Boolean)
  const coverUrl = buildOpenLibraryCoverUrlFromCoverId(doc.cover_i) ??
    buildOpenLibraryCoverUrlFromIdentifiers(identifiers, workId)

  return {
    workId,
    authors,
    authorIds,
    publisher: null,
    publishedYear: doc.first_publish_year ?? null,
    identifiers,
    coverUrl,
  }
}

function computeGoogleMatchScore(query: string, item: RawGoogleBook): number {
  const title = item.volumeInfo?.title?.toLowerCase() ?? ""
  const authors = item.volumeInfo?.authors?.join(" ").toLowerCase() ?? ""
  const description = item.volumeInfo?.description ?? ""
  const hasThumb = item.volumeInfo?.imageLinks?.thumbnail || item.volumeInfo?.imageLinks?.smallThumbnail ? 1 : 0

  const terms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2)

  let score = 0
  for (const term of terms) {
    if (title.includes(term)) score += 3
    if (authors.includes(term)) score += 2
  }

  if (hasThumb) score += 2
  if (description) score += 1
  return score
}

function splitStructuredQuery(rawQuery: string): StructuredQueryParts {
  const normalized = rawQuery.trim().replace(/\s+/g, " ")
  if (!normalized) return { title: "" }

  const byMatch = normalized.match(/^(.*?)\s+by\s+(.+)$/i)
  if (byMatch) {
    const title = byMatch[1]?.trim() ?? ""
    const author = byMatch[2]?.trim() ?? ""
    if (title && author) return { title, author }
  }

  const delimiters = [" - ", " — ", " – ", " | ", " / "]
  for (const delimiter of delimiters) {
    const index = normalized.indexOf(delimiter)
    if (index > 0 && index < normalized.length - delimiter.length) {
      const title = normalized.slice(0, index).trim()
      const author = normalized.slice(index + delimiter.length).trim()
      if (title && author) return { title, author }
    }
  }

  return { title: normalized }
}

function buildGoogleBooksQuery(rawQuery: string): string {
  const trimmed = rawQuery.trim()
  if (!trimmed) return ""

  if (/\b(intitle|inauthor|isbn|inpublisher|subject):/i.test(trimmed)) {
    return trimmed
  }

  const { title, author } = splitStructuredQuery(trimmed)

  if (title && author) {
    return `intitle:${title} inauthor:${author}`
  }

  if (title) {
    return `intitle:${title}`
  }

  return trimmed
}

export async function searchGoogleBooks(query: string): Promise<GoogleBook[]> {
  const items = await fetchGoogleBooksRaw(query)
  return collapseGoogleBooksItems(items)
}

export type GoogleBookDetails = {
  refined: GoogleBook
  raw: RawGoogleBook
  identifiers: string[]
  dimensions: GoogleDimensions | null
  saleability: string | null
}

export async function searchGoogleBooksWithOpenLibrary(
  query: string,
  options?: { topResults?: number }
): Promise<MergedWork[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const items = await fetchGoogleBooksRaw(trimmed)
  if (items.length === 0) return []

  const topResults = options?.topResults ?? 10
  const openLibraryByIsbn = new Map<string, OpenLibraryData>()

  const topItems = items.slice(0, topResults)
  const isbn13s = Array.from(
    new Set(
      topItems
        .map((item) => pickIsbn13(item.volumeInfo?.industryIdentifiers))
        .filter(Boolean) as string[]
    )
  )

  const openLibraryDocs = await fetchOpenLibrarySearchByIsbn(isbn13s)
  for (const doc of openLibraryDocs) {
    const data = buildOpenLibraryDataFromSearchDoc(doc)
    if (!data) continue

    for (const isbn of data.identifiers) {
      if (!openLibraryByIsbn.has(isbn)) openLibraryByIsbn.set(isbn, data)
    }
  }

  type Group = {
    key: string
    openLibrary?: OpenLibraryData
    items: RawGoogleBook[]
  }

  const groups = new Map<string, Group>()
  const unlinkedItems: RawGoogleBook[] = []

  for (const item of items) {
    const identifiers = extractIsbns(item.volumeInfo?.industryIdentifiers)
    const openLibrary = identifiers
      .map((identifier) => openLibraryByIsbn.get(identifier))
      .find(Boolean)

    if (!openLibrary?.workId) {
      unlinkedItems.push(item)
      continue
    }

    const key = `work:${openLibrary.workId}`
    const group = groups.get(key) ?? { key, items: [] }
    if (!group.openLibrary) group.openLibrary = openLibrary
    group.items.push(item)
    groups.set(key, group)
  }

  const merged: MergedWork[] = []

  for (const group of groups.values()) {
    const bestItem = group.items.reduce((best, current) => {
      if (!best) return current

      const bestScore = computeGoogleMatchScore(trimmed, best)
      const currentScore = computeGoogleMatchScore(trimmed, current)

      if (currentScore !== bestScore) return currentScore > bestScore ? current : best

      const bestDesc = best.volumeInfo?.description?.length ?? 0
      const currentDesc = current.volumeInfo?.description?.length ?? 0
      if (currentDesc !== bestDesc) return currentDesc > bestDesc ? current : best

      const bestPublished = parsePublishedDateValue(best.volumeInfo?.publishedDate)
      const currentPublished = parsePublishedDateValue(current.volumeInfo?.publishedDate)
      if (currentPublished !== bestPublished) return currentPublished > bestPublished ? current : best

      return best
    }, null as RawGoogleBook | null)

    if (!bestItem) continue
    const refined = mapVolume(bestItem)
    if (!refined) continue

    const openLibrary = group.openLibrary
    const googleIdentifiers = extractIsbns(bestItem.volumeInfo?.industryIdentifiers)
    const identifiers = Array.from(
      new Set([...(openLibrary?.identifiers ?? []), ...googleIdentifiers])
    )

    const openLibraryCoverUrl =
      openLibrary?.coverUrl ?? buildOpenLibraryCoverUrlFromIdentifiers(identifiers, openLibrary?.workId ?? null)

    merged.push({
      source: "google-openlibrary",
      workId: openLibrary?.workId ?? null,
      authorIds: openLibrary?.authorIds ?? [],
      volumeId: refined.volumeId,
      title: refined.title,
      authors: openLibrary?.authors?.length ? openLibrary.authors : refined.authors,
      publisher: openLibrary?.publisher ?? null,
      publishedYear: openLibrary?.publishedYear ?? refined.publishedYear,
      description: refined.description,
      thumbnailUrl: refined.thumbnailUrl ?? openLibraryCoverUrl,
      googleIdentifiers,
      identifiers,
      isbn: refined.isbn ?? identifiers[0] ?? null,
      mainCategory: refined.mainCategory ?? null,
      categories: refined.categories ?? [],
    })
  }

  if (unlinkedItems.length > 0) {
    const fallback = collapseGoogleBooksItems(unlinkedItems)
    for (const item of fallback) {
      const identifiers = item.isbn ? [item.isbn] : []
      const fallbackCoverUrl = buildOpenLibraryCoverUrlFromIdentifiers(identifiers, null)
      merged.push({
        source: "google-openlibrary",
        workId: null,
        authorIds: [],
        volumeId: item.volumeId,
        title: item.title,
        authors: item.authors,
        publisher: null,
        publishedYear: item.publishedYear,
        description: item.description,
        thumbnailUrl: item.thumbnailUrl ?? fallbackCoverUrl,
        googleIdentifiers: identifiers,
        identifiers,
        isbn: item.isbn ?? null,
        mainCategory: item.mainCategory ?? null,
        categories: item.categories ?? [],
      })
    }
  }

  return merged
}

export async function getGoogleBook(volumeId: string): Promise<GoogleBook | null> {
  const id = volumeId.trim()
  if (!id) return null

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY

  const url = new URL(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(id)}`)
  if (apiKey) url.searchParams.set("key", apiKey)
  url.searchParams.set("projection", "full")

  const json = await fetchExternalJson<RawGoogleBook>(url, {
    source: "Google Books volume fetch",
  })
  return json ? mapVolume(json) : null
}

export async function getGoogleBookDetails(volumeId: string): Promise<GoogleBookDetails | null> {
  const id = volumeId.trim()
  if (!id) return null

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY
  const url = new URL(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(id)}`)
  if (apiKey) url.searchParams.set("key", apiKey)
  url.searchParams.set("projection", "full")

  const raw = await fetchExternalJson<RawGoogleBook>(url, {
    source: "Google Books volume fetch",
  })
  if (!raw) return null

  const refined = mapVolume(raw)
  if (!refined) return null

  return {
    refined,
    raw,
    identifiers: extractIsbns(raw.volumeInfo?.industryIdentifiers),
    dimensions: raw.volumeInfo?.dimensions ?? null,
    saleability: raw.saleInfo?.saleability ?? null,
  }
}
