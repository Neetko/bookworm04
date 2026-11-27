import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import "@fontsource/im-fell-english-sc/400.css"
import "@fontsource/raleway/400.css"
import "@fontsource/raleway/600.css"
import { ThemeToggle } from "../components/theme-toggle"
import { getAuthStatus } from "../features/auth/auth.functions"
import styles from "../features/auth/auth.module.css"

export const Route = createFileRoute("/auth")({
  validateSearch: (search): { mode?: "signup"; error?: string } => ({
    mode: search.mode === "signup" ? "signup" : undefined,
    error: typeof search.error === "string" ? search.error.slice(0, 60) : undefined,
  }),
  loader: async () => {
    const status = await getAuthStatus()
    if (status.signedIn) throw redirect({ to: status.onboarded ? "/" : "/onboarding" })
  },
  component: AuthPage,
})

function AuthPage() {
  const { mode, error } = Route.useSearch()
  const isSignup = mode === "signup"
  return <div className={styles.page}>
    <header className={styles.header}><Link to="/" className={styles.brand}>BOOKWORM</Link><ThemeToggle /></header>
    <main className={styles.card}>
      <p className={styles.eyebrow}>Your reading life starts here</p>
      <h1>{isSignup ? "Join Bookworm" : "Welcome back"}</h1>
      <p>{isSignup ? "Create an account with Google, then choose your reader name and favorite genres." : "Sign in with Google to continue your reading journey."}</p>
      {error ? <p className={styles.error} role="alert">{error === "profile-check" ? "We could not load your profile. Please try again." : "Google sign-in did not complete. Please try again."}</p> : null}
      <form action="/api/auth/google" method="post">
        <input type="hidden" name="mode" value={mode ?? "signin"} />
        <button type="submit">Continue with Google</button>
      </form>
      <p className={styles.switch}>{isSignup ? "Already have an account?" : "New to Bookworm?"} <Link to="/auth" search={isSignup ? {} : { mode: "signup" }}>{isSignup ? "Sign in" : "Sign up"}</Link></p>
    </main>
  </div>
}
