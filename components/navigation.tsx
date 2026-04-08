"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BookOpen, Bell, LogOut, Mail, User } from "lucide-react"
import { useAuth } from "@/lib/auth-provider"
import { supabase } from "@/lib/supabase-browser"
import { AuthModal } from "@/components/auth-modal"
import { ModeToggle } from "@/components/mode-toggle"

export function Navigation() {
  const { user, signOut } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authView, setAuthView] = useState<"sign_in" | "sign_up">("sign_in")
  const [profile, setProfile] = useState<{ username: string | null; avatar_url: string | null } | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      if (!user) {
        if (isMounted) setProfile(null)
        return
      }

      const { data } = await supabase
        .from("user_profiles")
        .select("username, avatar_url")
        .eq("auth_user_id", user.id)
        .maybeSingle()

      if (isMounted) setProfile(data ?? null)
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [user])

  const getInitials = (name?: string | null) => {
    const normalized = name?.trim() ?? ""
    if (!normalized) return "?"
    const parts = normalized.split(/\s+/).filter(Boolean)
    const initials =
      parts.length >= 2
        ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`
        : normalized.slice(0, 2)
    return initials.toUpperCase()
  }

  const displayName = profile?.username ?? user?.email?.split("@")[0] ?? "Account"

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
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Home
            </Link>
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
                <Link href="/diary" className="text-muted-foreground hover:text-foreground">
                  Diary
                </Link>
                <Link href="/search-titles" className="text-muted-foreground hover:text-foreground">
                  Search Titles
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                      <Avatar className="h-7 w-7 border">
                        <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
                        <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                      </Avatar>
                      <span className="max-w-[140px] truncate text-sm font-medium">
                        {displayName}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex items-center">
                        <User className="h-4 w-4" />
                        <span>View Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                      <Bell className="h-4 w-4" />
                      <span>Notifications</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/messages" className="flex items-center">
                        <Mail className="h-4 w-4" />
                        <span>Messages</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut}>
                      <LogOut className="h-4 w-4" />
                      <span>Log Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
