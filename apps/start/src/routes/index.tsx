import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import "@fontsource/im-fell-english-sc/400.css"
import "@fontsource/raleway/400.css"
import "@fontsource/raleway/600.css"
import "@fontsource/raleway/700.css"
import { getPublicHome, type HomeDashboard } from "../features/home/home.functions"
import { GuestWelcomeMascot } from "../components/guest-welcome-mascot"
import { ThemeToggle } from "../components/theme-toggle"
import styles from "../features/home/home.module.css"

export const Route = createFileRoute("/")({
  loader: async () => {
    const home = await getPublicHome()
    if (home.reader && !home.reader.onboarded) throw redirect({ to: "/onboarding" })
    return home
  },
  head: () => ({ meta: [
    { title: "Bookworm — Keep your reading life in one place" },
    { name: "description", content: "Discover titles, track your reading, share reviews, and find a book community on Bookworm." },
  ] }),
  component: HomePage,
})

const features = [
  { marker: "01", title: "Track reading progress", description: "Log reading sessions, follow your progress, and keep a useful record of every title." },
  { marker: "02", title: "Rate & Review", description: "Share your thoughts and help other readers find their perfect books." },
  { marker: "03", title: "Community", description: "Connect with fellow book lovers and discover recommendations." },
] as const

function formatCount(value: number) {
  return new Intl.NumberFormat("en", { notation: value >= 1_000 ? "compact" : "standard" }).format(value)
}

function HomePage() {
  const { counts, reader, dashboard } = Route.useLoaderData()
  return <div className={styles.page}>
    <a className={styles.skip} href="#main-content">Skip to main content</a>
    <header className={styles.header}><nav className={styles.nav} aria-label="Primary navigation">
      <Link className={styles.brand} to="/">BOOKWORM</Link>
      <div className={styles.links}>
        <Link to="/search-titles" search={{ q: "", title: "", author: "", genres: "", includeExternal: false }}>Titles</Link>
        <Link to="/community" search={{ q: "", t: "", genres: "" }}>Community</Link>
        <Link to="/about">About</Link>
        {reader?.onboarded ? <><Link to="/diary" search={{ filterBy: "none", genres: "", author: "", title: "" }}>Diary</Link><Link to="/messages" search={{ folder: "inbox", page: 1 }}>Messages</Link><Link to="/profile">My profile</Link></> : null}
      </div>
      <div className={styles.navActions}><ThemeToggle />{reader ? <form action="/api/auth/logout" method="post"><button className={styles.signIn} type="submit">Sign out</button></form> : <Link className={styles.signIn} to="/auth" search={{}}>Sign in</Link>}</div>
    </nav></header>
    <main id="main-content">
      {dashboard ? <ReaderDashboard dashboard={dashboard} /> : <>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Your next chapter starts here</p>
          <h1>{reader ? `Welcome back, ${reader.name}.` : "Keep your reading life in one place."}</h1>
          <p className={styles.lead}>Discover your next read, track your progress, trade recommendations, and join book clubs and writers’ groups — or create your own!</p>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} to="/search-titles" search={{ q: "", title: "", author: "", genres: "", includeExternal: false }}>Explore titles</Link>
            {reader ? <Link className={styles.secondaryAction} to={reader.onboarded ? "/profile" : "/onboarding"}>{reader.onboarded ? "My profile" : "Finish setup"}</Link> : <Link className={styles.secondaryAction} to="/auth" search={{ mode: "signup" }}>Create an account</Link>}
          </div>
        </div>
        <div className={styles.mascot}><GuestWelcomeMascot /></div>
      </section>
      <section className={styles.features} aria-label="Bookworm features">
        {features.map((feature) => <article className={styles.feature} key={feature.marker}><span className={styles.featureIcon} aria-hidden="true">{feature.marker}</span><h2>{feature.title}</h2><p>{feature.description}</p></article>)}
      </section>
      <section className={styles.stats} aria-label="Bookworm activity">
        <div><strong>{formatCount(counts.titles)}</strong><span>Titles</span></div>
        <div><strong>{formatCount(counts.reviews)}</strong><span>Reviews Written</span></div>
        <div><strong>{formatCount(counts.clubs)}</strong><span>Clubs Created</span></div>
      </section>
      </>}
    </main>
  </div>
}

function eventText(event: HomeDashboard["activities"][number]) {
  const title = event.metadata.title?.title ?? "a title"
  const club = event.metadata.club?.name ?? "a club"
  const list = event.metadata.list?.name ?? "a list"
  switch (event.eventType) {
    case "review_posted": return `reviewed ${title}${event.metadata.rating ? ` — ${event.metadata.rating}/10` : ""}.`
    case "title_finished": return `finished reading ${title}.`
    case "list_created": return `created the list “${list}”.`
    case "list_item_added": return list === "Current Reading" ? `started reading ${title}.` : `added ${title} to “${list}”.`
    case "club_created": return `created the club “${club}”.`
    case "club_joined": return `joined “${club}”.`
    case "achievement_earned": return `earned ${event.metadata.achievement?.name ?? "an achievement"}.`
    default: return "shared an update."
  }
}

function ReaderDashboard({ dashboard }: { dashboard: HomeDashboard }) {
  const stats = [
    ["Books this year", dashboard.stats.booksThisYear],
    ["Currently reading", dashboard.stats.currentlyReading],
    ["Reviews written", dashboard.stats.reviewsWritten],
    ["Following", dashboard.stats.following],
  ] as const
  return <div className={styles.dashboard}>
    <div className={styles.feed}>
      <h1>Welcome back</h1><p className={styles.dashboardLead}>See what your fellow readers have been up to.</p>
      <h2 className={styles.feedTab}>Your feed</h2>
      {dashboard.activities.length ? dashboard.activities.map((event) => <article className={styles.activity} key={event.id}>
        <div className={styles.activityAvatar}>{event.avatarUrl ? <img src={event.avatarUrl} alt="" width="40" height="40" loading="lazy" /> : event.actorName.slice(0, 2).toUpperCase()}</div>
        <div><div className={styles.activityByline}><Link to="/users/$username" params={{ username: event.actorId }}>{event.actorName}</Link><time dateTime={event.createdAt ?? undefined}>{event.createdAt ? new Date(event.createdAt).toLocaleDateString() : ""}</time></div>
          <p>{eventText(event)}</p>{event.metadata.reviewText ? <blockquote>“{event.metadata.reviewText}”</blockquote> : null}
        </div>
        {event.metadata.title?.id ? <Link className={styles.activityTitle} to="/titles/$id" params={{ id: event.metadata.title.id }} aria-label={`Open ${event.metadata.title.title ?? "title"}`}>{event.metadata.title.cover ? <img src={event.metadata.title.cover} alt="" width="70" height="105" loading="lazy" /> : "↗"}</Link> : null}
      </article>) : <p className={styles.emptyFeed}>Your feed is empty for now.</p>}
    </div>
    <aside className={styles.dashboardAside}>
      <section className={styles.dashboardPanel}><h2>Readers to follow</h2>
        {dashboard.suggestions.length ? dashboard.suggestions.map((person) => <Link className={styles.suggestedReader} to="/users/$username" params={{ username: person.id }} key={person.id}>
          <span className={styles.activityAvatar}>{person.avatarUrl ? <img src={person.avatarUrl} alt="" width="36" height="36" loading="lazy" /> : person.username.slice(0, 2).toUpperCase()}</span>{person.username}
        </Link>) : <p className={styles.dashboardLead}>Follow more readers to tune your community feed.</p>}
      </section>
      <section className={styles.dashboardPanel}><h2>Your progress</h2><div className={styles.progressStats}>{stats.map(([label, value]) => <div key={label}><strong>{formatCount(value)}</strong><span>{label}</span></div>)}</div></section>
    </aside>
  </div>
}
