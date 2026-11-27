import type { ReactNode } from "react"
import type { QueryClient } from "@tanstack/react-query"
import "../styles/global.css"
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  ScriptOnce,
} from "@tanstack/react-router"

const noIndex = import.meta.env.VITE_PUBLIC_ROBOTS_NOINDEX !== "false"

function configuredSupabaseImageOrigin() {
  const raw = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)) return null
    return url.origin
  } catch {
    return null
  }
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  headers: ({ ssr }) => {
    const nonce = ssr?.nonce
    if (!nonce) return
    const supabaseImages = configuredSupabaseImageOrigin()
    const imageSources = [
      "'self'",
      "data:",
      "https://covers.openlibrary.org",
      "https://books.google.com",
      "https://books.googleusercontent.com",
      ...(supabaseImages ? [supabaseImages] : []),
    ]

    return {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Security-Policy": [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        "script-src-attr 'none'",
        `style-src 'self' 'nonce-${nonce}'`,
        `img-src ${imageSources.join(" ")}`,
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        `form-action 'self' ${[supabaseImages, "https://accounts.google.com"].filter(Boolean).join(" ")}`,
        "frame-ancestors 'none'",
      ].join("; "),
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Bookworm — Reading progress, discussion, and clubs" },
      { name: "description", content: "Discover titles, track reading progress, keep a reading diary, exchange recommendations, and join book or writers' clubs." },
      { name: "referrer", content: "strict-origin-when-cross-origin" },
      { name: "robots", content: noIndex ? "noindex, nofollow" : "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Bookworm" },
      { property: "og:title", content: "Bookworm — Reading progress, discussion, and clubs" },
      { property: "og:description", content: "Discover titles, track reading progress, exchange recommendations, and take part in reading communities." },
    ],
  }),
  component: Root,
})

function Root() {
  return (
    <Document>
      <Outlet />
    </Document>
  )
}

function Document({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <ScriptOnce children="try{if(localStorage.getItem('bookworm-theme')==='light')document.documentElement.dataset.theme='light'}catch(e){}" />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
