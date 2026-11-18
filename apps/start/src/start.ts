import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"

const privateResponse = createMiddleware().server(({ next }) => {
  setResponseHeader("Cache-Control", "private, no-store, max-age=0")
  setResponseHeader("X-Content-Type-Options", "nosniff")
  setResponseHeader("Referrer-Policy", "strict-origin-when-cross-origin")
  return next()
})

// A custom Start instance replaces the framework's automatic server-function
// CSRF middleware, so keep its same-origin check explicitly installed.
export const startInstance = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" }),
    privateResponse,
  ],
}))
