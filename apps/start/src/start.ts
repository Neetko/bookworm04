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

// A custom Start instance replaces the framework's automatic CSRF middleware.
// Cover both server functions and unsafe API route requests.
export const startInstance = createStart(() => ({
  requestMiddleware: [
    privateResponse,
    createCsrfMiddleware({
      filter: ({ handlerType, request }) =>
        handlerType === "serverFn" ||
        !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase()),
    }),
  ],
}))
