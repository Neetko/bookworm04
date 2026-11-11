import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchExternalJson } from "@/lib/external-json"

describe("external JSON fetching", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("retries rate-limited requests and returns the eventual response", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, {
        status: 429,
        headers: { "retry-after": "0" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))

    await expect(fetchExternalJson("https://example.test/books", {
      source: "test API",
      retries: 1,
    })).resolves.toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not retry permanent client errors", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 404 }))

    await expect(fetchExternalJson("https://example.test/missing", {
      source: "test API",
      retries: 2,
    })).resolves.toBeNull()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
