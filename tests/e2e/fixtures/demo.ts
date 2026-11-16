export const DEMO_READER = {
  profileId: "20000000-0000-4000-8000-000000000001",
  email: "demo@bookworm.test",
  password: "BookwormDemo!2026",
  username: "Demo Reader",
} as const

export const DEMO_TITLES = {
  frankenstein: {
    id: "8118851f-6df9-4724-bfe2-20495087fd3b",
    title: "Frankenstein",
  },
  prideAndPrejudice: {
    id: "dbf57f4e-cabd-40b5-a6cb-89824eb6868f",
    title: "Pride and Prejudice",
  },
} as const

export function uniqueLocalReaderEmail() {
  return `new-reader-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@bookworm.test`
}
