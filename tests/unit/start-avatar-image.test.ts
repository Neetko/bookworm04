import { describe, expect, it } from "vitest"
import { resizeAvatarImage } from "../../apps/start/src/server/avatar-image.server"

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
)

describe("TanStack avatar image processing", () => {
  it("decodes and re-encodes a valid image to the fixed avatar size", async () => {
    const file = new File([onePixelPng], "avatar.png", { type: "image/png" })
    const result = await resizeAvatarImage(file, 200)
    expect(result.contentType).toBe("image/png")
    expect(result.ext).toBe("png")
    expect(result.buffer.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    expect(result.buffer.length).toBeGreaterThan(8)
  })

  it("rejects a declared image whose bytes do not match", async () => {
    const file = new File(["not an image"], "avatar.png", { type: "image/png" })
    await expect(resizeAvatarImage(file)).rejects.toThrow("does not match")
  })
})
