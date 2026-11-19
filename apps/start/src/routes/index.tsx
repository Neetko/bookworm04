import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: MigrationPreview,
})

function MigrationPreview() {
  return (
    <main>
      <h1>Bookworm migration preview</h1>
      <p>This isolated app verifies the TanStack Start runtime before routes move over.</p>
    </main>
  )
}
