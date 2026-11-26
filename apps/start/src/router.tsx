import { QueryClient } from "@tanstack/react-query"
import { createRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import { createIsomorphicFn } from "@tanstack/react-start"
import { routeTree } from "./routeTree.gen"

const getSsrOptions = createIsomorphicFn().server(() => {
  const random = new Uint8Array(16)
  crypto.getRandomValues(random)

  return {
    nonce: Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join(""),
  }
})

export function getRouter() {
  // Start creates a router for each server request. Keep its query cache inside
  // that request so one reader's data cannot be reused in another reader's SSR.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  })
  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    // Keep direct loader preloads warm long enough for the ensuing navigation.
    // Routes backed by React Query still apply their own finer-grained policy.
    defaultPreloadStaleTime: 30_000,
    scrollRestoration: true,
    ssr: getSsrOptions(),
  })

  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}
