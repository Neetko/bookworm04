import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import { computeWeightedTags, flattenWeightedTags } from "@/lib/book-tagging"
import { fetchOpenLibraryMetadataByIsbn } from "@/lib/open-library"
import { getGoogleBook } from "@/lib/google-books"

dotenv.config({ path: ".env.local" })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string

if (!url || !serviceRole) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.")
  process.exit(1)
}

const supabase = createClient(url, serviceRole)

type TrackedRow = {
  id: string
  title_id: string | null
  title: string
  author: string
  description: string | null
  isbn: string | null
  genre: string[] | null
  genre_weights: unknown | null
}

async function fetchGoogleVolumeIdMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const { data, error } = await supabase
    .from("external_books")
    .select("tracked_book_id,external_id")
    .eq("source", "google")

  if (error) {
    console.error("Failed to fetch external book mappings", error)
    return map
  }

  for (const row of data ?? []) {
    if (row.tracked_book_id && row.external_id) {
      map.set(row.tracked_book_id, row.external_id)
    }
  }

  return map
}

async function backfillTrackedBooks() {
  const { data, error } = await supabase
    .from("tracked_books")
    .select("id,title_id,title,author,description,isbn,genre,genre_weights")
    .or("genre_weights.is.null,genre.is.null")

  if (error) {
    console.error("Failed to fetch tracked books", error)
    process.exit(1)
  }

  const rows = (data ?? []) as TrackedRow[]
  if (rows.length === 0) {
    console.log("No tracked books missing genre weights.")
    return
  }

  const volumeIdMap = await fetchGoogleVolumeIdMap()

  let updated = 0
  for (const row of rows) {
    try {
      const volumeId = volumeIdMap.get(row.id) ?? null
      const googleBook = volumeId ? await getGoogleBook(volumeId) : null
      const openLibrary = row.isbn ? await fetchOpenLibraryMetadataByIsbn(row.isbn) : null

      const weightedTags = computeWeightedTags({
        title: googleBook?.title ?? row.title,
        googleMainCategory: googleBook?.mainCategory ?? null,
        googleCategories: googleBook?.categories ?? [],
        googleDescription: googleBook?.description ?? row.description ?? null,
        openLibrary,
      })

      if (weightedTags.length === 0) continue

      const genres = flattenWeightedTags(weightedTags)

      const { error: updateError } = await supabase
        .from("tracked_books")
        .update({
          genre: genres.length > 0 ? genres : null,
          genre_weights: weightedTags,
        })
        .eq("id", row.id)

      if (updateError) {
        console.error("Failed to update tracked_books", row.id, updateError)
        continue
      }

      if (row.title_id) {
        const { error: titleError } = await supabase
          .from("titles")
          .update({ genre_weights: weightedTags })
          .eq("id", row.title_id)
        if (titleError) {
          console.error("Failed to update titles", row.title_id, titleError)
        }
      }

      updated += 1
    } catch (err) {
      console.error("Backfill failed for tracked book", row.id, err)
    }
  }

  console.log(`Updated ${updated} tracked book rows.`)
}

backfillTrackedBooks().catch((err) => {
  console.error(err)
  process.exit(1)
})
