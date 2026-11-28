import { useEffect, useState, type FormEvent } from "react"
import { Link, useRouter } from "@tanstack/react-router"
import { Calendar, Flag, Lock, MoreHorizontal, Send, ThumbsUp, User } from "lucide-react"
import type { CatalogDetail, CatalogDiscussionPost, CatalogReview } from "./catalog"
import { BookwormRatingReaction } from "./bookworm-rating-reaction"
import { BookwormSprite, type BookwormRatingBand } from "./bookworm-sprite"
import { RichTextEditor } from "./rich-text-editor"
import reviewStyles from "./review-form.module.css"
import styles from "./catalog.module.css"

type SocialResult = {
  error?: string
  liked?: boolean
  likesCount?: number
}

const RATING_LABELS: Record<BookwormRatingBand, string> = {
  "1-2": "Not for me",
  "3-4": "Underwhelming",
  "5-6": "Pretty neat",
  "7-8": "Great read",
  "9-10": "Outstanding",
}

function getRatingBand(rating: number): BookwormRatingBand | null {
  if (rating <= 0) return null
  if (rating <= 2) return "1-2"
  if (rating <= 4) return "3-4"
  if (rating <= 6) return "5-6"
  if (rating <= 8) return "7-8"
  return "9-10"
}

function formatRelativeDate(value: string) {
  const elapsedSeconds = Math.round((new Date(value).getTime() - Date.now()) / 1_000)
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  if (Math.abs(elapsedSeconds) < 60) return formatter.format(elapsedSeconds, "second")
  const minutes = Math.round(elapsedSeconds / 60)
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour")
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return formatter.format(days, "day")
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value))
}

function formatJoinedDate(value: string | null) {
  if (!value) return "Unknown"
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(value))
}

async function mutateTitleSocial(titleId: string, payload: unknown): Promise<SocialResult> {
  const response = await fetch(`/api/titles/${encodeURIComponent(titleId)}/social`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => ({})) as SocialResult
  if (!response.ok) throw new Error(result.error || "Could not update title activity")
  return result
}

function ReviewerLink({ userId, username }: { userId: string | null; username: string | null }) {
  return userId
    ? <Link className={styles.profileLink} to="/users/$username" params={{ username: userId }}>{username ?? "Reader profile"}</Link>
    : <span>{username ?? "Reader"}</span>
}

function LockedComposer({ area, signedIn }: { area: "reviews" | "discussion"; signedIn: boolean }) {
  return <div className={styles.lockedComposer}>
    <span className={styles.lockIcon} aria-hidden="true"><Lock size={16} /></span>
    <div>
      <strong>{area === "discussion" ? "Read-only discussion" : "Reviews unlock after reading"}</strong>
      <p>{area === "discussion"
        ? `${signedIn ? "Mark" : "Sign in and mark"} this title as read to post. You can still browse every discussion below.`
        : `${signedIn ? "Mark" : "Sign in and mark"} this title as read to rate it and write a review.`}</p>
    </div>
  </div>
}

function ReviewComposer({ title }: { title: CatalogDetail }) {
  const router = useRouter()
  const existing = title.viewer.review
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [focusRating, setFocusRating] = useState<number | null>(null)
  const [html, setHtml] = useState(existing?.html ?? "")
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState("")
  const interactionRating = hoverRating ?? focusRating
  const previewRating = interactionRating ?? rating
  const displayBand = getRatingBand(interactionRating ?? 0) ?? getRatingBand(rating)

  useEffect(() => {
    setRating(existing?.rating ?? 0)
    setHtml(existing?.html ?? "")
  }, [existing?.id, existing?.rating, existing?.html])

  if (!title.viewer.isRead) return <LockedComposer area="reviews" signedIn={title.viewer.signedIn} />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (rating < 1 || rating > 10) {
      setFeedback("Choose a rating from 1 to 10.")
      return
    }
    setPending(true)
    setFeedback("")
    try {
      await mutateTitleSocial(title.id, { action: "save-review", rating, contentHtml: html })
      setFeedback(existing ? "Review updated." : "Review published.")
      await router.invalidate()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save review")
    } finally {
      setPending(false)
    }
  }

  return <form className={reviewStyles.composer} onSubmit={submit} aria-labelledby="review-composer-title">
    <header className={reviewStyles.header}>
      <div>
        <p className={reviewStyles.eyebrow}>Your take</p>
        <h3 className={reviewStyles.title} id="review-composer-title">Rate this title</h3>
      </div>
      <div className={reviewStyles.readout} aria-live="polite">
        <span className={reviewStyles.readoutScore}>{previewRating || "—"}<small>/10</small></span>
        <span className={reviewStyles.readoutLabel}>{displayBand ? RATING_LABELS[displayBand] : "Choose a score"}</span>
      </div>
    </header>
    <div className={reviewStyles.ratingLayout}>
      <fieldset className={reviewStyles.selector}>
        <legend className={reviewStyles.legend}>Score from 1 to 10</legend>
        <div className={reviewStyles.scoreGrid} onPointerCancel={() => setHoverRating(null)} onPointerLeave={() => setHoverRating(null)}>
          {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => <label
            className={reviewStyles.scoreOption}
            data-current={rating === score}
            data-previewed={score <= previewRating}
            key={score}
            onPointerEnter={() => setHoverRating(score)}
          >
            <input
              checked={rating === score}
              className={reviewStyles.scoreInput}
              name={`rating-${title.id}`}
              onBlur={() => setFocusRating(null)}
              onChange={() => setRating(score)}
              onFocus={() => setFocusRating(score)}
              type="radio"
              value={score}
            />
            <span className={reviewStyles.scoreFace}><span className={reviewStyles.scoreNumber}>{score}</span></span>
          </label>)}
        </div>
        <div className={reviewStyles.scaleLabels} aria-hidden="true"><span>rough</span><span>solid</span><span>all-time</span></div>
      </fieldset>
      <div className={reviewStyles.reactionStage} aria-hidden="true">
        <span className={reviewStyles.previewLabel}>{interactionRating
          ? `Previewing ${interactionRating}/10`
          : rating
            ? `Your verdict: ${rating}/10`
            : "Mascot preview"}</span>
        <div className={reviewStyles.reactionCanvas}>{displayBand
          ? <BookwormRatingReaction key={displayBand} ratingBand={displayBand} />
          : <BookwormSprite />}</div>
      </div>
    </div>
    <div className={reviewStyles.reviewField}>
      <label className={reviewStyles.reviewLabel}>Your review</label>
      <RichTextEditor value={html} onChange={setHtml} label="Your review" placeholder="What stayed with you?" disabled={pending} />
    </div>
    <footer className={reviewStyles.footer}>
      <p className={reviewStyles.saveNote}>{feedback || (existing
        ? "Saving will replace your previous rating and review."
        : "You can come back and revise this later.")}</p>
      <button className={`${styles.actionButton} ${styles.actionPrimary}`} type="submit" disabled={pending || rating === 0}>
        {pending ? "Saving…" : existing ? "Update review" : "Publish review"}
      </button>
    </footer>
  </form>
}

function ReviewsPanel({ title }: { title: CatalogDetail }) {
  const [reviews, setReviews] = useState<CatalogReview[]>(title.reviews)
  const [pendingLike, setPendingLike] = useState<string | null>(null)
  const [feedback, setFeedback] = useState("")
  useEffect(() => setReviews(title.reviews), [title.reviews])

  async function toggleLike(review: CatalogReview) {
    if (!title.viewer.signedIn || pendingLike) return
    setPendingLike(review.id)
    setFeedback("")
    const previous = review
    setReviews((current) => current.map((item) => item.id === review.id ? {
      ...item,
      viewerHasLiked: !item.viewerHasLiked,
      likesCount: Math.max(0, item.likesCount + (item.viewerHasLiked ? -1 : 1)),
    } : item))
    try {
      const result = await mutateTitleSocial(title.id, { action: "toggle-review-like", reviewId: review.id })
      setReviews((current) => current.map((item) => item.id === review.id ? {
        ...item,
        viewerHasLiked: Boolean(result.liked),
        likesCount: result.likesCount ?? item.likesCount,
      } : item))
    } catch (error) {
      setReviews((current) => current.map((item) => item.id === review.id ? previous : item))
      setFeedback(error instanceof Error ? error.message : "Could not update like")
    } finally {
      setPendingLike(null)
    }
  }

  return <div className={styles.socialPanel}>
    <ReviewComposer title={title} />
    {feedback ? <p className={styles.socialFeedback} role="status">{feedback}</p> : null}
    {reviews.length === 0 ? <p className={styles.empty}>No reviews yet. Be the first to review it.</p> : <div className={styles.reviewsList}>
      <p className={styles.resultCount}>{reviews.length === 1 ? "1 review" : `${reviews.length} reviews`}</p>
      {reviews.map((review) => <article className={styles.reviewRow} key={review.id}>
        <div className={styles.reviewHeader}>
          <ReviewerLink userId={review.userId} username={review.username} />
          <strong>{review.rating}/10</strong>
        </div>
        {review.html ? <div className={styles.richOutput} dangerouslySetInnerHTML={{ __html: review.html }} /> : null}
        <div className={styles.socialMeta}>
          <small>{formatRelativeDate(review.createdAt)}</small>
          <button
            type="button"
            data-liked={review.viewerHasLiked}
            disabled={!title.viewer.signedIn || pendingLike === review.id}
            title={title.viewer.signedIn ? "Like this review" : "Sign in to like reviews"}
            onClick={() => void toggleLike(review)}
          ><ThumbsUp size={15} aria-hidden="true" /><span>{review.likesCount}</span></button>
        </div>
      </article>)}
    </div>}
  </div>
}

function DiscussionComposer({ title }: { title: CatalogDetail }) {
  const router = useRouter()
  const [html, setHtml] = useState("")
  const [text, setText] = useState("")
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState("")

  if (!title.viewer.isRead) return <LockedComposer area="discussion" signedIn={title.viewer.signedIn} />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!text.trim()) {
      setFeedback("Write something before posting.")
      return
    }
    setPending(true)
    setFeedback("")
    try {
      await mutateTitleSocial(title.id, { action: "create-discussion-post", contentHtml: html })
      setHtml("")
      setText("")
      setFeedback("Post published.")
      await router.invalidate()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not publish post")
    } finally {
      setPending(false)
    }
  }

  return <form className={styles.discussionComposer} onSubmit={submit}>
    <h3>Share Your Thoughts</h3>
    <RichTextEditor
      value={html}
      onChange={(nextHtml, nextText) => { setHtml(nextHtml); setText(nextText) }}
      label="Discussion post"
      placeholder="What are your thoughts on this book? Share your insights, favorite moments, or questions..."
      disabled={pending}
    />
    <div className={styles.composerFooter}>
      <p>{feedback || `${text.length} characters`}</p>
      <button className={`${styles.actionButton} ${styles.actionPrimary}`} type="submit" disabled={pending || !text.trim()}>
        <Send size={15} aria-hidden="true" /> {pending ? "Posting…" : "Post"}
      </button>
    </div>
  </form>
}

function DiscussionPost({ title, post, pendingLike, onLike }: {
  title: CatalogDetail
  post: CatalogDiscussionPost
  pendingLike: boolean
  onLike: () => void
}) {
  return <article className={styles.discussionPost}>
    <aside>
      {post.avatarUrl
        ? <img src={post.avatarUrl} alt="" width="96" height="96" loading="lazy" decoding="async" />
        : <span className={styles.avatarFallback} aria-hidden="true"><User size={48} /></span>}
      <ReviewerLink userId={post.userId} username={post.username} />
      {post.role ? <span className={styles.roleBadge}>{post.role}</span> : null}
      <span className={styles.joinedDate}><Calendar size={13} aria-hidden="true" /> Joined {formatJoinedDate(post.joinedAt)}</span>
      <span className={styles.profileRule} aria-hidden="true" />
    </aside>
    <div className={styles.discussionBody}>
      <header>
        <small>Posted {formatRelativeDate(post.createdAt)}</small>
        <span aria-hidden="true"><MoreHorizontal size={17} /></span>
      </header>
      <div className={styles.richOutput} dangerouslySetInnerHTML={{ __html: post.html }} />
      <div className={styles.postActions}>
        <button
          type="button"
          data-liked={post.viewerHasLiked}
          disabled={!title.viewer.isRead || pendingLike}
          title={title.viewer.isRead ? "Like this post" : "Mark this title as read to like discussion posts"}
          onClick={onLike}
        ><ThumbsUp size={15} aria-hidden="true" /><span>({post.likesCount})</span></button>
        <span title="Report post" aria-hidden="true"><Flag size={15} /></span>
      </div>
    </div>
  </article>
}

function DiscussionPanel({ title }: { title: CatalogDetail }) {
  const [posts, setPosts] = useState<CatalogDiscussionPost[]>(title.discussionPosts)
  const [pendingLike, setPendingLike] = useState<string | null>(null)
  const [feedback, setFeedback] = useState("")
  useEffect(() => setPosts(title.discussionPosts), [title.discussionPosts])

  async function toggleLike(post: CatalogDiscussionPost) {
    if (!title.viewer.isRead || pendingLike) return
    setPendingLike(post.id)
    setFeedback("")
    const previous = post
    setPosts((current) => current.map((item) => item.id === post.id ? {
      ...item,
      viewerHasLiked: !item.viewerHasLiked,
      likesCount: Math.max(0, item.likesCount + (item.viewerHasLiked ? -1 : 1)),
    } : item))
    try {
      const result = await mutateTitleSocial(title.id, { action: "toggle-discussion-like", postId: post.id })
      setPosts((current) => current.map((item) => item.id === post.id ? {
        ...item,
        viewerHasLiked: Boolean(result.liked),
        likesCount: result.likesCount ?? item.likesCount,
      } : item))
    } catch (error) {
      setPosts((current) => current.map((item) => item.id === post.id ? previous : item))
      setFeedback(error instanceof Error ? error.message : "Could not update like")
    } finally {
      setPendingLike(null)
    }
  }

  return <div className={styles.socialPanel}>
    <DiscussionComposer title={title} />
    {feedback ? <p className={styles.socialFeedback} role="status">{feedback}</p> : null}
    {posts.length === 0 ? <p className={styles.empty}>No discussion posts yet.</p> : <div className={styles.discussionList}>
      {posts.map((post) => <DiscussionPost
        key={post.id}
        title={title}
        post={post}
        pendingLike={pendingLike === post.id}
        onLike={() => void toggleLike(post)}
      />)}
    </div>}
  </div>
}

export function TitleSocial({ title }: { title: CatalogDetail }) {
  const [tab, setTab] = useState<"reviews" | "discussion">("reviews")
  return <section className={styles.socialSection}>
    <div className={styles.socialTabs} role="tablist" aria-label="Title activity">
      <button type="button" role="tab" aria-selected={tab === "reviews"} onClick={() => setTab("reviews")}>Reviews</button>
      <button type="button" role="tab" aria-selected={tab === "discussion"} onClick={() => setTab("discussion")}>Discussion</button>
    </div>
    <section className={styles.socialCard} role="tabpanel">
      <h2>{tab === "reviews" ? "Reviews" : "Discussion"}</h2>
      {tab === "reviews" ? <ReviewsPanel title={title} /> : <DiscussionPanel title={title} />}
    </section>
  </section>
}
