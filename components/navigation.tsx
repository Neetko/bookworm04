"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BookOpen, User, LogOut } from "lucide-react"
import { useAuth } from "@/lib/auth-provider"
import { AuthModal } from "@/components/auth-modal"
import { ModeToggle } from "@/components/mode-toggle"

export function Navigation() {
  const { user, signOut } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authView, setAuthView] = useState<"sign_in" | "sign_up">("sign_in")

  const handleSignIn = () => {
    setAuthView("sign_in")
    setShowAuthModal(true)
  }

  const handleSignUp = () => {
    setAuthView("sign_up")
    setShowAuthModal(true)
  }

  return (
    <nav className="border-b bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">BOOKWORM</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <ModeToggle />
            <Link href="/about" className="text-muted-foreground hover:text-foreground">
              About
            </Link>
            <Link href="/community" className="text-muted-foreground hover:text-foreground">
              Community
            </Link>

            {user ? (
              <>
                <Link href="/library" className="text-muted-foreground hover:text-foreground">
                  Library
                </Link>
                <Link href="/search-titles" className="text-muted-foreground hover:text-foreground">
                  Search Titles
                </Link>
                <Link href="/profile" className="flex items-center space-x-1 text-muted-foreground hover:text-foreground">
                  <User className="h-4 w-4" />
                  <span>Profile</span>
                </Link>
                <Button variant="outline" size="sm" onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleSignIn}>Sign in</Button>
                <Button onClick={handleSignUp}>Sign up</Button>
              </>
            )}
          </div>
        </div>
      </div>
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} view={authView} />
    </nav>
  )
}
