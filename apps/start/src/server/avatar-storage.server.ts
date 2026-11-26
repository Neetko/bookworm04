type AvatarBucket = "user-avatars" | "club-avatars"

export function getOwnedAvatarObjectPath(
  publicUrl: string | null | undefined,
  bucket: AvatarBucket,
  ownerPrefix: string,
): string | null {
  if (!publicUrl) return null

  try {
    const storageOrigin = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!storageOrigin) return null
    const storageBase = new URL(storageOrigin)
    const url = new URL(publicUrl)
    const pathPrefix = `/storage/v1/object/public/${bucket}/`
    if (url.origin !== storageBase.origin || !url.pathname.startsWith(pathPrefix)) return null

    const objectPath = decodeURIComponent(url.pathname.slice(pathPrefix.length))
    const ownedPrefix = `${ownerPrefix}/`
    if (!objectPath.startsWith(ownedPrefix)) return null

    const filename = objectPath.slice(ownedPrefix.length)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:png|jpg|webp|gif)$/.test(filename)) {
      return null
    }
    return objectPath
  } catch {
    return null
  }
}
