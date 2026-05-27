import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <span>Bookworm</span>
        <nav aria-label="Footer navigation" className="flex items-center gap-4">
          <Link href="/about" className="hover:text-foreground">
            About
          </Link>
        </nav>
      </div>
    </footer>
  )
}
