import { Navigation } from "@/components/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { BookOpen, Users, Star, TrendingUp } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="text-center mb-12">
          <p className="font-ui mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Reading is better with context
          </p>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">About Bookworm</h1>
          <p className="font-ui mx-auto mt-5 max-w-[62ch] text-lg leading-8 text-muted-foreground">
            Bookworm brings discovery, reading progress, thoughtful discussion, and clubs into one place—without
            hiding the catalog from people who just want to look around.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <Card className="border-2">
            <CardContent className="p-6">
              <BookOpen aria-hidden="true" className="h-10 w-10 text-primary mb-4" />
              <h2 className="text-xl font-semibold mb-3">Find your next title</h2>
              <p className="font-ui leading-7 text-muted-foreground">
                Browse the local catalog by title, author, or genre. Signed-in readers can also search external sources
                and suggest missing titles for the maintained catalog.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <TrendingUp aria-hidden="true" className="h-10 w-10 text-primary mb-4" />
              <h2 className="text-xl font-semibold mb-3">Keep a useful reading record</h2>
              <p className="font-ui leading-7 text-muted-foreground">
                Record page or listening progress, add diary notes, and organize titles into current, finished, and
                custom reading lists.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <Star aria-hidden="true" className="h-10 w-10 text-primary mb-4" />
              <h2 className="text-xl font-semibold mb-3">Discuss what you finish</h2>
              <p className="font-ui leading-7 text-muted-foreground">
                Read public reviews and discussions before signing in. Marking a title as read unlocks rating, review,
                and discussion contributions.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <Users aria-hidden="true" className="h-10 w-10 text-primary mb-4" />
              <h2 className="text-xl font-semibold mb-3">Build a reading community</h2>
              <p className="font-ui leading-7 text-muted-foreground">
                Join or create book and writers’ clubs with open, approval-based, or invitation-only membership.
                Clubs can coordinate reading plans or share member writing.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-2">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Try the complete path</h2>
            <p className="font-ui text-muted-foreground text-lg leading-relaxed max-w-3xl mx-auto">
              Start with the public catalog, open a title to see its reading context, then visit Community to compare
              book clubs and writers’ groups. Create an account only when you are ready to save progress or contribute.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/search-titles">Browse titles</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/community">Explore clubs</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
