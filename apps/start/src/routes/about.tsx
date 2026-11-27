import { ThemeToggle } from "../components/theme-toggle"
import { createFileRoute, Link } from "@tanstack/react-router"
import "@fontsource/im-fell-english-sc/400.css"
import "@fontsource/raleway/400.css"
import "@fontsource/raleway/600.css"
import "@fontsource/raleway/700.css"
import styles from "./about.module.css"

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Bookworm | Bookworm" },
      {
        name: "description",
        content: "Discover titles, track reading, discuss books, and find your reading community on Bookworm.",
      },
    ],
  }),
  component: AboutPage,
})

const features = [
  {
    number: "01",
    title: "Find your next title",
    description:
      "Browse the local catalog by title, author, or genre. Signed-in readers can also search external sources and suggest missing titles for the maintained catalog.",
  },
  {
    number: "02",
    title: "Keep a useful reading record",
    description:
      "Record page or listening progress, add diary notes, and organize titles into current, finished, and custom reading lists.",
  },
  {
    number: "03",
    title: "Discuss what you finish",
    description:
      "Read public reviews and discussions before signing in. Marking a title as read unlocks rating, review, and discussion contributions.",
  },
  {
    number: "04",
    title: "Build a reading community",
    description:
      "Join or create book and writers’ clubs with open, approval-based, or invitation-only membership. Clubs can coordinate reading plans or share member writing.",
  },
] as const

function AboutPage() {
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#main-content">Skip to main content</a>
      <header className={styles.header}>
        <nav className={styles.nav} aria-label="Primary navigation">
          <Link className={styles.brand} to="/" aria-label="Bookworm home">BOOKWORM</Link>
          <div className={styles.links}>
            <Link to="/">Home</Link>
            <Link to="/auth">Sign in</Link>
          </div>
        <ThemeToggle /></nav>
      </header>

      <main id="main-content" className={styles.main}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Reading is better with context</p>
          <h1>About Bookworm</h1>
          <p className={styles.lead}>
            Bookworm brings discovery, reading progress, thoughtful discussion, and clubs into one place—without
            hiding the catalog from people who just want to look around.
          </p>
        </div>

        <div className={styles.grid}>
          {features.map((feature) => (
            <section className={styles.card} key={feature.number}>
              <span className={styles.number} aria-hidden="true">{feature.number}</span>
              <h2>{feature.title}</h2>
              <p>{feature.description}</p>
            </section>
          ))}
        </div>

        <section className={styles.closing}>
          <h2>Try the complete path</h2>
          <p>
            Start with the public catalog, open a title to see its reading context, then visit Community to compare
            book clubs and writers’ groups. Create an account only when you are ready to save progress or contribute.
          </p>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>Bookworm</span>
        <span>About</span>
      </footer>
    </div>
  )
}
