import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { useEffect, useState, type FormEvent } from "react"
import { checkOnboardingUsername, getOnboardingState } from "../features/onboarding/onboarding.functions"
import styles from "../features/onboarding/onboarding.module.css"
import { sanitizeUsername, usernameError } from "../features/onboarding/validation"
import { GENRES, type Genre } from "../features/titles/catalog"

export const Route = createFileRoute("/onboarding")({
  loader: async () => {
    const state = await getOnboardingState()
    if (state.status === "unauthorized") throw redirect({ to: "/auth" })
    if (state.status === "complete") throw redirect({ to: "/" })
    if (state.status !== "ok") throw new Error("Onboarding is unavailable")
    return state
  },
  head: () => ({ meta: [
    { title: "Set up your account — Bookworm" },
    { name: "description", content: "Choose your public Bookworm username and favorite genres." },
  ] }),
  component: OnboardingPage,
  errorComponent: OnboardingError,
})

type Availability = { state: "idle" | "checking" | "available" | "error"; message: string }

function OnboardingError() {
  return <main className={styles.main}><div className={styles.unavailable}><h1>Setup is unavailable</h1><p>Please sign in again. If the problem continues, try later.</p><Link to="/auth">Return to sign in</Link></div></main>
}

function OnboardingPage() {
  const initial = Route.useLoaderData()
  const [username, setUsername] = useState(initial.username)
  const [genres, setGenres] = useState<Genre[]>(initial.favoriteGenres)
  const [availability, setAvailability] = useState<Availability>({ state: "idle", message: "Choose the name other readers will see." })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  useEffect(() => {
    const validationError = usernameError(username)
    if (validationError) {
      setAvailability({ state: "error", message: validationError })
      return
    }
    let cancelled = false
    setAvailability({ state: "checking", message: "Checking availability…" })
    const timer = window.setTimeout(async () => {
      try {
        const result = await checkOnboardingUsername({ data: { username } })
        if (!cancelled) setAvailability({
          state: result.available ? "available" : "error",
          message: result.message,
        })
      } catch {
        if (!cancelled) setAvailability({ state: "error", message: "Could not check username right now" })
      }
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [username])

  function toggleGenre(genre: Genre) {
    setGenres((current) => current.includes(genre)
      ? current.filter((item) => item !== genre)
      : [...current, genre])
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError("")
    setSubmitting(true)
    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: sanitizeUsername(username), favoriteGenres: genres }),
      })
      const result = await response.json().catch(() => ({ error: "Could not finish setup" })) as { error?: string }
      if (!response.ok) {
        setSubmitError(result.error ?? "Could not finish setup")
        return
      }
      window.location.assign("/")
    } catch {
      setSubmitError("Could not finish setup")
    } finally {
      setSubmitting(false)
    }
  }

  const ready = availability.state === "available" && genres.length > 0 && !submitting
  return <div className={styles.page}>
    <header className={styles.header}><nav className={styles.nav}><Link className={styles.brand} to="/">BOOKWORM</Link><form className={styles.signOut} action="/api/auth/logout" method="post"><button type="submit">Sign out</button></form></nav></header>
    <main className={styles.main}>
      <p className={styles.eyebrow}>New reader setup</p>
      <h1>Make Bookworm yours.</h1>
      <p className={styles.lead}>Choose a public username and at least one favorite genre. Reading lists are created automatically; titles and reader follows can be added after setup.</p>
      <form className={styles.card} onSubmit={submit}>
        <div className={styles.field}>
          <label htmlFor="onboarding-username">Username</label>
          <input id="onboarding-username" name="username" value={username} onChange={(event) => setUsername(event.target.value)} maxLength={100} autoComplete="username" autoFocus />
          <p className={`${styles.feedback} ${availability.state === "error" ? styles.error : availability.state === "available" ? styles.success : ""}`} role="status">{availability.message}</p>
        </div>
        <fieldset className={styles.genres}>
          <legend className={styles.legend}>Favorite genres</legend>
          <div className={styles.genreGrid}>
            {GENRES.map((genre) => {
              const selected = genres.includes(genre)
              return <button key={genre} className={`${styles.genre} ${selected ? styles.genreSelected : ""}`} type="button" aria-pressed={selected} onClick={() => toggleGenre(genre)}>{genre}</button>
            })}
          </div>
        </fieldset>
        <p className={styles.summary}>{genres.length ? `${genres.length} ${genres.length === 1 ? "genre" : "genres"} selected` : "Select at least one genre."}</p>
        {submitError && <p className={`${styles.feedback} ${styles.error}`} role="alert">{submitError}</p>}
        <div className={styles.actions}><p>You can change these choices later.</p><button className={styles.submit} type="submit" disabled={!ready}>{submitting ? "Finishing…" : "Finish setup"}</button></div>
      </form>
    </main>
  </div>
}
