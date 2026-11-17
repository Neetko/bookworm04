import { BookOpen } from "lucide-react"

export default function Loading() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-16" aria-busy="true">
      <section
        className="w-full max-w-2xl rounded-lg border bg-card p-6 text-card-foreground shadow-sm sm:p-8"
        aria-labelledby="loading-heading"
      >
        <div className="mb-8 flex items-center gap-3 text-primary">
          <BookOpen aria-hidden="true" className="h-8 w-8" />
          <h1 id="loading-heading" className="text-xl font-semibold sm:text-2xl">
            Opening Bookworm
          </h1>
        </div>

        <div className="space-y-5 animate-pulse" aria-hidden="true">
          <div className="h-8 w-3/5 rounded bg-muted" />
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-5/6 rounded bg-muted" />
          </div>
          <div className="grid grid-cols-2 gap-4 pt-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="aspect-[2/3] rounded-md bg-muted" />
            ))}
          </div>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          Loading Bookworm content.
        </p>
      </section>
    </main>
  )
}
