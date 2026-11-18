import "server-only"

import { createServerClient } from "@/lib/supabase-server"

export async function hasVerifiedStaffSession(): Promise<boolean> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  if (error) {
    console.error("Failed to check staff MFA level", error)
    return false
  }

  return data.currentLevel === "aal2" && data.nextLevel === "aal2"
}

export async function requireVerifiedStaffSession(): Promise<void> {
  if (!(await hasVerifiedStaffSession())) {
    throw new Error("Verify your authenticator before using staff tools")
  }
}
