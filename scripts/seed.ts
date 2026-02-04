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

async function main() {
  const desiredTitles = [
    "Crossroads",
    "The Wise Man's Fear",
    "The Name of the Wind",
    "The Hobbit",
  ]

  const { data: titleRows, error: titlesError } = await supabase
    .from("titles")
    .select("id, title, author, description, cover_image_url, published_year, isbn")
    .in("title", desiredTitles)

  if (titlesError) {
    console.error("Error fetching titles:", titlesError)
    process.exit(1)
  }

  const titles = titleRows ?? []
  if (!titles.length) {
    console.error("No matching titles found in the titles table.")
    process.exit(1)
  }

  const { data: existingBooks, error: existingError } = await supabase
    .from("books")
    .select("id, title")
    .in("title", desiredTitles)

  if (existingError) {
    console.error("Error checking existing books:", existingError)
    process.exit(1)
  }

  const existingByTitle = new Map((existingBooks ?? []).map((b) => [b.title, b]))

  const booksToInsert = titles
    .filter((row) => !existingByTitle.has(row.title))
    .map((row) => ({
      title_id: row.id,
      title: row.title,
      author: row.author,
      description: row.description,
      cover_image_url: row.cover_image_url,
      published_year: row.published_year,
      isbn: row.isbn,
    }))

  let insertedBooks: Array<{ id: string; title: string }> = []

  if (booksToInsert.length > 0) {
    const { data, error } = await supabase.from("books").insert(booksToInsert).select("id, title")
    if (error) {
      console.error("Seeding books failed:", error)
      process.exit(1)
    }
    insertedBooks = data ?? []
  }

  const allSeededBooks = [...(existingBooks ?? []), ...insertedBooks]

  const lorem =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. " +
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. " +
    "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. " +
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."

  const contentRows = allSeededBooks.map((book) => ({
    book_id: book.id,
    content: `Sample content for ${book.title}\n\n${lorem}`,
  }))

  const { error: contentError } = await supabase
    .from("book_contents")
    .upsert(contentRows, { onConflict: "book_id" })

  if (contentError) {
    console.error("Seeding book contents failed:", contentError)
    process.exit(1)
  }

  console.log("Seeded books and book contents successfully.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
