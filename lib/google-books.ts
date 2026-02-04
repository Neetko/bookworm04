type GoogleVolumeResponse = {
  id: string
  volumeInfo?: {
    title?: string
    authors?: string[]
    description?: string
    imageLinks?: {
      thumbnail?: string
      smallThumbnail?: string
    }
    publishedDate?: string
    industryIdentifiers?: Array<{ type?: string; identifier?: string }>
  }
}

export type GoogleBook = {
  source: "google"
  volumeId: string
  title: string
  authors: string[]
  description: string | null
  thumbnailUrl: string | null
  publishedYear: number | null
  isbn: string | null
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

function mapVolume(item: GoogleVolumeResponse): GoogleBook | null {
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
    thumbnailUrl,
    publishedYear: parsePublishedYear(info?.publishedDate),
    isbn: pickIsbn(info?.industryIdentifiers),
  }
}

export async function searchGoogleBooks(query: string): Promise<GoogleBook[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY

  const url = new URL("https://www.googleapis.com/books/v1/volumes")
  url.searchParams.set("q", trimmed)
  url.searchParams.set("printType", "books")
  url.searchParams.set("maxResults", "20")
  if (apiKey) url.searchParams.set("key", apiKey)

  let json: { items?: GoogleVolumeResponse[] } | null = null

  try {
    const res = await fetch(url.toString(), {
      // We don't want stale external results while testing.
      cache: "no-store",
    })

    if (!res.ok) {
      console.warn("Google Books search failed", res.status)
      return []
    }

    json = (await res.json()) as { items?: GoogleVolumeResponse[] }
  } catch (error) {
    console.warn("Google Books search failed (network/parse)", error)
    return []
  }

  const items = json?.items ?? []

  const mapped = items.map(mapVolume).filter(Boolean) as GoogleBook[]

  const seen = new Set<string>()
  const deduped = mapped.filter((book) => {
    const titleKey = book.title.trim().toLowerCase()
    const authorKey = (book.authors[0] ?? "").trim().toLowerCase()
    const key = `${titleKey}||${authorKey}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return deduped.sort((a, b) => {
    const titleA = a.title.toLowerCase()
    const titleB = b.title.toLowerCase()
    if (titleA !== titleB) return titleA.localeCompare(titleB)

    const authorA = (a.authors[0] ?? "").toLowerCase()
    const authorB = (b.authors[0] ?? "").toLowerCase()
    if (authorA !== authorB) return authorA.localeCompare(authorB)

    return a.volumeId.localeCompare(b.volumeId)
  })
}

export async function getGoogleBook(volumeId: string): Promise<GoogleBook | null> {
  const id = volumeId.trim()
  if (!id) return null

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY

  const url = new URL(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(id)}`)
  if (apiKey) url.searchParams.set("key", apiKey)

  try {
    const res = await fetch(url.toString(), { cache: "no-store" })
    if (!res.ok) {
      console.warn("Google Books volume fetch failed", res.status)
      return null
    }

    const json = (await res.json()) as GoogleVolumeResponse
    return mapVolume(json)
  } catch (error) {
    console.warn("Google Books volume fetch failed (network/parse)", error)
    return null
  }
}
