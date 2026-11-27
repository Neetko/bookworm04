import { createFileRoute } from "@tanstack/react-router"
import { handleStaffMfa } from "../features/staff/staff.server"

export const Route = createFileRoute("/api/staff/mfa")({ server: { handlers: { GET: ({ request }) => handleStaffMfa(request), POST: ({ request }) => handleStaffMfa(request) } } })
