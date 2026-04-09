import { Navigation } from "@/components/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { BookOpen, Users, Star, TrendingUp } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">About Bookworm</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your digital companion for discovering, reviewing, and organizing your reading journey.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <Card className="border-2">
            <CardContent className="p-6">
              <BookOpen className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-3">Discover Books</h3>
              <p className="text-muted-foreground">
                Explore our vast library of books across all genres. From classic literature to contemporary fiction,
                find your next great read with our intuitive search and filtering system.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <Star className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-3">Rate & Review</h3>
              <p className="text-muted-foreground">
                Share your thoughts and help fellow readers discover amazing books. Rate books on a scale of 1-10 and
                write detailed reviews to guide others in their reading choices.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <Users className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-3">Join the Community</h3>
              <p className="text-muted-foreground">
                Connect with passionate readers from around the world. Discover new perspectives, engage in meaningful
                discussions, and build your reading network within our vibrant community.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <TrendingUp className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-3">Track Your Progress</h3>
              <p className="text-muted-foreground">
                Keep track of your reading journey with personalized statistics and favorites. Set reading
                goals and celebrate your literary achievements as you explore new worlds.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-2">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-3xl mx-auto">
              At Bookworm, we believe that every book has the power to transform lives, spark imagination, and connect
              people across cultures and generations. Our mission is to create a platform where readers can discover
              their next favorite book, share their passion for literature, and build meaningful connections with fellow
              book lovers around the world.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
