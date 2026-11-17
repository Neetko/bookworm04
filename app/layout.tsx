import type React from "react"
import Script from "next/script"
import type { Metadata } from "next"
import "@fontsource/im-fell-english-sc/400.css"
import "@fontsource/raleway/400.css"
import "@fontsource/raleway/500.css"
import "@fontsource/raleway/600.css"
import "./globals.css"
import { AuthProvider } from "@/lib/auth-provider"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://bookworm04.vercel.app"),
  title: {
    default: "Bookworm — Reading progress, discussion, and clubs",
    template: "%s | Bookworm",
  },
  description:
    "Discover titles, track reading progress, keep a reading diary, exchange recommendations, and join book or writers’ clubs.",
  openGraph: {
    type: "website",
    title: "Bookworm — Reading progress, discussion, and clubs",
    description:
      "Discover titles, track reading progress, exchange recommendations, and take part in reading communities.",
    siteName: "Bookworm",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
        >
          <AuthProvider>
            {children}
            <SiteFooter />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
