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
  // Seed books if table exists and empty
  const { data: countData, error: countErr } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true })

  if (countErr) {
    console.error("Error checking books table:", countErr)
    process.exit(1)
  }

  // Clear existing books to avoid duplicates and schema conflicts
  const { error: deleteError } = await supabase.from("books").delete().neq("id", "00000000-0000-0000-0000-000000000000")
  if (deleteError) {
    console.error("Error clearing books:", deleteError)
  }

  // Insert sample books with multiple genres
  const books = [
    {
      title: "The Hobbit",
      author: "J.R.R. Tolkien",
      description: "Bilbo Baggins, a hobbit, is swept into an epic quest to reclaim the lost Kingdom of Erebor from the fearsome dragon Smaug.",
      genre: ["Fantasy", "Adventure"],
      published_year: 1937,
      isbn: "978-0-547-92822-7",
      cover_image_url: "https://images.unsplash.com/photo-1621351183012-e2f9972dd9bf?auto=format&fit=crop&q=80&w=1000",
    },
    {
      title: "Dune",
      author: "Frank Herbert",
      description: "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only thing of value is the 'spice' melange.",
      genre: ["Sci-Fi", "Adventure"],
      published_year: 1965,
      isbn: "978-0-441-17271-9",
      cover_image_url: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=1000",
    },
    {
      title: "Dracula",
      author: "Bram Stoker",
      description: "The vampire Count Dracula moves from Transylvania to England so that he may find new blood and spread the undead curse, and of the battle between him and a small group of people led by Professor Abraham Van Helsing.",
      genre: ["Horror", "Fantasy"],
      published_year: 1897,
      isbn: "978-0-486-41109-5",
      cover_image_url: "https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&q=80&w=1000",
    },
    {
      title: "Pride and Prejudice",
      author: "Jane Austen",
      description: "The story follows the main character, Elizabeth Bennet, as she deals with issues of manners, upbringing, morality, education, and marriage in the society of the landed gentry of the British Regency.",
      genre: ["Romance"],
      published_year: 1813,
      isbn: "978-0-14-143951-8",
      cover_image_url: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=1000",
    },
    {
      title: "Frankenstein",
      author: "Mary Shelley",
      description: "Victor Frankenstein, a young scientist, creates a grotesque but sentient creature in an unorthodox scientific experiment.",
      genre: ["Sci-Fi", "Horror"],
      published_year: 1818,
      isbn: "978-0-486-28211-4",
      cover_image_url: "https://images.unsplash.com/photo-1536237880829-dd441c24710d?auto=format&fit=crop&q=80&w=1000",
    },
  ]

  const { data: insertedBooks, error } = await supabase.from("books").insert(books).select()
  if (error) {
    console.error("Seeding books failed:", error)
    process.exit(1)
  }

  console.log("Seeded books successfully.")

  // Seed book contents with empty content
  const bookContents = insertedBooks.map((book) => ({
    book_id: book.id,
    content: "", // Empty content as requested
  }))

  const { error: contentError } = await supabase.from("book_contents").insert(bookContents)
  if (contentError) {
    console.error("Seeding book contents failed:", contentError)
    process.exit(1)
  }

  console.log("Seeded book contents (empty) successfully.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
