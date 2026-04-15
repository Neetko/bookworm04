export type OpenLibraryMetadata = {
  lcClassifications: string[]
  deweyDecimalClass: string[]
  subjects: string[]
  description: string | null
}

export type OpenLibraryEdition = {
  isbn10: string[]
  isbn13: string[]
  physicalFormat: string | null
  physicalDescription: string | null
  physicalDimensions: string | null
}

export type OpenLibraryWorkEditions = {
  workId: string | null
  isbns: string[]
  editions: OpenLibraryEdition[]
}

export type OpenLibraryWorkCandidate = {
  workId: string
  title: string
  author: string
  coverUrl: string | null
  firstPublishYear: number | null
  editionCount: number | null
  subjects: string[]
}

export type OpenLibraryWorkCoverCandidate = {
  workId: string
  coverId: number
  sourceCoverKey: string
  remoteUrl: string
  editionKey: string | null
}

function normalizeArray(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!entry) return null
        if (typeof entry === "string") return entry
        if (typeof entry === "object" && "value" in entry && typeof (entry as any).value === "string") {
          return (entry as any).value
        }
        if (typeof entry === "object" && "name" in entry && typeof (entry as any).name === "string") {
          return (entry as any).name
        }
        return null
      })
      .filter(Boolean) as string[]
  }

  if (typeof value === "string") return [value]
  return []
}

function normalizeDescription(value: unknown): string | null {
  if (!value) return null
  if (typeof value === "string") return value
  if (typeof value === "object" && "value" in value && typeof (value as any).value === "string") {
    return (value as any).value
  }
  return null
}

function normalizeIsbns(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry : null))
      .filter((entry): entry is string => Boolean(entry))
      .map((isbn) => isbn.replace(/\s+/g, ""))
  }
  if (typeof value === "string") return [value.replace(/\s+/g, "")]
  return []
}

function normalizeWorkOlid(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("/works/")) return trimmed.replace("/works/", "")
  return trimmed
}

export function buildOpenLibraryCoverUrlFromCoverId(coverId?: number | null, size: "M" | "L" = "M"): string | null {
  if (!coverId || !Number.isFinite(coverId)) return null
  return `https://covers.openlibrary.org/b/id/${encodeURIComponent(String(coverId))}-${size}.jpg?default=false`
}

function normalizeCoverIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []

  return Array.from(new Set(
    value
      .map((entry) => (typeof entry === "number" ? entry : typeof entry === "string" ? Number(entry) : NaN))
      .filter((entry) => Number.isFinite(entry) && entry > 0)
  )) as number[]
}

function normalizeEditionKey(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function fetchOpenLibraryWorkIdByIsbn(isbn: string): Promise<{ workId: string | null; isbns: string[] }> {
  const cleaned = isbn.replace(/\s+/g, "")
  if (!cleaned) return { workId: null, isbns: [] }

  const url = new URL("https://openlibrary.org/search.json")
  url.searchParams.set("q", `isbn:${cleaned}`)
  url.searchParams.set("fields", "key,isbn")
  url.searchParams.set("limit", "5")

  try {
    const res = await fetch(url.toString(), { cache: "no-store" })
    if (!res.ok) {
      console.warn("Open Library search failed", res.status)
      return { workId: null, isbns: [] }
    }

    const json = (await res.json()) as { docs?: Array<{ key?: string; isbn?: string[] }> }
    const selected = json?.docs?.find((entry) => entry?.key) ?? json?.docs?.[0]
    if (!selected) return { workId: null, isbns: [] }

    return {
      workId: normalizeWorkOlid(selected.key) ?? null,
      isbns: normalizeIsbns(selected.isbn),
    }
  } catch (error) {
    console.warn("Open Library search failed (network/parse)", error)
    return { workId: null, isbns: [] }
  }
}

async function fetchOpenLibraryEditionsByWorkId(workId: string): Promise<OpenLibraryEdition[]> {
  const cleaned = normalizeWorkOlid(workId)
  if (!cleaned) return []

  const url = new URL(`https://openlibrary.org/works/${encodeURIComponent(cleaned)}/editions.json`)
  url.searchParams.set("limit", "50")

  try {
    const res = await fetch(url.toString(), { cache: "no-store" })
    if (!res.ok) {
      console.warn("Open Library editions fetch failed", res.status)
      return []
    }

    const json = (await res.json()) as { entries?: any[] }
    const entries = json?.entries ?? []
    return entries.map((entry) => ({
      isbn10: normalizeIsbns(entry?.isbn_10),
      isbn13: normalizeIsbns(entry?.isbn_13),
      physicalFormat: typeof entry?.physical_format === "string" ? entry.physical_format : null,
      physicalDescription: typeof entry?.physical_description === "string" ? entry.physical_description : null,
      physicalDimensions: typeof entry?.physical_dimensions === "string" ? entry.physical_dimensions : null,
    }))
  } catch (error) {
    console.warn("Open Library editions fetch failed (network/parse)", error)
    return []
  }
}

export async function fetchOpenLibraryWorkCoverCandidatesByWorkId(workId: string): Promise<OpenLibraryWorkCoverCandidate[]> {
  const cleaned = normalizeWorkOlid(workId)
  if (!cleaned) return []

  const workUrl = new URL(`https://openlibrary.org/works/${encodeURIComponent(cleaned)}.json`)
  const editionsUrl = new URL(`https://openlibrary.org/works/${encodeURIComponent(cleaned)}/editions.json`)
  editionsUrl.searchParams.set("limit", "100")

  try {
    const [workRes, editionsRes] = await Promise.all([
      fetch(workUrl.toString(), { cache: "no-store" }),
      fetch(editionsUrl.toString(), { cache: "no-store" }),
    ])

    const candidates: OpenLibraryWorkCoverCandidate[] = []
    const seen = new Set<string>()

    if (workRes.ok) {
      const workJson = (await workRes.json()) as Record<string, unknown>
      for (const coverId of normalizeCoverIds(workJson.covers)) {
        const sourceCoverKey = `ol-${coverId}`
        if (seen.has(sourceCoverKey)) continue
        const remoteUrl = buildOpenLibraryCoverUrlFromCoverId(coverId, "L")
        if (!remoteUrl) continue
        seen.add(sourceCoverKey)
        candidates.push({
          workId: cleaned,
          coverId,
          sourceCoverKey,
          remoteUrl,
          editionKey: null,
        })
      }
    }

    if (editionsRes.ok) {
      const editionsJson = (await editionsRes.json()) as { entries?: Array<Record<string, unknown>> }
      for (const entry of editionsJson.entries ?? []) {
        const editionKey = normalizeEditionKey(entry.key)
        for (const coverId of normalizeCoverIds(entry.covers)) {
          const sourceCoverKey = `ol-${coverId}`
          if (seen.has(sourceCoverKey)) continue
          const remoteUrl = buildOpenLibraryCoverUrlFromCoverId(coverId, "L")
          if (!remoteUrl) continue
          seen.add(sourceCoverKey)
          candidates.push({
            workId: cleaned,
            coverId,
            sourceCoverKey,
            remoteUrl,
            editionKey,
          })
        }
      }
    }

    return candidates
  } catch (error) {
    console.warn("Open Library cover candidate fetch failed", error)
    return []
  }
}

export async function fetchOpenLibraryWorkEditionsByIsbn(isbn: string): Promise<OpenLibraryWorkEditions | null> {
  const { workId, isbns } = await fetchOpenLibraryWorkIdByIsbn(isbn)
  if (!workId) return { workId: null, isbns, editions: [] }

  const editions = await fetchOpenLibraryEditionsByWorkId(workId)
  const editionIsbns = editions.flatMap((edition) => [...edition.isbn10, ...edition.isbn13])
  const mergedIsbns = Array.from(new Set([...isbns, ...editionIsbns]))

  return {
    workId,
    isbns: mergedIsbns,
    editions,
  }
}

export async function fetchOpenLibraryWorkEditionsByWorkId(workId: string): Promise<OpenLibraryWorkEditions | null> {
  const cleaned = normalizeWorkOlid(workId)
  if (!cleaned) return { workId: null, isbns: [], editions: [] }

  const editions = await fetchOpenLibraryEditionsByWorkId(cleaned)
  const editionIsbns = editions.flatMap((edition) => [...edition.isbn10, ...edition.isbn13])
  const mergedIsbns = Array.from(new Set(editionIsbns))

  return {
    workId: cleaned,
    isbns: mergedIsbns,
    editions,
  }
}

export async function fetchOpenLibraryWorkCandidatesByTitleAuthor(options: {
  title: string
  author?: string
  limit?: number
}): Promise<OpenLibraryWorkCandidate[]> {
  const title = options.title.trim()
  const author = options.author?.trim()
  if (!title) return []

  const url = new URL("https://openlibrary.org/search.json")
  url.searchParams.set("title", title)
  if (author) url.searchParams.set("author", author)
  url.searchParams.set("fields", "key,title,author_name,cover_i,first_publish_year,edition_count,subject")
  url.searchParams.set("limit", String(options.limit ?? 15))

  try {
    const res = await fetch(url.toString(), { cache: "no-store" })
    if (!res.ok) {
      console.warn("Open Library search failed", res.status)
      return []
    }

    const json = (await res.json()) as { docs?: Array<any> }
    const docs = json?.docs ?? []
    return docs
      .map((doc) => ({
        workId: normalizeWorkOlid(doc?.key) ?? "",
        title: typeof doc?.title === "string" ? doc.title : "",
        author: normalizeArray(doc?.author_name)[0] ?? "",
        coverUrl: buildOpenLibraryCoverUrlFromCoverId(doc?.cover_i, "M"),
        firstPublishYear: typeof doc?.first_publish_year === "number" ? doc.first_publish_year : null,
        editionCount: typeof doc?.edition_count === "number" ? doc.edition_count : null,
        subjects: normalizeArray(doc?.subject),
      }))
      .filter((candidate) => Boolean(candidate.workId))
  } catch (error) {
    console.warn("Open Library search failed (network/parse)", error)
    return []
  }
}

export async function fetchOpenLibraryMetadataByIsbn(isbn: string): Promise<OpenLibraryMetadata | null> {
  const cleaned = isbn.replace(/\s+/g, "")
  if (!cleaned) return null

  const url = new URL("https://openlibrary.org/api/books")
  url.searchParams.set("bibkeys", `ISBN:${cleaned}`)
  url.searchParams.set("format", "json")
  url.searchParams.set("jscmd", "data")

  try {
    const res = await fetch(url.toString(), { cache: "no-store" })
    if (!res.ok) {
      console.warn("Open Library metadata fetch failed", res.status)
      return null
    }

    const json = (await res.json()) as Record<string, any>
    const record = json?.[`ISBN:${cleaned}`]
    if (!record) return null

    const classifications = record.classifications ?? {}
    const lcClassifications = normalizeArray(classifications.lc_classifications)
    const deweyDecimalClass = normalizeArray(classifications.dewey_decimal_class)
    const subjects = normalizeArray(record.subjects)
    const description = normalizeDescription(record.description)

    return {
      lcClassifications,
      deweyDecimalClass,
      subjects,
      description,
    }
  } catch (error) {
    console.warn("Open Library metadata fetch failed (network/parse)", error)
    return null
  }
}
