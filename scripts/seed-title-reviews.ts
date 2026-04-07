import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string

if (!url || !serviceRole) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.")
  process.exit(1)
}

const supabase = createClient(url, serviceRole)

const reviewSnippets = [
  "Loved the pacing and the characters. A standout read.",
  "Great atmosphere and tight plotting. Highly recommend.",
  "Strong start, satisfying ending. Would read again.",
  "Surprising twists and beautiful prose throughout.",
  "A thoughtful, immersive story that lingered with me.",
]

function pickRandom<T>(items: T[], count: number) {
  const shuffled = [...items].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

async function ensureFinishedReadingList(profileId: string) {
  const { data: existing, error: fetchError } = await supabase
    .from("title_lists")
    .select("id")
    .eq("user_profile_id", profileId)
    .eq("list_type", "finished-reading")
    .maybeSingle()

  if (fetchError) {
    console.error("Failed to fetch finished list", fetchError)
    process.exit(1)
  }

  if (existing?.id) return existing.id as string

  const { data: created, error: createError } = await supabase
    .from("title_lists")
    .insert({
      user_profile_id: profileId,
      name: "Finished Reading",
      list_type: "finished-reading",
      is_public: false,
      is_default: true,
    })
    .select("id")
    .single()

  if (createError || !created?.id) {
    console.error("Failed to create finished list", createError)
    process.exit(1)
  }

  return created.id as string
}

async function seed() {
  const { data: users, error: userError } = await supabase
    .from("user_profiles")
    .select("id, username")

  if (userError) {
    console.error("Failed to fetch users", userError)
    process.exit(1)
  }

  const { data: titles, error: titleError } = await supabase
    .from("titles")
    .select("id, title, author")
    .order("created_at", { ascending: false })
    .limit(12)

  if (titleError) {
    console.error("Failed to fetch titles", titleError)
    process.exit(1)
  }

  if (!users?.length || !titles?.length) {
    console.error("Need existing users and titles to seed reviews")
    process.exit(1)
  }

  for (const user of users) {
    const finishedListId = await ensureFinishedReadingList(user.id)
    const chosenTitles = pickRandom(titles, Math.min(3, titles.length))

    for (const title of chosenTitles) {
      await supabase
        .from("title_list_items")
        .upsert(
          { list_id: finishedListId, title_id: title.id },
          { onConflict: "list_id,title_id" }
        )

      const rating = Math.floor(Math.random() * 4) + 7
      const reviewText = reviewSnippets[Math.floor(Math.random() * reviewSnippets.length)]

      const { error: reviewError } = await supabase
        .from("reviews")
        .upsert(
          {
            user_id: user.id,
            title_id: title.id,
            book_id: null,
            rating,
            review_text: reviewText,
          },
          { onConflict: "user_id,title_id" }
        )

      if (reviewError) {
        console.error("Failed to seed review", reviewError)
        process.exit(1)
      }
    }
  }

  console.log("Seeded reviews for existing users.")
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
