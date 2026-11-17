"use client"

import { useEffect } from "react"
import Link from "next/link"
import { BookOpen, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <section
        className="w-full max-w-xl rounded-lg border bg-card p-8 text-center text-card-foreground shadow-sm sm:p-10"
        aria-labelledby="error-heading"
      >
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-primary">
          <BookOpen aria-hidden="true" className="h-7 w-7" />
        </div>
        <p className="font-ui mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Something went wrong
        </p>
        <h1 id="error-heading" className="text-balance text-3xl font-semibold sm:text-4xl">
          We lost our place for a moment
        </h1>
        <p className="font-ui mx-auto mt-4 max-w-md leading-7 text-muted-foreground">
          Your saved reading data is not affected. Try this page again, or return to the catalog and keep browsing.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" onClick={reset}>
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/search-titles">Browse titles</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
