import { createAdminSupabaseClient } from "../../server/supabase-admin.server"
import { readBoundedJson } from "../../server/bounded-json.server"
import { safePublicImageUrl } from "../../server/images.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"
import { GENRES, normalizeGenres, type CatalogSearch, type Genre } from "./catalog"

type GoogleVolume = {
  id?: unknown
  volumeInfo?: {
    title?: unknown
    authors?: unknown
    description?: unknown
    publishedDate?: unknown
    imageLinks?: { thumbnail?: unknown; smallThumbnail?: unknown }
    industryIdentifiers?: unknown
  }
}

type GoogleList = { items?: unknown }

export type ExternalCatalogTitle = {
  volumeId: string
  title: string
  author: string
  description: string | null
  coverUrl: string | null
  year: number | null
  localTitleId: string | null
}

export type ExternalSearchStatus = "idle" | "query-required" | "signed-out" | "unavailable" | "ok"

const volumeIdPattern = /^[A-Za-z0-9_-]{1,200}$/
const json = (body: unknown, status = 200) => Response.json(body, { status })
const cleanText = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\0/g, "").trim().slice(0, max) : ""

function parseYear(value: unknown) {
  if (typeof value !== "string") return null
  const match = /^(\d{4})/.exec(value)
  const year = match ? Number(match[1]) : NaN
  return Number.isInteger(year) && year >= 1000 && year <= new Date().getUTCFullYear() + 5 ? year : null
}

function parseIsbn(value: unknown) {
  if (!Array.isArray(value)) return null
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || !("identifier" in entry)) continue
    const isbn = cleanText(entry.identifier, 32).replace(/[\s-]/g, "")
    if (/^(?:\d{13}|\d{9}[\dXx])$/.test(isbn)) return isbn
  }
  return null
}

function toExternalTitle(raw: unknown): Omit<ExternalCatalogTitle, "localTitleId"> | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as GoogleVolume
  const volumeId = cleanText(item.id, 200)
  const title = cleanText(item.volumeInfo?.title, 300)
  if (!volumeIdPattern.test(volumeId) || !title) return null
  const authors = Array.isArray(item.volumeInfo?.authors) ? item.volumeInfo.authors : []
  const author = cleanText(authors[0], 300) || "Unknown author"
  const rawCover = cleanText(item.volumeInfo?.imageLinks?.thumbnail ?? item.volumeInfo?.imageLinks?.smallThumbnail, 2_000).replace(/^http:/, "https:")
  return {
    volumeId,
    title,
    author,
    description: cleanText(item.volumeInfo?.description, 20_000) || null,
    coverUrl: safePublicImageUrl(rawCover),
    year: parseYear(item.volumeInfo?.publishedDate),
  }
}

async function fetchGoogleJson(url: URL): Promise<unknown | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7_000)
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
    if (!response.ok) return null
    const stated = Number(response.headers.get("content-length"))
    if (Number.isFinite(stated) && stated > 1_500_000) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > 1_500_000) return null
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function googleUrl(path = "") {
  const url = new URL(`https://www.googleapis.com/books/v1/volumes${path}`)
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY
  if (apiKey) url.searchParams.set("key", apiKey)
  return url
}

async function authenticatedProfile() {
  const supabase = createRequestSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle()
  return profile?.id ? { supabase, profileId: profile.id as string } : null
}

export async function searchExternalCatalog(input: CatalogSearch): Promise<{ status: ExternalSearchStatus; titles: ExternalCatalogTitle[] }> {
  if (!input.includeExternal) return { status: "idle", titles: [] }
  const query = [input.title || input.q ? `intitle:${input.title || input.q}` : "", input.author ? `inauthor:${input.author}` : ""].filter(Boolean).join(" ")
  if (!query) return { status: "query-required", titles: [] }
  const identity = await authenticatedProfile()
  if (!identity) return { status: "signed-out", titles: [] }
  const url = googleUrl()
  url.searchParams.set("q", query.slice(0, 220))
  url.searchParams.set("printType", "books")
  url.searchParams.set("orderBy", "relevance")
  url.searchParams.set("maxResults", "12")
  const payload = await fetchGoogleJson(url) as GoogleList | null
  if (!payload || !Array.isArray(payload.items)) return { status: "unavailable", titles: [] }
  const unique = new Map<string, Omit<ExternalCatalogTitle, "localTitleId">>()
  for (const item of payload.items) {
    const parsed = toExternalTitle(item)
    if (parsed && !unique.has(parsed.volumeId)) unique.set(parsed.volumeId, parsed)
  }
  const titles = [...unique.values()].slice(0, 12)
  const admin = createAdminSupabaseClient()
  const mapped = new Map<string, string>()
  if (admin && titles.length) {
    const { data } = await admin.from("title_sources").select("external_id,title_id").eq("source", "google").in("external_id", titles.map((title) => title.volumeId))
    for (const row of data ?? []) mapped.set(row.external_id, row.title_id)
  }
  return { status: "ok", titles: titles.map((title) => ({ ...title, localTitleId: mapped.get(title.volumeId) ?? null })) }
}

async function fetchGoogleVolume(volumeId: string) {
  const payload = await fetchGoogleJson(googleUrl(`/${encodeURIComponent(volumeId)}`))
  if (!payload || typeof payload !== "object") return null
  const title = toExternalTitle(payload)
  if (!title || title.volumeId !== volumeId) return null
  const info = (payload as GoogleVolume).volumeInfo
  return { ...title, isbn: parseIsbn(info?.industryIdentifiers) }
}

export async function handleExternalCatalogIngest(request: Request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const identity = await authenticatedProfile()
  if (!identity) return json({ error: "Sign in required" }, 401)
  const body = await readBoundedJson(request, 8_000)
  if (!body.ok) return json({ error: body.error }, body.status)
  const source = body.value && typeof body.value === "object" && !Array.isArray(body.value) ? body.value as Record<string, unknown> : {}
  const volumeId = cleanText(source.volumeId, 200)
  const genres = normalizeGenres(Array.isArray(source.genres) ? source.genres.join(",") : "")
  if (!volumeIdPattern.test(volumeId) || genres.length < 1 || genres.length > GENRES.length) return json({ error: "Choose at least one valid genre" }, 400)
  const admin = createAdminSupabaseClient()
  if (!admin) return json({ error: "Catalog service is not configured" }, 503)
  const volume = await fetchGoogleVolume(volumeId)
  if (!volume) return json({ error: "Could not verify that Google Books title" }, 502)

  const { data: existingSource } = await admin.from("title_sources").select("title_id").eq("source", "google").eq("external_id", volumeId).maybeSingle()
  let titleId = existingSource?.title_id as string | undefined
  let insertedTitleId: string | null = null
  if (!titleId) {
    const { data: duplicate } = await admin.from("titles").select("id").eq("title", volume.title).eq("author", volume.author).order("created_at", { ascending: true }).limit(1).maybeSingle()
    titleId = duplicate?.id as string | undefined
  }
  if (!titleId) {
    const { data, error } = await admin.from("titles").insert({ title: volume.title, author: volume.author, description: volume.description, cover_image_url: volume.coverUrl, published_year: volume.year, isbn: volume.isbn }).select("id").single()
    if (error || !data?.id) return json({ error: "Could not create catalog title" }, 500)
    titleId = data.id
    insertedTitleId = data.id
  }

  const { error: mappingError } = await admin.from("title_sources").upsert({ source: "google", external_id: volumeId, title_id: titleId }, { onConflict: "source,external_id", ignoreDuplicates: true })
  if (mappingError) return json({ error: "Could not save title source" }, 500)
  const { data: canonicalSource } = await admin.from("title_sources").select("title_id").eq("source", "google").eq("external_id", volumeId).single()
  const canonicalTitleId = canonicalSource?.title_id as string | undefined
  if (!canonicalTitleId) return json({ error: "Could not confirm title source" }, 500)
  if (insertedTitleId && canonicalTitleId !== insertedTitleId) await admin.from("titles").delete().eq("id", insertedTitleId)
  titleId = canonicalTitleId

  const { data: existingSuggestion } = await identity.supabase.from("suggestions").select("id,status").eq("title_id", titleId).eq("suggested_by_profile_id", identity.profileId).eq("status", "pending").limit(1).maybeSingle()
  if (!existingSuggestion) {
    const { error } = await identity.supabase.from("suggestions").insert({ title_id: titleId, suggested_by_profile_id: identity.profileId, suggested_genres: genres as Genre[] })
    if (error) return json({ error: "Could not submit the title for review" }, 500)
  }
  return json({ titleId, pendingReview: true })
}
