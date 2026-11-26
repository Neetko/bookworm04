import { useEffect, useState, type FormEvent } from "react"
import styles from "./staff.module.css"

export function StaffMfa() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [error, setError] = useState("")
  useEffect(() => { void fetch("/api/staff/mfa").then((response) => response.json()).then((data: { verifiedFactorId?: string | null }) => setFactorId(data.verifiedFactorId ?? null)).catch(() => setError("Could not load authenticator settings")).finally(() => setLoading(false)) }, [])
  async function enroll() {
    setBusy(true); setError("")
    const response = await fetch("/api/staff/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "enroll" }) })
    const data = await response.json().catch(() => null) as { factorId?: string; qrCode?: string; secret?: string; error?: string } | null
    setBusy(false)
    if (!response.ok || !data?.factorId || !data.qrCode || !data.secret) { setError(data?.error ?? "Could not start setup"); return }
    setFactorId(data.factorId); setQrCode(data.qrCode); setSecret(data.secret)
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!factorId) return; setBusy(true); setError("")
    const code = String(new FormData(event.currentTarget).get("code") ?? "")
    const response = await fetch("/api/staff/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", factorId, code }) })
    const data = await response.json().catch(() => null) as { error?: string } | null
    setBusy(false)
    if (!response.ok) { setError(data?.error ?? "Verification failed"); return }
    window.location.reload()
  }
  return <section className={styles.card}><h1>Staff verification</h1><p className={styles.muted}>Use an authenticator code before opening staff tools.</p>{loading ? <p>Loading…</p> : !factorId ? <button className={styles.button} onClick={() => void enroll()} disabled={busy}>{busy ? "Preparing…" : "Set up authenticator"}</button> : null}{qrCode && <div><img className={styles.qr} src={`data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`} alt="Authenticator QR code" width="200" height="200" /><p className={styles.secret}>Manual key: <code>{secret}</code></p></div>}{factorId && <form className={styles.form} onSubmit={verify}><input className={styles.input} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="Six-digit code" required /><button className={styles.button} disabled={busy}>{busy ? "Verifying…" : "Verify"}</button></form>}{error && <p className={styles.error} role="alert">{error}</p>}</section>
}
