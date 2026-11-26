import { createServerFn } from "@tanstack/react-start"
import { loadNotificationPage } from "./service.server"

export const getNotificationFirstPage = createServerFn({ method: "GET" })
  .handler(() => loadNotificationPage(null))
