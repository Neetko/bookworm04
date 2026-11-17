const SUPPORTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"])
const MAX_AVATAR_INPUT_BYTES = 5 * 1024 * 1024
const MAX_AVATAR_OUTPUT_BYTES = 5 * 1024 * 1024
const MAX_AVATAR_DIMENSION = 4_096
const MAX_AVATAR_TOTAL_PIXELS = 20_000_000
const MAX_AVATAR_FRAMES = 20

function hasExpectedSignature(input: Buffer, contentType: string): boolean {
  if (contentType === "image/jpeg") {
    return input.length >= 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff
  }
  if (contentType === "image/png") {
    return input.length >= 8 && input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  }
  if (contentType === "image/webp") {
    return input.length >= 12
      && input.toString("ascii", 0, 4) === "RIFF"
      && input.toString("ascii", 8, 12) === "WEBP"
  }
  return input.length >= 6
    && (input.toString("ascii", 0, 6) === "GIF87a" || input.toString("ascii", 0, 6) === "GIF89a")
}

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
  if (file.size === 0 || file.size > MAX_AVATAR_INPUT_BYTES) {
    throw new Error("Avatar exceeds input size limit")
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer())
  if (!hasExpectedSignature(inputBuffer, file.type)) {
    throw new Error("Avatar file does not match its image type")
  }
  const isGif = file.type === "image/gif"
  let sharp
  try {
    sharp = await getSharp()
  } catch (error) {
    throw new Error("Image processor unavailable")
  }

  const base = sharp(inputBuffer, { animated: isGif, limitInputPixels: MAX_AVATAR_TOTAL_PIXELS, failOn: "error" })
  const metadata = await base.metadata()
  const expectedFormat = file.type.slice("image/".length)
  const pageHeight = metadata.pageHeight ?? metadata.height
  const pages = metadata.pages ?? 1
  if (metadata.format !== expectedFormat
    || !metadata.width || !metadata.height || !pageHeight
    || metadata.width > MAX_AVATAR_DIMENSION || pageHeight > MAX_AVATAR_DIMENSION
    || pages > MAX_AVATAR_FRAMES
    || metadata.width * pageHeight * pages > MAX_AVATAR_TOTAL_PIXELS) {
    throw new Error("Avatar image exceeds decode limits")
  }

  const resized = base.resize(size, size, { fit: "cover", position: "center" })
  let output: AvatarImageOutput

  if (file.type === "image/png") {
    output = {
      buffer: await resized.png().toBuffer(),
      contentType: "image/png",
      ext: "png",
    }
  } else if (file.type === "image/webp") {
    output = {
      buffer: await resized.webp({ quality: 90 }).toBuffer(),
      contentType: "image/webp",
      ext: "webp",
    }
  } else if (file.type === "image/gif") {
    output = {
      buffer: await resized.gif({ loop: 0 }).toBuffer(),
      contentType: "image/gif",
      ext: "gif",
    }
  } else {
    output = {
      buffer: await resized.jpeg({ quality: 90 }).toBuffer(),
      contentType: "image/jpeg",
      ext: "jpg",
    }
  }

  if (output.buffer.length > MAX_AVATAR_OUTPUT_BYTES) throw new Error("Avatar exceeds output size limit")
  return output
}
