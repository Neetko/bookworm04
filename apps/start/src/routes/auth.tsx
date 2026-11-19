import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/auth")({
  component: AuthPage,
})

function AuthPage() {
  return (
    <main>
      <h1>Sign in to Bookworm</h1>
      <form action="/api/auth/google" method="post">
        <button type="submit">Continue with Google</button>
      </form>
    </main>
  )
}
