import Link from "next/link"
import { BookOpen, Search } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <section
        className="w-full max-w-xl rounded-lg border bg-card p-8 text-center text-card-foreground shadow-sm sm:p-10"
        aria-labelledby="not-found-heading"
      >
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-primary">
          <BookOpen aria-hidden="true" className="h-7 w-7" />
        </div>
        <p className="font-ui mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">404 · Page not found</p>
        <h1 id="not-found-heading" className="text-balance text-3xl font-semibold sm:text-4xl">
          This page is not on the shelf
        </h1>
        <p className="font-ui mx-auto mt-4 max-w-md leading-7 text-muted-foreground">
          The link may be out of date, or the page may have moved. Search the catalog or return home to find your way
          back.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/search-titles">
              <Search aria-hidden="true" />
              Search titles
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Return home</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
