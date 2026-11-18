"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type EnrollingFactor = {
  id: string
  qrCode: string
  secret: string
}

export function AdminMfaGate() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null)
  const [enrollingFactor, setEnrollingFactor] = useState<EnrollingFactor | null>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadFactors() {
      const { data, error: listError } = await supabase.auth.mfa.listFactors()
      if (!active) return

      if (listError) {
        setError("Could not load your authenticator settings. Refresh and try again.")
      } else {
        const factor = data.totp.find((item) => item.status === "verified")
        setVerifiedFactorId(factor?.id ?? null)
      }
      setLoading(false)
    }

    void loadFactors()
    return () => { active = false }
  }, [])

  async function startEnrollment() {
    setBusy(true)
    setError(null)

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Bookworm staff",
    })

    if (enrollError || !data?.totp?.qr_code || !data.totp.secret) {
      setError(enrollError?.message ?? "Could not start authenticator setup.")
    } else {
      setEnrollingFactor({
        id: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      })
    }

    setBusy(false)
  }

  async function verifyCode() {
    const factorId = enrollingFactor?.id ?? verifiedFactorId
    const normalizedCode = code.trim()
    if (!factorId || !/^\d{6}$/.test(normalizedCode)) {
      setError("Enter the six-digit code from your authenticator app.")
      return
    }

    setBusy(true)
    setError(null)

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError || !challenge?.id) {
      setError(challengeError?.message ?? "Could not start verification.")
      setBusy(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: normalizedCode,
    })

    if (verifyError) {
      setError(verifyError.message)
      setBusy(false)
      return
    }

    setCode("")
    router.refresh()
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle><h1>Staff verification</h1></CardTitle>
        <CardDescription>
          Enter a code from your authenticator app before using staff tools.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <p className="text-sm text-muted-foreground">Loading authenticator settings…</p> : null}

        {!loading && !verifiedFactorId && !enrollingFactor ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Set up an authenticator app to protect moderator and admin access.
            </p>
            <Button type="button" onClick={startEnrollment} disabled={busy}>
              {busy ? "Preparing…" : "Set up authenticator"}
            </Button>
          </div>
        ) : null}

        {enrollingFactor ? (
          <div className="space-y-3">
            <p className="text-sm">Scan this code with your authenticator app.</p>
            {/* Supabase supplies the QR SVG for this account; an img does not execute SVG scripts. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(enrollingFactor.qrCode)}`}
              alt="Authenticator setup QR code"
              width={200}
              height={200}
            />
            <p className="break-all text-xs text-muted-foreground">
              Can’t scan it? Enter this key manually: <code>{enrollingFactor.secret}</code>
            </p>
          </div>
        ) : null}

        {!loading && (verifiedFactorId || enrollingFactor) ? (
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void verifyCode() }}>
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              aria-label="Authenticator code"
              placeholder="Six-digit code"
              required
            />
            <Button type="submit" disabled={busy}>
              {busy ? "Verifying…" : "Verify and continue"}
            </Button>
          </form>
        ) : null}

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
