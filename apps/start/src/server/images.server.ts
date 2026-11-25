const externalCoverHosts = new Set([
  "covers.openlibrary.org",
  "books.google.com",
  "books.googleusercontent.com",
])

export function safePublicImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null

  try {
    const url = new URL(raw)
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null

    const supabaseOrigin = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    const storageHost = supabaseOrigin ? new URL(supabaseOrigin).hostname : null
    if (
      storageHost &&
      url.hostname === storageHost &&
      url.pathname.startsWith("/storage/v1/object/public/")
    ) {
      return url.toString()
    }

    return externalCoverHosts.has(url.hostname) ? url.toString() : null
  } catch {
    return null
  }
}
