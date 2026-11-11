import "server-only"

import type { MergedWork } from "@/lib/google-books"
import { normalizeReferenceIsbns } from "@/lib/reference-data"
import { createAdminClient } from "@/lib/supabase-server"
import { normalizeTitleSearchText } from "@/lib/title-search-results"

export type CanonicalExternalMatch = {
  titleId: string
  source: "title-source" | "reference-work" | "reference-isbn" | "primary-isbn" | "isbn-list" | "exact-title-author"
  confidenceScore: number
  isCollision: false
}

export type CanonicalExternalCollision = {
  titleIds: string[]
  source: CanonicalExternalMatch["source"]
  confidenceScore: number
  isCollision: true
}

export type CanonicalExternalMatchReport = {
  matches: Map<string, CanonicalExternalMatch>
  collisions: Map<string, CanonicalExternalCollision>
}

function getMergedExternalIdentifiers(book: {
  isbn?: string | null
  googleIdentifiers?: string[]
  identifiers?: string[]
}): string[] {
  return normalizeReferenceIsbns([
    book.isbn,
    ...(book.googleIdentifiers ?? []),
    ...(book.identifiers ?? []),
  ])
}

function getExternalAuthor(book: Pick<MergedWork, "authors">) {
  return book.authors[0] ?? "Unknown author"
}

function createExternalMatchCollector(books: MergedWork[]) {
  const matches = new Map<string, CanonicalExternalMatch>()
  const collisions = new Map<string, CanonicalExternalCollision>()

  const isUnresolved = (volumeId: string) => !matches.has(volumeId) && !collisions.has(volumeId)

  const applyMatch = (
    volumeId: string,
    titleIds: Array<string | null | undefined>,
    source: CanonicalExternalMatch["source"],
    confidenceScore: number
  ) => {
    if (!isUnresolved(volumeId)) return

    const uniqueTitleIds = Array.from(
      new Set(titleIds.filter((titleId): titleId is string => Boolean(titleId)))
    )

    if (uniqueTitleIds.length === 0) return
    if (uniqueTitleIds.length > 1) {
      collisions.set(volumeId, {
        titleIds: uniqueTitleIds,
        source,
        confidenceScore,
        isCollision: true,
      })
      return
    }

    matches.set(volumeId, {
      titleId: uniqueTitleIds[0],
      source,
      confidenceScore,
      isCollision: false,
    })
  }

  const unresolvedBooks = () => books.filter((book) => isUnresolved(book.volumeId))

  return { matches, collisions, applyMatch, unresolvedBooks }
}

async function getCanonicalExternalMatchReport(books: MergedWork[]): Promise<CanonicalExternalMatchReport> {
  if (books.length === 0) {
    return {
      matches: new Map<string, CanonicalExternalMatch>(),
      collisions: new Map<string, CanonicalExternalCollision>(),
    }
  }

  const admin = createAdminClient()
  const collector = createExternalMatchCollector(books)
  const volumeIds = books.map((book) => book.volumeId).filter(Boolean)

  const { data: sourceRows, error: sourceError } = await admin
    .from("title_sources")
    .select("external_id,title_id")
    .eq("source", "google")
    .in("external_id", volumeIds)

  if (sourceError) throw sourceError

  const sourceTitleIdsByVolume = new Map<string, string[]>()
  for (const row of sourceRows ?? []) {
    const volumeId = row.external_id
    const titleId = row.title_id
    if (!volumeId || !titleId) continue

    const titleIds = sourceTitleIdsByVolume.get(volumeId) ?? []
    titleIds.push(titleId)
    sourceTitleIdsByVolume.set(volumeId, titleIds)
  }

  for (const [volumeId, titleIds] of sourceTitleIdsByVolume.entries()) {
    collector.applyMatch(volumeId, titleIds, "title-source", 100)
  }

  const workIdToVolumeIds = new Map<string, string[]>()
  for (const book of collector.unresolvedBooks()) {
    const workId = book.workId?.trim()
    if (!workId) continue

    const volumeIdsForWork = workIdToVolumeIds.get(workId) ?? []
    volumeIdsForWork.push(book.volumeId)
    workIdToVolumeIds.set(workId, volumeIdsForWork)
  }

  const workIds = Array.from(workIdToVolumeIds.keys())
  if (workIds.length > 0) {
    const [{ data: referenceWorkRows, error: referenceWorkError }, { data: primaryWorkRows, error: primaryWorkError }] =
      await Promise.all([
        admin.from("title_reference_works").select("work_id,title_id").in("work_id", workIds),
        admin.from("titles").select("work_id,id").in("work_id", workIds),
      ])

    if (referenceWorkError) throw referenceWorkError
    if (primaryWorkError) throw primaryWorkError

    const titleIdsByWork = new Map<string, string[]>()
    const workLinks = [
      ...(referenceWorkRows ?? []).map((row) => ({ workId: row.work_id, titleId: row.title_id })),
      ...(primaryWorkRows ?? []).map((row) => ({ workId: row.work_id, titleId: row.id })),
    ]

    for (const row of workLinks) {
      const workId = row.workId?.trim()
      const titleId = row.titleId?.trim()
      if (!workId || !titleId) continue

      const titleIds = titleIdsByWork.get(workId) ?? []
      titleIds.push(titleId)
      titleIdsByWork.set(workId, titleIds)
    }

    for (const [workId, titleIds] of titleIdsByWork.entries()) {
      for (const volumeId of workIdToVolumeIds.get(workId) ?? []) {
        collector.applyMatch(volumeId, titleIds, "reference-work", 99)
      }
    }
  }

  const lookupIsbnsForBooks = () => {
    const isbnToVolumeIds = new Map<string, string[]>()
    for (const book of collector.unresolvedBooks()) {
      for (const isbn of getMergedExternalIdentifiers(book)) {
        const volumeIdsForIsbn = isbnToVolumeIds.get(isbn) ?? []
        volumeIdsForIsbn.push(book.volumeId)
        isbnToVolumeIds.set(isbn, volumeIdsForIsbn)
      }
    }
    return isbnToVolumeIds
  }

  let isbnToVolumeIds = lookupIsbnsForBooks()
  let isbns = Array.from(isbnToVolumeIds.keys())
  if (isbns.length > 0) {
    const { data: referenceRows, error: referenceError } = await admin
      .from("reference_isbns")
      .select("isbn,title_id")
      .in("isbn", isbns)

    if (referenceError) throw referenceError

    const titleIdsByVolume = new Map<string, string[]>()
    for (const row of referenceRows ?? []) {
      const isbn = row.isbn
      const titleId = row.title_id
      if (!isbn || !titleId) continue

      for (const volumeId of isbnToVolumeIds.get(isbn) ?? []) {
        const titleIds = titleIdsByVolume.get(volumeId) ?? []
        titleIds.push(titleId)
        titleIdsByVolume.set(volumeId, titleIds)
      }
    }

    for (const [volumeId, titleIds] of titleIdsByVolume.entries()) {
      collector.applyMatch(volumeId, titleIds, "reference-isbn", 98)
    }
  }

  isbnToVolumeIds = lookupIsbnsForBooks()
  isbns = Array.from(isbnToVolumeIds.keys())
  if (isbns.length > 0) {
    const { data: primaryRows, error: primaryError } = await admin
      .from("titles")
      .select("id,isbn")
      .in("isbn", isbns)

    if (primaryError) throw primaryError

    const titleIdsByVolume = new Map<string, string[]>()
    for (const row of primaryRows ?? []) {
      const isbn = row.isbn
      const titleId = row.id
      if (!isbn || !titleId) continue

      for (const volumeId of isbnToVolumeIds.get(isbn) ?? []) {
        const titleIds = titleIdsByVolume.get(volumeId) ?? []
        titleIds.push(titleId)
        titleIdsByVolume.set(volumeId, titleIds)
      }
    }

    for (const [volumeId, titleIds] of titleIdsByVolume.entries()) {
      collector.applyMatch(volumeId, titleIds, "primary-isbn", 96)
    }
  }

  isbnToVolumeIds = lookupIsbnsForBooks()
  isbns = Array.from(isbnToVolumeIds.keys())
  if (isbns.length > 0) {
    const isbnListLookups = await Promise.all(
      isbns.map(async (isbn) => {
        const { data, error } = await admin
          .from("titles")
          .select("id")
          .contains("isbn_list", [isbn])

        if (error) throw error
        return {
          isbn,
          titleIds: (data ?? [])
            .map((row) => row.id)
            .filter((titleId): titleId is string => Boolean(titleId)),
        }
      })
    )

    const titleIdsByVolume = new Map<string, string[]>()
    for (const lookup of isbnListLookups) {
      for (const volumeId of isbnToVolumeIds.get(lookup.isbn) ?? []) {
        const titleIds = titleIdsByVolume.get(volumeId) ?? []
        titleIds.push(...lookup.titleIds)
        titleIdsByVolume.set(volumeId, titleIds)
      }
    }

    for (const [volumeId, titleIds] of titleIdsByVolume.entries()) {
      collector.applyMatch(volumeId, titleIds, "isbn-list", 94)
    }
  }

  const exactLookups = await Promise.all(
    collector.unresolvedBooks().map(async (book) => {
      const author = getExternalAuthor(book)
      if (!book.title.trim() || !author.trim() || author === "Unknown author") {
        return { volumeId: book.volumeId, titleIds: [] as string[] }
      }

      const { data, error } = await admin
        .from("titles")
        .select("id,title,author")
        .ilike("title", book.title)
        .ilike("author", author)

      if (error) throw error

      const titleIds = (data ?? [])
        .filter((row) => normalizeTitleSearchText(row.title ?? "") === normalizeTitleSearchText(book.title))
        .filter((row) => normalizeTitleSearchText(row.author ?? "") === normalizeTitleSearchText(author))
        .map((row) => row.id)

      return { volumeId: book.volumeId, titleIds }
    })
  )

  for (const lookup of exactLookups) {
    collector.applyMatch(lookup.volumeId, lookup.titleIds, "exact-title-author", 80)
  }

  return {
    matches: collector.matches,
    collisions: collector.collisions,
  }
}

export async function getBestEffortCanonicalExternalMatchReport(books: MergedWork[]): Promise<CanonicalExternalMatchReport> {
  try {
    return await getCanonicalExternalMatchReport(books)
  } catch (error) {
    console.error("Error matching external search results to canonical titles", error)
    return {
      matches: new Map<string, CanonicalExternalMatch>(),
      collisions: new Map<string, CanonicalExternalCollision>(),
    }
  }
}

export async function getBestEffortCanonicalExternalMatches(books: MergedWork[]) {
  const report = await getBestEffortCanonicalExternalMatchReport(books)
  return report.matches
}
