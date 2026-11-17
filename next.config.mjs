/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : null

const nextConfig = {
  images: {
    formats: ["image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "covers.openlibrary.org" },
      { protocol: "https", hostname: "books.google.com" },
      { protocol: "https", hostname: "books.googleusercontent.com" },
      ...(supabaseHostname?.endsWith(".supabase.co")
        ? [{ protocol: "https", hostname: supabaseHostname }]
        : []),
    ],
  },
}

export default nextConfig
