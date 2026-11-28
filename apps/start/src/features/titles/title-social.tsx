import { useEffect, useState, type FormEvent } from "react"
import { Link, useRouter } from "@tanstack/react-router"
import { formatDate } from "../date-format"
import type { CatalogDetail, CatalogDiscussionPost, CatalogReview } from "./catalog"
import { RichTextEditor } from "./rich-text-editor"
import styles from "./catalog.module.css"

type SocialResult = {
  error?: string
  liked?: boolean
  likesCount?: number
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

function ReviewComposer({ title }: { title: CatalogDetail }) {
  const router = useRouter()
  const existing = title.viewer.review
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [html, setHtml] = useState(existing?.html ?? "")
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState("")

  useEffect(() => {
    setRating(existing?.rating ?? 0)
    setHtml(existing?.html ?? "")
  }, [existing?.id, existing?.rating, existing?.html])

  if (!title.viewer.isRead) {
    return <div className={styles.lockedComposer}>
      <strong>Reviews unlock after reading.</strong>
      <p>{title.viewer.signedIn
        ? "Mark this title as read to rate it and write a review."
        : "Sign in and mark this title as read to rate it and write a review."}</p>
    </div>
  }

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

  return <form className={styles.reviewComposer} onSubmit={submit}>
    <div className={styles.composerHeading}>
      <div><p className={styles.eyebrow}>Your take</p><h3>{existing ? "Update your review" : "Review this title"}</h3></div>
      <output aria-live="polite"><strong>{rating || "—"}</strong><span>/10</span></output>
    </div>
    <fieldset className={styles.ratingPicker}>
      <legend>Rating from 1 to 10</legend>
      <div>{Array.from({ length: 10 }, (_, index) => index + 1).map((score) => <label key={score} data-selected={rating === score}>
        <input type="radio" name={`rating-${title.id}`} value={score} checked={rating === score} onChange={() => setRating(score)} />
        <span>{score}</span>
      </label>)}</div>
    </fieldset>
    <label className={styles.editorLabel}>Your review</label>
    <RichTextEditor
      value={html}
      onChange={(nextHtml) => setHtml(nextHtml)}
      label="Your review"
      placeholder="What stayed with you?"
      disabled={pending}
    />
    <div className={styles.composerFooter}>
      <p>{feedback || (existing ? "Saving replaces your previous rating and review." : "You can revise this review later.")}</p>
      <button className={`${styles.actionButton} ${styles.actionPrimary}`} type="submit" disabled={pending || rating === 0}>
        {pending ? "Saving…" : existing ? "Update review" : "Publish review"}
      </button>
    </div>
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
    {reviews.length === 0 ? <p className={styles.empty}>No reviews yet. Be the first reader to review it.</p> : <div className={styles.reviewGrid}>
      {reviews.map((review) => <article className={styles.review} key={review.id}>
        <div className={styles.reviewHeader}>
          <ReviewerLink userId={review.userId} username={review.username} />
          <strong>{review.rating}/10</strong>
        </div>
        {review.html ? <div className={styles.richOutput} dangerouslySetInnerHTML={{ __html: review.html }} /> : null}
        <div className={styles.socialMeta}>
          <small>{formatDate(review.createdAt)}</small>
          <button
            type="button"
            data-liked={review.viewerHasLiked}
            disabled={!title.viewer.signedIn || pendingLike === review.id}
            title={title.viewer.signedIn ? "Like this review" : "Sign in to like reviews"}
            onClick={() => void toggleLike(review)}
          ><span aria-hidden="true">♥</span> {review.likesCount}</button>
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

  if (!title.viewer.isRead) {
    return <div className={styles.lockedComposer}>
      <strong>Read-only discussion</strong>
      <p>{title.viewer.signedIn
        ? "Mark this title as read to post. You can still read every discussion below."
        : "Sign in and mark this title as read to post. You can still read every discussion below."}</p>
    </div>
  }

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
    <div className={styles.composerHeading}><div><p className={styles.eyebrow}>Discussion</p><h3>Share your thoughts</h3></div></div>
    <RichTextEditor
      value={html}
      onChange={(nextHtml, nextText) => { setHtml(nextHtml); setText(nextText) }}
      label="Discussion post"
      placeholder="Share an insight, favourite moment, or question…"
      disabled={pending}
    />
    <div className={styles.composerFooter}>
      <p>{feedback || `${text.length} characters`}</p>
      <button className={`${styles.actionButton} ${styles.actionPrimary}`} type="submit" disabled={pending || !text.trim()}>{pending ? "Posting…" : "Post"}</button>
    </div>
  </form>
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
      {posts.map((post) => <article className={styles.discussionPost} key={post.id}>
        <aside>
          {post.avatarUrl ? <img src={post.avatarUrl} alt="" width="48" height="48" loading="lazy" decoding="async" /> : <span aria-hidden="true">B</span>}
          <ReviewerLink userId={post.userId} username={post.username} />
        </aside>
        <div className={styles.discussionBody}>
          <small>Posted {formatDate(post.createdAt)}</small>
          <div className={styles.richOutput} dangerouslySetInnerHTML={{ __html: post.html }} />
          <button
            type="button"
            data-liked={post.viewerHasLiked}
            disabled={!title.viewer.isRead || pendingLike === post.id}
            title={title.viewer.isRead ? "Like this post" : "Mark this title as read to like discussion posts"}
            onClick={() => void toggleLike(post)}
          ><span aria-hidden="true">♥</span> {post.likesCount}</button>
        </div>
      </article>)}
    </div>}
  </div>
}

export function TitleSocial({ title }: { title: CatalogDetail }) {
  const [tab, setTab] = useState<"reviews" | "discussion">("reviews")
  return <section className={styles.socialSection}>
    <div className={styles.socialTabs} role="tablist" aria-label="Title activity">
      <button type="button" role="tab" aria-selected={tab === "reviews"} onClick={() => setTab("reviews")}>Reviews <span>{title.reviews.length}</span></button>
      <button type="button" role="tab" aria-selected={tab === "discussion"} onClick={() => setTab("discussion")}>Discussion <span>{title.discussionPosts.length}</span></button>
    </div>
    <div role="tabpanel">{tab === "reviews" ? <ReviewsPanel title={title} /> : <DiscussionPanel title={title} />}</div>
  </section>
}
