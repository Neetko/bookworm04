import "server-only"

import sharp from "sharp"

const MAX_REMOTE_COVER_BYTES = 8 * 1024 * 1024
const MAX_COVER_PIXELS = 16_000_000
const MAX_CACHED_COVER_BYTES = 4 * 1024 * 1024
const COVER_FETCH_TIMEOUT_MS = 8_000

export function isAllowedOpenLibraryCoverUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return url.protocol === "https:"
      && url.hostname === "covers.openlibrary.org"
      && url.port === ""
      && url.username === ""
      && url.password === ""
      && /^\/b\/id\/[1-9][0-9]{0,11}-L\.jpg$/.test(url.pathname)
      && url.search === "?default=false"
      && url.hash === ""
  } catch {
    return false
  }
}

function hasRasterImageSignature(input: Buffer): boolean {
  const jpeg = input.length >= 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff
  const png = input.length >= 8 && input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const webp = input.length >= 12
    && input.toString("ascii", 0, 4) === "RIFF"
    && input.toString("ascii", 8, 12) === "WEBP"
  return jpeg || png || webp
}

async function readBoundedBody(response: Response): Promise<Buffer> {
  const declaredLength = response.headers.get("content-length")
  if (declaredLength && Number(declaredLength) > MAX_REMOTE_COVER_BYTES) {
    throw new Error("Remote cover exceeds size limit")
  }
  if (!response.body) throw new Error("Remote cover has no body")

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let received = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > MAX_REMOTE_COVER_BYTES) {
        await reader.cancel()
        throw new Error("Remote cover exceeds size limit")
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }

  return Buffer.concat(chunks, received)
}

export async function fetchRemoteCoverImage(rawUrl: string): Promise<Buffer> {
  if (!isAllowedOpenLibraryCoverUrl(rawUrl)) throw new Error("Invalid Open Library cover URL")

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), COVER_FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(rawUrl, {
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Remote cover failed: ${response.status}`)

    const input = await readBoundedBody(response)
    if (!hasRasterImageSignature(input)) throw new Error("Remote cover is not a supported raster image")

    const image = sharp(input, { limitInputPixels: MAX_COVER_PIXELS, failOn: "error" })
    const metadata = await image.metadata()
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_COVER_PIXELS) {
      throw new Error("Remote cover exceeds pixel limit")
    }
    if ((metadata.pages ?? 1) !== 1) throw new Error("Animated remote covers are not supported")

    const output = await image
      .rotate()
      .resize({ width: 800, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
    if (output.length > MAX_CACHED_COVER_BYTES) throw new Error("Processed cover exceeds size limit")
    return output
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }
}
