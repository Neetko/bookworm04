import type { ImgHTMLAttributes } from "react"

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> & { src: string }

function responsiveSources(raw: string) {
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:") return undefined
    if (url.hostname === "covers.openlibrary.org" && /-[SML]\.jpg$/.test(url.pathname)) {
      const base = url.pathname.replace(/-[SML]\.jpg$/, "")
      const query = url.search
      return [`${url.origin}${base}-S.jpg${query} 96w`, `${url.origin}${base}-M.jpg${query} 180w`, `${url.origin}${base}-L.jpg${query} 500w`].join(", ")
    }
    if (url.hostname === "books.google.com" && url.pathname === "/books/content" && url.searchParams.has("id")) {
      const candidate = (zoom: number, width: number) => { const next = new URL(url); next.searchParams.set("zoom", String(zoom)); return `${next.toString()} ${width}w` }
      return [candidate(1, 128), candidate(2, 256), candidate(3, 512)].join(", ")
    }
  } catch {
    return undefined
  }
  return undefined
}

export function BookCover({ src, alt = "", sizes, referrerPolicy = "no-referrer", ...props }: Props) {
  return <img {...props} src={src} srcSet={responsiveSources(src)} sizes={sizes ?? `${props.width ?? 180}px`} alt={alt} referrerPolicy={referrerPolicy} />
}
