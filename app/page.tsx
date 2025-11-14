import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Navigation } from "@/components/navigation"
import { BookOpen, Star, Users } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3E2723] to-[#795548]">
      <Navigation />

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-[#D4AF37] mb-6">Welcome! Ready to start reading?</h1>
          <p className="text-xl text-[#A1887F] mb-8 max-w-2xl mx-auto">
            Discover your next favorite book, share reviews with fellow readers, and build your personal library of
            literary adventures.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button size="lg" asChild className="text-lg px-8 py-3 bg-[#6D4C41] text-[#FFD700] hover:bg-[#4E342E]">
              <Link href="/library">Browse Library</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-lg px-8 py-3 border-[#D4AF37] text-[#D4AF37] bg-transparent hover:bg-[#3E2723]">
              <Link href="/auth">Join Now</Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="text-center p-6 bg-[#4E342E] rounded-lg shadow-md">
            <BookOpen className="h-12 w-12 text-[#FFD700] mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-[#FFD700]">Vast Library</h3>
            <p className="text-[#D7CCC8]">
              Explore thousands of books across all genres and discover your next great read.
            </p>
          </div>

          <div className="text-center p-6 bg-[#6D4C41] rounded-lg shadow-md">
            <Star className="h-12 w-12 text-[#D4AF37] mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-[#D4AF37]">Rate & Review</h3>
            <p className="text-[#D7CCC8]">Share your thoughts and help other readers find their perfect books.</p>
          </div>

          <div className="text-center p-6 bg-[#795548] rounded-lg shadow-md">
            <Users className="h-12 w-12 text-[#FFD700] mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-[#FFD700]">Community</h3>
            <p className="text-[#D7CCC8]">Connect with fellow book lovers and discover recommendations.</p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid md:grid-cols-3 gap-8 mt-16 text-center">
          <div>
            <div className="text-3xl font-bold text-[#FFD700]">10K+</div>
            <div className="text-[#D7CCC8]">Books Available</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#D4AF37]">5K+</div>
            <div className="text-[#D7CCC8]">Active Readers</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#FFD700]">25K+</div>
            <div className="text-[#D7CCC8]">Reviews Written</div>
          </div>
        </div>
      </div>
    </div>
  )
}
