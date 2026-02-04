const SUPPORTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"])

let sharpPromise: Promise<any> | null = null

async function getSharp() {
  if (!sharpPromise) {
    sharpPromise = import("sharp")
  }
  const mod = await sharpPromise
  return mod.default ?? mod
}

export type AvatarImageOutput = {
  buffer: Buffer
  contentType: string
  ext: string
}

export async function resizeAvatarImage(file: File, size = 200): Promise<AvatarImageOutput> {
  if (!SUPPORTED_TYPES.has(file.type)) {
    throw new Error("Unsupported image type")
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer())
  const isGif = file.type === "image/gif"
  let sharp
  try {
    sharp = await getSharp()
  } catch (error) {
    throw new Error("Image processor unavailable")
  }

  const base = sharp(inputBuffer, isGif ? { animated: true } : undefined)
  const resized = base.resize(size, size, { fit: "cover", position: "center" })

  if (file.type === "image/png") {
    return {
      buffer: await resized.png().toBuffer(),
      contentType: "image/png",
      ext: "png",
    }
  }

  if (file.type === "image/webp") {
    return {
      buffer: await resized.webp({ quality: 90 }).toBuffer(),
      contentType: "image/webp",
      ext: "webp",
    }
  }

  if (file.type === "image/gif") {
    return {
      buffer: await resized.gif({ loop: 0 }).toBuffer(),
      contentType: "image/gif",
      ext: "gif",
    }
  }

  return {
    buffer: await resized.jpeg({ quality: 90 }).toBuffer(),
    contentType: "image/jpeg",
    ext: "jpg",
  }
}
