import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { useState, type FormEvent } from "react"
import { MAX_CUSTOM_LISTS } from "../features/lists/validation"
import styles from "../features/lists/list-manager.module.css"
import { ownProfileQuery } from "../features/profile/queries"
import { normalizeCatalogSearch, type CatalogTitle } from "../features/titles/catalog"
import { getCatalogTitles } from "../features/titles/catalog.functions"

export const Route = createFileRoute("/profile/edit-lists")({
  loader: async ({ context }) => {
    const result = await context.queryClient.ensureQueryData(ownProfileQuery())
    if (result.status === "unauthorized") throw redirect({ to: "/auth" })
    if (result.status === "not-found") throw redirect({ to: "/onboarding" })
    return result
  },
  head: () => ({ meta: [{ title: "Manage title lists — Bookworm" }] }),
  component: ListManagerPage,
  errorComponent: () => <main className={styles.shell}><h1>Title lists</h1><p>Your lists could not be loaded.</p></main>,
})

function ListManagerPage() {
  const { data } = useSuspenseQuery(ownProfileQuery())
  const queryClient = useQueryClient()
  const [activeId, setActiveId] = useState(() => data.status === "ok"
    ? data.lists.find((list) => list.type === "to-read")?.id ?? data.lists[0]?.id ?? ""
    : "")
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState("")
  const [results, setResults] = useState<CatalogTitle[]>([])
  const [searched, setSearched] = useState(false)
  if (data.status !== "ok") return null
  const defaultList = data.lists.find((list) => list.type === "to-read") ?? data.lists[0]
  const selected = data.lists.find((list) => list.id === activeId) ?? defaultList
  const customCount = data.lists.filter((list) => list.type === "custom").length

  async function mutate(payload: Record<string, unknown>) {
    const response = await fetch("/api/profile/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => null) as { id?: string; error?: string } | null
    if (!response.ok) throw new Error(body?.error ?? "List could not be updated")
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["profile", "own"] }),
      queryClient.invalidateQueries({ queryKey: ["diary"] }),
    ])
    return body
  }

  async function saveList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy("list")
    setFeedback("")
    const form = new FormData(event.currentTarget)
    try {
      const body = await mutate({
        action: creating ? "create" : "update",
        ...(creating ? {} : { listId: selected?.id }),
        name: String(form.get("name") ?? ""),
        isPublic: form.get("isPublic") === "on",
      })
      if (creating && body?.id) setActiveId(body.id)
      setCreating(false)
      setEditing(false)
      setFeedback(creating ? "List created." : "List updated.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "List could not be updated")
    } finally {
      setBusy(null)
    }
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy("search")
    setFeedback("")
    const form = new FormData(event.currentTarget)
    try {
      const found = await getCatalogTitles({ data: normalizeCatalogSearch({
        title: form.get("title"),
        author: form.get("author"),
      }) })
      setResults(found)
      setSearched(true)
    } catch {
      setFeedback("Catalog search failed.")
    } finally {
      setBusy(null)
    }
  }

  async function add(titleId: string) {
    if (!selected) return
    setBusy(titleId)
    setFeedback("")
    try {
      await mutate({ action: "add", listId: selected.id, titleId })
      setFeedback(selected.isDefault ? `Moved to ${selected.name}.` : `Added to ${selected.name}.`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Title could not be added")
    } finally {
      setBusy(null)
    }
  }

  async function remove(titleId: string) {
    if (!selected) return
    setBusy(titleId)
    setFeedback("")
    try {
      await mutate({ action: "remove", listId: selected.id, titleId })
      setFeedback("Title removed.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Title could not be removed")
    } finally {
      setBusy(null)
    }
  }

  const selectedIds = new Set(selected?.items.map((item) => item.titleId) ?? [])
  return <main className={styles.shell}>
    <div className={styles.top}><Link to="/">Bookworm</Link><nav><Link to="/profile">Profile</Link><Link to="/diary" search={{ filterBy: "none", genres: "", author: "", title: "" }}>Diary</Link></nav></div>
    <div className={styles.heading}><div><h1>Manage title lists</h1><p>Add local catalog titles to your reading workflow and custom collections.</p></div><Link className={styles.button} to="/profile">Back to profile</Link></div>
    {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
    {creating && <form className={styles.form} onSubmit={saveList}><label>List name<input name="name" type="text" maxLength={100} required autoFocus /></label><label className={styles.checkbox}><input name="isPublic" type="checkbox" defaultChecked />Public list</label><div className={styles.actions}><button className={styles.button} type="submit" disabled={busy !== null}>Create list</button><button className={styles.button} type="button" onClick={() => setCreating(false)}>Cancel</button></div></form>}
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label="Your title lists">{data.lists.map((list) => <button key={list.id} type="button" className={selected?.id === list.id ? styles.active : ""} onClick={() => { setActiveId(list.id); setEditing(false); setCreating(false); setResults([]); setSearched(false); setFeedback("") }}>{list.name}</button>)}<button className={styles.new} type="button" disabled={customCount >= MAX_CUSTOM_LISTS} onClick={() => { setCreating(true); setEditing(false) }}>+ New custom list</button></aside>
      <section className={styles.panel}>{selected ? <>
        <div className={styles.panelTop}><div><h2>{selected.name}</h2><p className={styles.meta}>{selected.type === "custom" ? `${selected.isPublic ? "Public" : "Private"} · ${selected.likes} likes` : "Default reading list"} · {selected.items.length} titles</p></div>{selected.type === "custom" && <button className={styles.button} type="button" onClick={() => setEditing((value) => !value)}>{editing ? "Close" : "List settings"}</button>}</div>
        {editing && <form className={styles.form} onSubmit={saveList}><label>List name<input name="name" type="text" maxLength={100} defaultValue={selected.name} required /></label><label className={styles.checkbox}><input name="isPublic" type="checkbox" defaultChecked={selected.isPublic} />Public list</label><button className={styles.button} type="submit" disabled={busy !== null}>Save settings</button></form>}
        {selected.items.length ? <ul className={styles.items}>{selected.items.map((item) => <li className={styles.item} key={item.titleId}>{item.coverUrl ? <img className={styles.cover} src={item.coverUrl} alt="" width="46" height="66" loading="lazy" /> : <span className={styles.coverFallback}>{item.title.slice(0, 1)}</span>}<div><Link to="/titles/$id" params={{ id: item.titleId }}><strong>{item.title}</strong></Link><span>{item.author ?? "Unknown author"}</span></div><button className={styles.button} type="button" onClick={() => { void remove(item.titleId) }} disabled={busy !== null}>{busy === item.titleId ? "Removing…" : "Remove"}</button></li>)}</ul> : <p className={styles.empty}>This list is empty.</p>}
        <form className={styles.search} onSubmit={search}><input name="title" type="search" maxLength={100} placeholder="Search title" aria-label="Search title" /><input name="author" type="search" maxLength={100} placeholder="Author (optional)" aria-label="Search author" /><button className={styles.button} type="submit" disabled={busy !== null}>{busy === "search" ? "Searching…" : "Search catalog"}</button></form>
        <p className={styles.searchNote}>{selected.isDefault ? "Adding here moves the title out of your other default reading lists." : "Only maintained local catalog titles are shown during this migration."}</p>
        {searched && !results.length && <p className={styles.empty}>No matching titles.</p>}
        {results.length > 0 && <ul className={styles.results}>{results.map((title) => <li className={styles.result} key={title.id}>{title.coverUrl ? <img className={styles.cover} src={title.coverUrl} alt="" width="46" height="66" loading="lazy" /> : <span className={styles.coverFallback}>{title.title.slice(0, 1)}</span>}<div><strong>{title.title}</strong><span>{title.author}</span></div><button className={styles.button} type="button" disabled={busy !== null || selectedIds.has(title.id)} onClick={() => { void add(title.id) }}>{selectedIds.has(title.id) ? "Added" : busy === title.id ? "Adding…" : "Add"}</button></li>)}</ul>}
      </> : <p className={styles.empty}>No lists are available.</p>}</section>
    </div>
  </main>
}
