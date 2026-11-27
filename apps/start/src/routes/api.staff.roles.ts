import { createFileRoute } from "@tanstack/react-router"
import { handleRoleChange } from "../features/staff/staff.server"

export const Route = createFileRoute("/api/staff/roles")({ server: { handlers: { POST: ({ request }) => handleRoleChange(request) } } })
