import { describe, expect, it } from "vitest"
import sharp from "sharp"
import { resizeAvatarImage } from "@/lib/avatar-image"

describe("avatar image processing", () => {
  it("decodes and resizes a valid PNG", async () => {
    const input = await sharp({ create: { width: 4, height: 4, channels: 3, background: "red" } })
      .png()
      .toBuffer()
    const result = await resizeAvatarImage(new File([input], "avatar.png", { type: "image/png" }))
    const metadata = await sharp(result.buffer).metadata()

    expect(result.contentType).toBe("image/png")
    expect(metadata.format).toBe("png")
    expect(metadata.width).toBe(200)
    expect(metadata.height).toBe(200)
  })

  it("rejects an SVG disguised as a PNG before decoding", async () => {
    const file = new File(["<svg xmlns='http://www.w3.org/2000/svg'></svg>"], "avatar.png", {
      type: "image/png",
    })
    await expect(resizeAvatarImage(file)).rejects.toThrow("does not match")
  })

  it("rejects unusually large image dimensions", async () => {
    const input = await sharp({ create: { width: 4097, height: 1, channels: 3, background: "red" } })
      .png()
      .toBuffer()
    const file = new File([input], "wide.png", { type: "image/png" })
    await expect(resizeAvatarImage(file)).rejects.toThrow("decode limits")
  })

  it("rejects inputs above the upload size cap", async () => {
    const file = new File([Buffer.alloc(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })
    await expect(resizeAvatarImage(file)).rejects.toThrow("input size limit")
  })
})
