import type React from "react"
import type { Metadata } from "next"
import "@fontsource/im-fell-english-sc/400.css"
import "@fontsource/im-fell-english/400.css"
import "@fontsource/source-code-pro/400.css"
import "./globals.css"
import { AuthProvider } from "@/lib/auth-provider"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"

export const metadata: Metadata = {
  title: "Bookworm - Your Digital Reading Companion",
  description: "Discover, rate, and review books. Build your personal library and connect with fellow readers.",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
        >
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
