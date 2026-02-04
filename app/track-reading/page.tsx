import { redirect } from "next/navigation"
export default async function TrackReadingRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const params = await searchParams
  const q = params.q?.trim()

  if (q) {
    redirect(`/search-titles?q=${encodeURIComponent(q)}`)
  }

  redirect("/search-titles")
}
