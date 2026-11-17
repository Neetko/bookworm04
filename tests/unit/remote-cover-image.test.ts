import { afterEach, describe, expect, it, vi } from "vitest"
import sharp from "sharp"
import { fetchRemoteCoverImage, isAllowedOpenLibraryCoverUrl } from "@/lib/remote-cover-image"

const COVER_URL = "https://covers.openlibrary.org/b/id/123456-L.jpg?default=false"

describe("remote cover images", () => {
  afterEach(() => vi.restoreAllMocks())

  it("only accepts the expected HTTPS Open Library cover path", () => {
    expect(isAllowedOpenLibraryCoverUrl(COVER_URL)).toBe(true)
    expect(isAllowedOpenLibraryCoverUrl("http://covers.openlibrary.org/b/id/123456-L.jpg?default=false")).toBe(false)
    expect(isAllowedOpenLibraryCoverUrl("https://covers.openlibrary.org.evil.test/b/id/123456-L.jpg?default=false")).toBe(false)
    expect(isAllowedOpenLibraryCoverUrl("https://covers.openlibrary.org@127.0.0.1/b/id/123456-L.jpg?default=false")).toBe(false)
    expect(isAllowedOpenLibraryCoverUrl("https://covers.openlibrary.org/b/id/../private?default=false")).toBe(false)
  })

  it("reencodes a valid raster response and refuses redirects", async () => {
    const input = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } })
      .png()
      .toBuffer()
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(input, {
      headers: { "content-type": "image/jpeg" },
    }))

    const result = await fetchRemoteCoverImage(COVER_URL)
    expect((await sharp(result).metadata()).format).toBe("webp")
    expect(fetchMock).toHaveBeenCalledWith(COVER_URL, expect.objectContaining({ redirect: "error" }))
  })

  it("rejects claimed image content that is actually markup", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<svg onload='alert(1)'></svg>", {
      headers: { "content-type": "image/jpeg" },
    }))
    await expect(fetchRemoteCoverImage(COVER_URL)).rejects.toThrow("not a supported raster image")
  })

  it("rejects oversized declared and streamed responses", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("x", {
        headers: { "content-length": String(8 * 1024 * 1024 + 1) },
      }))
      .mockResolvedValueOnce(new Response(Buffer.alloc(8 * 1024 * 1024 + 1)))

    await expect(fetchRemoteCoverImage(COVER_URL)).rejects.toThrow("size limit")
    await expect(fetchRemoteCoverImage(COVER_URL)).rejects.toThrow("size limit")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not follow a cover-service redirect", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: "http://127.0.0.1/private" },
    }))
    await expect(fetchRemoteCoverImage(COVER_URL)).rejects.toThrow("Remote cover failed")
  })
})
