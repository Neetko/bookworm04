import { readBoundedJson } from "../../server/bounded-json.server"
import { markNotificationsRead, respondToClubInvitation } from "./service.server"
import { parseInvitationResponse, parseNotificationReadCommand } from "./validation"

const maxRequestBytes = 4_096

function json(body: unknown, status: number) {
  return Response.json(body, { status })
}

export async function handleNotificationRead(request: Request): Promise<Response> {
  const body = await readBoundedJson(request, maxRequestBytes)
  if (!body.ok) return json({ error: body.error }, body.status)
  const command = parseNotificationReadCommand(body.value)
  if (!command) return json({ error: "Invalid notification update" }, 400)
  const result = await markNotificationsRead(command)
  if (result.status === "unauthorized") return json({ error: "Unauthorized" }, 401)
  return json({ success: true, updated: result.updated }, 200)
}

export async function handleInvitationResponse(request: Request): Promise<Response> {
  const body = await readBoundedJson(request, maxRequestBytes)
  if (!body.ok) return json({ error: body.error }, body.status)
  const command = parseInvitationResponse(body.value)
  if (!command) return json({ error: "Invalid invitation response" }, 400)
  const result = await respondToClubInvitation(command)
  if (result.status === "unauthorized") return json({ error: "Unauthorized" }, 401)
  if (result.status === "rejected") return json({ error: "Invitation could not be updated" }, 409)
  return json({ success: true, clubId: result.clubId }, 200)
}
