import Link from "next/link"
import { redirect } from "next/navigation"
import { getOnboardingBootstrapData } from "@/app/actions/onboarding"
import { OnboardingClient } from "@/components/onboarding-client"
import { BookOpen } from "lucide-react"
import { createServerClient } from "@/lib/supabase-server"

export default async function OnboardingPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth")
  }

  const data = await getOnboardingBootstrapData()

  if (!data.profile.needsOnboarding) {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 text-foreground">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold">BOOKWORM</span>
          </Link>
          <p className="text-sm text-muted-foreground">Welcome, new reader.</p>
        </div>
      </header>

      <OnboardingClient
        initialUsername={data.profile.hasPlaceholderUsername ? "" : data.profile.username}
        initialTitles={data.initialTitles}
      />
    </div>
  )
}
