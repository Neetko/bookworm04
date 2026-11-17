import { fetchOpenLibraryWorkCoverCandidatesByWorkId } from "@/lib/open-library"
import { fetchRemoteCoverImage, isAllowedOpenLibraryCoverUrl } from "@/lib/remote-cover-image"
import { normalizeWorkIdList, normalizeWorkSnapshots, type CoverChoice, type WorkSnapshot } from "@/lib/suggestions"

const BOOK_COVERS_BUCKET = "book-covers"
const MAX_OPEN_LIBRARY_COVER_CHOICES_PER_WORK = 8

type SupabaseClientLike = {
  from: (table: string) => any
  storage: {
    from: (bucket: string) => {
      upload: (path: string, body: ArrayBuffer | Uint8Array | Buffer, options?: { upsert?: boolean; contentType?: string }) => Promise<{ error: any }>
      getPublicUrl: (path: string) => { data: { publicUrl: string } }
    }
  }
}

type WorkCoverCacheRow = {
  id?: string
  work_id?: string
  source?: string
  source_cover_key?: string
  remote_url?: string
  cached_file_path?: string | null
  cached_public_url?: string | null
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-")
}

function toCoverChoice(row: WorkCoverCacheRow | null | undefined): CoverChoice | null {
  if (!row?.work_id || !row?.source || !row?.source_cover_key) return null
  const imageUrl = row.cached_public_url ?? row.remote_url
  if (!imageUrl) return null
  if (row.source !== "openlibrary" && row.source !== "google") return null

  return {
    cacheId: row.id ?? null,
    workId: row.work_id,
    source: row.source,
    sourceCoverKey: row.source_cover_key,
    imageUrl,
    remoteUrl: row.remote_url ?? null,
    cachedFilePath: row.cached_file_path ?? null,
  }
}

function normalizeGoogleThumbnailUrl(rawGoogleData: unknown): string | null {
  if (!rawGoogleData || typeof rawGoogleData !== "object") return null
  const volumeInfo = (rawGoogleData as any).volumeInfo
  if (!volumeInfo || typeof volumeInfo !== "object") return null
  const imageLinks = volumeInfo.imageLinks
  if (!imageLinks || typeof imageLinks !== "object") return null
  const thumbnail = typeof imageLinks.thumbnail === "string"
    ? imageLinks.thumbnail
    : typeof imageLinks.smallThumbnail === "string"
      ? imageLinks.smallThumbnail
      : null

  return thumbnail ? thumbnail.replace(/^http:/, "https:") : null
}

async function cacheOpenLibraryCover(
  admin: SupabaseClientLike,
  input: {
    workId: string
    sourceCoverKey: string
    remoteUrl: string
  }
): Promise<CoverChoice | null> {
  if (!isAllowedOpenLibraryCoverUrl(input.remoteUrl)) return null

  const path = `openlibrary/${sanitizePathSegment(input.workId)}/${sanitizePathSegment(input.sourceCoverKey)}.webp`
  let cachedPublicUrl: string | null = null

  try {
    const body = await fetchRemoteCoverImage(input.remoteUrl)
    const { error: uploadError } = await admin.storage
      .from(BOOK_COVERS_BUCKET)
      .upload(path, body, { upsert: true, contentType: "image/webp" })

    if (uploadError) {
      console.warn("Failed to upload cached Open Library cover", uploadError)
    } else {
      cachedPublicUrl = admin.storage.from(BOOK_COVERS_BUCKET).getPublicUrl(path).data.publicUrl
    }
  } catch (error) {
    console.warn("Failed to cache Open Library cover", error)
  }

  const row = {
    work_id: input.workId,
    source: "openlibrary",
    source_cover_key: input.sourceCoverKey,
    remote_url: input.remoteUrl,
    cached_file_path: cachedPublicUrl ? path : null,
    cached_public_url: cachedPublicUrl,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await admin
    .from("work_cover_cache")
    .upsert(row, { onConflict: "work_id,source,source_cover_key" })
    .select("id,work_id,source,source_cover_key,remote_url,cached_file_path,cached_public_url")
    .single()

  if (error) {
    console.error("Failed to save cached Open Library cover row", error)
    return toCoverChoice(row)
  }

  return toCoverChoice(data as WorkCoverCacheRow)
}

async function cacheGoogleThumbnailReference(
  admin: SupabaseClientLike,
  input: {
    workId: string
    thumbnailUrl: string
  }
): Promise<CoverChoice | null> {
  const row = {
    work_id: input.workId,
    source: "google",
    source_cover_key: input.thumbnailUrl,
    remote_url: input.thumbnailUrl,
    cached_file_path: null,
    cached_public_url: null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await admin
    .from("work_cover_cache")
    .upsert(row, { onConflict: "work_id,source,source_cover_key" })
    .select("id,work_id,source,source_cover_key,remote_url,cached_file_path,cached_public_url")
    .single()

  if (error) {
    console.error("Failed to save cached Google thumbnail reference", error)
    return toCoverChoice(row)
  }

  return toCoverChoice(data as WorkCoverCacheRow)
}

function dedupeCoverChoices(choices: CoverChoice[]): CoverChoice[] {
  const seen = new Set<string>()
  const result: CoverChoice[] = []

  for (const choice of choices) {
    const key = `${choice.workId}::${choice.source}::${choice.sourceCoverKey}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(choice)
  }

  return result
}

function appendCoverChoice(map: Map<string, CoverChoice[]>, choice: CoverChoice) {
  const list = map.get(choice.workId) ?? []
  list.push(choice)
  map.set(choice.workId, dedupeCoverChoices(list))
}

export async function getCoverChoicesForSelectedWorks(
  admin: SupabaseClientLike,
  input: {
    workIds: string[]
    workSnapshots?: WorkSnapshot[]
  }
): Promise<CoverChoice[]> {
  const workIds = normalizeWorkIdList(input.workIds)
  if (workIds.length === 0) return []

  const snapshots = normalizeWorkSnapshots(input.workSnapshots ?? [])
  const snapshotByWorkId = new Map(snapshots.map((snapshot) => [snapshot.workId, snapshot]))

  const { data: existingRows, error: existingError } = await admin
    .from("work_cover_cache")
    .select("id,work_id,source,source_cover_key,remote_url,cached_file_path,cached_public_url")
    .in("work_id", workIds)

  if (existingError) {
    console.error("Failed to load cached work covers", existingError)
  }

  const existingChoices = (existingRows ?? [])
    .map((row: any) => toCoverChoice(row as WorkCoverCacheRow))
    .filter((row: CoverChoice | null): row is CoverChoice => Boolean(row))

  const choicesByWorkId = new Map<string, CoverChoice[]>()
  for (const choice of existingChoices) {
    const list = choicesByWorkId.get(choice.workId) ?? []
    list.push(choice)
    choicesByWorkId.set(choice.workId, list)
  }

  const workIdsMissingOpenLibrary = workIds.filter((workId) => {
    return !(choicesByWorkId.get(workId) ?? []).some((choice) => choice.source === "openlibrary")
  })
  const workIdsMissingGoogle = workIds.filter((workId) => {
    return !(choicesByWorkId.get(workId) ?? []).some((choice) => choice.source === "google")
  })

  const googleThumbByWorkId = new Map<string, string>()
  if (workIdsMissingGoogle.length > 0) {
    const { data: editionRows } = await admin
      .from("editions")
      .select("work_id,raw_google_data")
      .in("work_id", workIdsMissingGoogle)

    for (const row of editionRows ?? []) {
      const workId = typeof (row as any)?.work_id === "string" ? (row as any).work_id.trim() : ""
      if (!workId || googleThumbByWorkId.has(workId)) continue
      const thumbnailUrl = normalizeGoogleThumbnailUrl((row as any)?.raw_google_data)
      if (thumbnailUrl) googleThumbByWorkId.set(workId, thumbnailUrl)
    }
  }

  for (const workId of workIdsMissingOpenLibrary) {
    const coverCandidates = await fetchOpenLibraryWorkCoverCandidatesByWorkId(workId)
    const limitedCoverCandidates = coverCandidates.slice(0, MAX_OPEN_LIBRARY_COVER_CHOICES_PER_WORK)

    for (const coverCandidate of limitedCoverCandidates) {
      const choice = await cacheOpenLibraryCover(admin, {
        workId,
        sourceCoverKey: coverCandidate.sourceCoverKey,
        remoteUrl: coverCandidate.remoteUrl,
      })
      if (choice) appendCoverChoice(choicesByWorkId, choice)
    }
  }

  for (const workId of workIdsMissingGoogle) {
    const googleThumbnailUrl = googleThumbByWorkId.get(workId)
    const snapshotCoverUrl = snapshotByWorkId.get(workId)?.coverUrl ?? null
    const fallbackGoogleUrl = googleThumbnailUrl ?? (snapshotCoverUrl?.includes("google") ? snapshotCoverUrl : null)
    if (!fallbackGoogleUrl) continue

    const choice = await cacheGoogleThumbnailReference(admin, {
      workId,
      thumbnailUrl: fallbackGoogleUrl,
    })
    if (choice) appendCoverChoice(choicesByWorkId, choice)
  }

  return dedupeCoverChoices(
    workIds.flatMap((workId) => choicesByWorkId.get(workId) ?? [])
  )
}
