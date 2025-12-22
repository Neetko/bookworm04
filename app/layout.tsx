import type React from "react"
import type { Metadata } from "next"
import { IM_Fell_English_SC, IM_Fell_English, Source_Code_Pro } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/lib/auth-provider"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"

const fontSans = IM_Fell_English_SC({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-sans",
})

const fontSerif = IM_Fell_English({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
})

const fontMono = Source_Code_Pro({
  subsets: ["latin"],
  variable: "--font-mono",
})

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
      <body className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} font-sans antialiased`}>
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
