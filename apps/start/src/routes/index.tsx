import { createFileRoute, Link } from "@tanstack/react-router"
import "@fontsource/im-fell-english-sc/400.css"
import "@fontsource/raleway/400.css"
import "@fontsource/raleway/600.css"
import "@fontsource/raleway/700.css"
import { getPublicHome } from "../features/home/home.functions"
import styles from "../features/home/home.module.css"

export const Route = createFileRoute("/")({
  loader: () => getPublicHome(),
  head: () => ({
    meta: [
      { title: "Bookworm — Keep your reading life in one place" },
      { name: "description", content: "Discover titles, track your reading, share reviews, and find a book community on Bookworm." },
    ],
  }),
  component: HomePage,
})

const features = [
  { marker: "01", title: "Track your reading", description: "Keep progress, diary notes, and finished titles together in a record you can actually use." },
  { marker: "02", title: "Leave the useful review", description: "Rate what you finish and give other readers the context that recommendation lists leave out." },
  { marker: "03", title: "Find your people", description: "Explore book clubs and writers’ groups, then join the conversations that match your reading life." },
] as const

function formatCount(value: number) {
  return new Intl.NumberFormat("en", { notation: value >= 1_000 ? "compact" : "standard" }).format(value)
}

function HomePage() {
  const { counts, recentTitles } = Route.useLoaderData()
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#main-content">Skip to main content</a>
      <header className={styles.header}>
        <nav className={styles.nav} aria-label="Primary navigation">
          <Link className={styles.brand} to="/" aria-label="Bookworm home">BOOKWORM</Link>
          <div className={styles.links}>
            <Link to="/search-titles" search={{ q: "", title: "", author: "", genres: "", includeExternal: false }} preload="intent">Titles</Link>
            <Link to="/community" search={{ q: "", t: "", genres: "" }} preload="intent">Community</Link>
            <Link to="/about" preload="intent">About</Link>
          </div>
          <Link className={styles.signIn} to="/auth" preload="intent">Sign in</Link>
        </nav>
      </header>
      <main id="main-content">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Your next chapter starts here</p>
            <h1>Keep your reading life in one place.</h1>
            <p className={styles.lead}>Discover your next title, track what you are reading, trade thoughtful recommendations, and find a community that reads the way you do.</p>
            <div className={styles.actions}>
              <Link className={styles.primaryAction} to="/search-titles" search={{ q: "", title: "", author: "", genres: "", includeExternal: false }} preload="intent">Explore titles</Link>
              <Link className={styles.secondaryAction} to="/auth" preload="intent">Create an account</Link>
            </div>
          </div>
          <div className={styles.shelf} aria-label="A small selection from the Bookworm catalog">
            <div className={styles.shelfLabel}>Recently shelved</div>
            <div className={styles.books}>
              {recentTitles.length ? recentTitles.slice(0, 4).map((title, index) => (
                <Link key={title.id} className={styles.book} to="/titles/$id" params={{ id: title.id }} preload="intent">
                  {title.coverUrl ? <img src={title.coverUrl} alt="" width="144" height="216" loading={index > 1 ? "lazy" : "eager"} /> : <span className={styles.bookFallback} aria-hidden="true">{title.title.slice(0, 1)}</span>}
                  <span className={styles.bookTitle}>{title.title}</span>
                  <span className={styles.bookAuthor}>{title.author}</span>
                </Link>
              )) : <div className={styles.emptyShelf}>The public catalog is ready to browse.</div>}
            </div>
            <div className={styles.shelfEdge} />
          </div>
        </section>
        <section className={styles.features} aria-labelledby="features-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>Made for the full reading cycle</p>
            <h2 id="features-heading">From first look to final thought.</h2>
          </div>
          <div className={styles.featureGrid}>
            {features.map((feature) => <article className={styles.feature} key={feature.marker}><span>{feature.marker}</span><h3>{feature.title}</h3><p>{feature.description}</p></article>)}
          </div>
        </section>
        <section className={styles.catalogBand} aria-label="Bookworm activity">
          <div><strong>{formatCount(counts.titles)}</strong><span>titles in the catalog</span></div>
          <div><strong>{formatCount(counts.reviews)}</strong><span>reader reviews</span></div>
          <div><strong>{formatCount(counts.clubs)}</strong><span>reading communities</span></div>
        </section>
        <section className={styles.closing}>
          <div><p className={styles.eyebrow}>Start with the catalog</p><h2>Look around before you sign up.</h2></div>
          <p>Browse titles and public communities first. Create an account when you are ready to save progress or contribute.</p>
          <Link to="/search-titles" search={{ q: "", title: "", author: "", genres: "", includeExternal: false }} preload="intent">Open the catalog <span aria-hidden="true">→</span></Link>
        </section>
      </main>
      <footer className={styles.footer}><span>Bookworm</span><span>Read with context.</span></footer>
    </div>
  )
}
