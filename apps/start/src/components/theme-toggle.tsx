import { useEffect, useState } from "react"
import styles from "./theme-toggle.module.css"

type Theme = "light" | "dark"

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    const initial: Theme = window.localStorage.getItem("bookworm-theme") === "light" ? "light" : "dark"
    document.documentElement.dataset.theme = initial
    setTheme(initial)
  }, [])

  function toggle() {
    const next = theme === "dark" ? "light" : "dark"
    document.documentElement.dataset.theme = next
    window.localStorage.setItem("bookworm-theme", next)
    setTheme(next)
  }

  return <button className={styles.toggle} type="button" onClick={toggle} aria-label="Toggle theme" title="Toggle theme">
    {theme === "dark"
      ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.985 12.486A9 9 0 0 1 11.514 3.015 9 9 0 1 0 20.985 12.486Z" /></svg>
      : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>}
  </button>
}
