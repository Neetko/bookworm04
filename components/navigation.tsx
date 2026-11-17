"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
import { BookOpen, Bell, LogOut, Mail, Menu, User } from "lucide-react"
import { useAuth } from "@/lib/auth-provider"
import { supabase } from "@/lib/supabase-browser"
import { AuthModal } from "@/components/auth-modal"
import { ModeToggle } from "@/components/mode-toggle"
import type { AppRole } from "@/lib/server/roles"
import { sanitizeUsernameInput } from "@/lib/onboarding"
import { NOTIFICATION_COUNTS_CHANGED_EVENT } from "@/lib/notifications"
import { cn } from "@/lib/utils"

export function Navigation() {
  const pathname = usePathname()
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

    const refreshCounts = () => {
      void loadCounts()
    }
    const refreshVisibleCounts = () => {
      if (document.visibilityState === "visible") refreshCounts()
    }
    const refreshInterval = window.setInterval(refreshCounts, 30_000)

    window.addEventListener(NOTIFICATION_COUNTS_CHANGED_EVENT, refreshCounts)
    window.addEventListener("focus", refreshCounts)
    document.addEventListener("visibilitychange", refreshVisibleCounts)

    return () => {
      isMounted = false
      window.clearInterval(refreshInterval)
      window.removeEventListener(NOTIFICATION_COUNTS_CHANGED_EVENT, refreshCounts)
      window.removeEventListener("focus", refreshCounts)
      document.removeEventListener("visibilitychange", refreshVisibleCounts)
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

  const navLinkClass = (href: string) => {
    const active = href === "/" ? pathname === href : pathname.startsWith(href)
    return cn(
      "font-ui text-sm font-medium transition-colors hover:text-foreground focus-visible:rounded-sm",
      active ? "text-foreground" : "text-muted-foreground"
    )
  }

  const primaryLinks = [
    { href: "/", label: "Home" },
    { href: "/search-titles", label: "Search Titles" },
    { href: "/community", label: "Community" },
  ] as const

  return (
    <>
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[60] -translate-y-24 rounded-md bg-primary px-4 py-2 font-ui text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>
      <nav aria-label="Primary navigation" className="border-b bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center">
              <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="Bookworm home">
                <BookOpen className="h-8 w-8 text-primary" />
                <span className="truncate text-xl font-bold text-foreground sm:text-2xl">BOOKWORM</span>
              </Link>
            </div>

            <div className="hidden items-center gap-4 lg:flex">
              <ModeToggle />
              {primaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={navLinkClass(link.href)}
                  aria-current={
                    (link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)) ? "page" : undefined
                  }
                >
                  {link.label}
                </Link>
              ))}

              {user ? (
                <>
                  <Link
                    href="/diary"
                    className={navLinkClass("/diary")}
                    aria-current={pathname.startsWith("/diary") ? "page" : undefined}
                  >
                    Diary
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="relative flex items-center gap-2">
                        <span className="relative">
                          <Avatar className="h-7 w-7 border">
                            <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
                            <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                          </Avatar>
                          {unreadCounts.total > 0 ? (
                            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                              {unreadCounts.total}
                            </span>
                          ) : null}
                        </span>
                        <span className="max-w-[140px] truncate text-sm font-medium">{displayName}</span>
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
                  <Button variant="outline" onClick={handleSignIn}>
                    Sign in
                  </Button>
                  <Button onClick={handleSignUp}>Sign up</Button>
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1 lg:hidden">
              <ModeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative" aria-label="Open navigation menu">
                    <Menu className="h-5 w-5" />
                    {user && unreadCounts.total > 0 ? (
                      <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-ui text-[9px] font-semibold text-primary-foreground">
                        {unreadCounts.total}
                      </span>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {primaryLinks.map((link) => (
                    <DropdownMenuItem key={link.href} asChild>
                      <Link
                        href={link.href}
                        aria-current={
                          (link.href === "/" ? pathname === "/" : pathname.startsWith(link.href))
                            ? "page"
                            : undefined
                        }
                      >
                        {link.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem asChild>
                    <Link href="/about">About Bookworm</Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  {user ? (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/diary">Diary</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/profile" className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>{displayName}</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/notifications" className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <Bell className="h-4 w-4" />
                            Notifications
                          </span>
                          {unreadCounts.notifications > 0 ? <span>{unreadCounts.notifications}</span> : null}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/messages" className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Messages
                          </span>
                          {unreadCounts.messages > 0 ? <span>{unreadCounts.messages}</span> : null}
                        </Link>
                      </DropdownMenuItem>
                      {appRole === "admin" || appRole === "moderator" ? (
                        <DropdownMenuItem asChild>
                          <Link href="/admin/suggestions">Review suggestions</Link>
                        </DropdownMenuItem>
                      ) : null}
                      {appRole === "admin" ? (
                        <DropdownMenuItem asChild>
                          <Link href="/admin/moderators">Manage moderators</Link>
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => void signOut()}>
                        <LogOut className="h-4 w-4" />
                        Log Out
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem onSelect={handleSignIn}>Sign in</DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleSignUp}>Create an account</DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} view={authView} />
      </nav>
      <span id="main-content" tabIndex={-1} className="sr-only" />
    </>
  )
}
