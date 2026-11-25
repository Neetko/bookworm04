import type { ReactNode } from "react"
import "../styles/global.css"
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router"

export const Route = createRootRoute({
  headers: ({ ssr }) => {
    const nonce = ssr?.nonce
    if (!nonce) return

    return {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Security-Policy": [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        "script-src-attr 'none'",
        `style-src 'self' 'nonce-${nonce}'`,
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join("; "),
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Bookworm migration preview" },
      { name: "robots", content: "noindex, nofollow" },
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
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
