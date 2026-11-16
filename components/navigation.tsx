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
import type { AppRole } from "@/lib/server/roles"
import { sanitizeUsernameInput } from "@/lib/onboarding"

export function Navigation() {
  const { user, signOut } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authView, setAuthView] = useState<"sign_in" | "sign_up">("sign_in")
  const [profile, setProfile] = useState<{ username: string | null; avatar_url: string | null } | null>(null)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [appRole, setAppRole] = useState<AppRole>("user")
  const [unreadCounts, setUnreadCounts] = useState({ notifications: 0, messages: 0, total: 0 })

  useEffect(() => {
    if (user) setShowAuthModal(false)
  }, [user])

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      if (!user) {
        if (isMounted) setProfile(null)
        if (isMounted) setIsProfileLoading(false)
        if (isMounted) setAppRole("user")
        return
      }

      if (isMounted) setIsProfileLoading(true)

      const [{ data: profileData }, { data: roleData }] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("username, avatar_url")
          .eq("auth_user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle(),
      ])

      if (isMounted) {
        setProfile(profileData ?? null)
        setIsProfileLoading(false)
        setAppRole(roleData?.role === "admin" || roleData?.role === "moderator" ? roleData.role : "user")
      }
    }

    loadProfile()

    const loadCounts = async () => {
      if (!user) {
        if (isMounted) setUnreadCounts({ notifications: 0, messages: 0, total: 0 })
        return
      }

      try {
        const response = await fetch("/api/notifications/counts")
        if (!response.ok) throw new Error("Failed to load counts")
        const data = await response.json()
        if (isMounted) {
          setUnreadCounts({
            notifications: data?.notifications ?? 0,
            messages: data?.messages ?? 0,
            total: data?.total ?? 0,
          })
        }
      } catch (error) {
        console.error(error)
      }
    }

    loadCounts()

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

  const displayName = sanitizeUsernameInput(profile?.username) || (user && isProfileLoading ? "Loading profile" : "Account")

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
            <Link href="/search-titles" className="text-muted-foreground hover:text-foreground">
              Search Titles
            </Link>
            <Link href="/community" className="text-muted-foreground hover:text-foreground">
              Community
            </Link>

            {user ? (
              <>
                <Link href="/diary" className="text-muted-foreground hover:text-foreground">
                  Diary
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2 relative">
                      <span className="relative">
                        <Avatar className="h-7 w-7 border">
                          <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
                          <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                        </Avatar>
                        {unreadCounts.total > 0 ? (
                          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                            {unreadCounts.total}
                          </span>
                        ) : null}
                      </span>
                      <span className="max-w-[140px] truncate text-sm font-medium">
                        {displayName}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex w-full items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>View Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/notifications" className="flex w-full items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <Bell className="h-4 w-4" />
                          <span>Notifications</span>
                        </span>
                        {unreadCounts.notifications > 0 ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                            {unreadCounts.notifications}
                          </span>
                        ) : null}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/messages" className="flex w-full items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span>Messages</span>
                        </span>
                        {unreadCounts.messages > 0 ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                            {unreadCounts.messages}
                          </span>
                        ) : null}
                      </Link>
                    </DropdownMenuItem>
                    {appRole === "admin" || appRole === "moderator" ? (
                      <DropdownMenuItem asChild>
                        <Link href="/admin/suggestions" className="flex w-full items-center gap-2">
                          <span>Review suggestions</span>
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
                    {appRole === "admin" ? (
                      <DropdownMenuItem asChild>
                        <Link href="/admin/moderators" className="flex w-full items-center gap-2">
                          <span>Manage moderators</span>
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
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
