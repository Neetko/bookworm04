import { createFileRoute, Link } from "@tanstack/react-router"
import { formatDate } from "../features/date-format"
import { getTitleDetail } from "../features/titles/catalog.functions"
import styles from "../features/titles/catalog.module.css"

export const Route = createFileRoute("/titles/$id")({
  loader: ({ params }) => getTitleDetail({ data: { id: params.id } }),
  head: ({ loaderData }) => ({ meta: [
    { title: loaderData ? `${loaderData.title} by ${loaderData.author} | Bookworm` : "Title | Bookworm" },
    { name: "description", content: loaderData?.description?.slice(0, 160) || "Explore a title on Bookworm." },
  ] }),
  component: TitleDetailPage,
})

function TitleDetailPage() {
  const title = Route.useLoaderData()
  const average = title.reviews.length
    ? (title.reviews.reduce((sum, review) => sum + review.rating, 0) / title.reviews.length).toFixed(1)
    : null

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <nav className={styles.nav} aria-label="Primary navigation">
          <Link to="/" className={styles.brand}>BOOKWORM</Link>
          <div className={styles.navLinks}>
            <Link to="/search-titles" search={{ q: "", title: "", author: "", genres: "", includeExternal: false }}>Search Titles</Link>
            <Link to="/about">About</Link>
            <Link to="/auth">Sign in</Link>
          </div>
        </nav>
      </header>
      <main className={styles.main}>
        <Link to="/search-titles" search={{ q: "", title: "", author: "", genres: "", includeExternal: false }} className={styles.back}>← Back to catalog</Link>
        <div className={styles.detail}>
          <div className={styles.detailCover}>
            {title.coverUrl ? <img src={title.coverUrl} alt={`Cover of ${title.title}`} width="260" height="390" decoding="async" referrerPolicy="no-referrer" /> : <span aria-hidden="true">B</span>}
          </div>
          <div className={styles.detailText}>
            <p className={styles.eyebrow}>Bookworm title</p>
            <h1>{title.title}</h1>
            <p className={styles.author}>by {title.author}</p>
            <div className={styles.detailMeta}>
              {title.year ? <span>Published {title.year}</span> : null}
              {title.isbn ? <span>ISBN {title.isbn}</span> : null}
              {average ? <span>{average}/10 · {title.reviews.length} reviews</span> : <span>No reviews yet</span>}
            </div>
            {title.genres.length ? <div className={styles.tags}>{title.genres.map((genre) => <span key={genre}>{genre}</span>)}</div> : null}
            {title.description ? <p className={styles.description}>{title.description}</p> : null}
          </div>
        </div>
        <section className={styles.reviews}>
          <div className={styles.resultHeader}><h2>Reader reviews</h2><span>{title.reviews.length}</span></div>
          {title.reviews.length === 0 ? <p className={styles.empty}>No reviews yet.</p> : (
            <div className={styles.reviewGrid}>
              {title.reviews.map((review) => (
                <article className={styles.review} key={review.id}>
                  <div><strong>{review.username ?? "Reader"}</strong><span>{review.rating}/10</span></div>
                  {review.text ? <p>{review.text}</p> : null}
                  <small>{formatDate(review.createdAt)}</small>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
