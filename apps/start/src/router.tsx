import { createRouter } from "@tanstack/react-router"
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
  return createRouter({
    routeTree,
    scrollRestoration: true,
    ssr: getSsrOptions(),
  })
}
