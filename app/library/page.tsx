import { redirect } from "next/navigation"

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; g?: string }>
}) {
  await searchParams
  redirect("/search-titles")
}
