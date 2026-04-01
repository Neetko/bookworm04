import { isGenre, type Genre } from "@/lib/types"
import type { OpenLibraryMetadata } from "@/lib/open-library"

export type TaggingInput = {
  title?: string | null
  googleMainCategory?: string | null
  googleCategories?: string[] | null
  googleDescription?: string | null
  openLibrary?: OpenLibraryMetadata | null
}

const TOP_LEVEL_FICTION = ["FICTION", "JUVENILE FICTION", "YOUNG ADULT FICTION"]

const NON_FICTION_TOP_LEVEL = [
  "BIOGRAPHY & AUTOBIOGRAPHY",
  "HISTORY",
  "PHILOSOPHY",
  "PSYCHOLOGY",
  "SOCIAL SCIENCE",
  "SCIENCE",
  "SELF-HELP",
  "BUSINESS",
  "TRUE CRIME",
  "RELIGION",
  "COOKING",
  "TRAVEL",
  "REFERENCE",
  "ART",
  "POLITICAL SCIENCE",
]

const FICTION_TOP_LEVEL_MARKERS = [
  "SCIENCE FICTION",
  "FANTASY",
  "ROMANCE",
  "HORROR",
  "MYSTERY",
  "THRILLER",
  "CRIME",
  "ACTION & ADVENTURE",
  "ADVENTURE",
  "WESTERNS",
  "DYSTOPIAN",
  "GHOST",
  "OCCULT",
]

const KEYWORDS: Record<Genre, string[]> = {
  HORROR: ["occult", "slasher", "gothic", "monsters", "ghost", "splatterpunk"],
  ROMANCE: ["erotica", "relationships", "clean & wholesome", "billionaire"],
  FANTASY: [
    "fantasy",
    "high fantasy",
    "epic fantasy",
    "sword & sorcery",
    "magic realism",
    "urban fantasy",
    "gaslamp fantasy",
    "grimdark",
    "dragons",
    "wizards",
    "witches",
    "mythology",
    "fairy tales",
    "paranormal",
    "supernatural",
    "dark fantasy",
    "arthurian",
    "quest",
    "magical",
    "legends",
    "sword and sorcery",
    "grimdark",
  ],
  "SCI-FI": [
    "science fiction",
    "sci fi",
    "sci-fi",
    "space opera",
    "dystopian",
    "cyberpunk",
    "steampunk",
    "androids",
    "time travel",
    "alien",
    "galactic empire",
  ],
  ADVENTURE: ["action & adventure", "survival", "war", "military", "sea stories", "westerns", "exploration"],
  MYSTERY: ["mystery", "detective", "crime", "thriller", "suspense", "true crime", "noir", "procedural"],
  "NON-FICTION": [
    "nonfiction",
    "biography",
    "autobiography",
    "history",
    "philosophy",
    "psychology",
    "social science",
    "science",
    "self-help",
    "business",
    "true crime",
  ],
}

const BISAC_KEYWORDS: Record<Genre, string[]> = {
  HORROR: ["horror", "occult", "supernatural", "slasher", "gothic", "monsters", "ghost stories"],
  ROMANCE: ["romance", "love stories", "erotica", "relationships", "clean & wholesome"],
  FANTASY: [
    "fantasy",
    "high fantasy",
    "epic fantasy",
    "magic",
    "dragons",
    "fairy tales",
    "mythology",
    "urban fantasy",
    "magic realism",
    "sword and sorcery",
    "grimdark",
  ],
  "SCI-FI": [
    "science fiction",
    "sci fi",
    "sci-fi",
    "space opera",
    "dystopian",
    "cyberpunk",
    "steampunk",
    "androids",
    "time travel",
    "alien",
    "galactic empire",
  ],
  ADVENTURE: ["action & adventure", "survival", "war", "military", "sea stories", "westerns", "exploration"],
  MYSTERY: ["mystery", "detective", "crime", "thriller", "suspense", "true crime", "noir", "procedural"],
  "NON-FICTION": [
    "nonfiction",
    "biography",
    "autobiography",
    "history",
    "philosophy",
    "psychology",
    "social science",
    "science",
    "self-help",
    "business",
    "true crime",
  ],
}

const CROSSOVER_TRIGGERS: Array<{ phrase: string; tags: Genre[] }> = [
  { phrase: "dark fantasy", tags: ["HORROR", "FANTASY"] },
  { phrase: "romantic suspense", tags: ["ROMANCE", "MYSTERY"] },
  { phrase: "science fiction / fantasy", tags: ["SCI-FI", "FANTASY"] },
  { phrase: "science fiction fantasy", tags: ["SCI-FI", "FANTASY"] },
  { phrase: "steampunk", tags: ["SCI-FI", "ADVENTURE"] },
  { phrase: "heist", tags: ["ADVENTURE", "MYSTERY"] },
  { phrase: "psychological thriller", tags: ["MYSTERY", "HORROR"] },
  { phrase: "biographical fiction", tags: ["NON-FICTION", "ADVENTURE"] },
  { phrase: "urban fantasy", tags: ["FANTASY", "MYSTERY"] },
  { phrase: "space opera", tags: ["SCI-FI", "ADVENTURE"] },
  { phrase: "galactic empire", tags: ["SCI-FI", "ADVENTURE"] },
]

function addGenresFromKeywords(target: Set<Genre>, text: string, keywords: Record<Genre, string[]>) {
  const normalized = normalizeCategory(text)
  if (!normalized) return

  for (const [genre, list] of Object.entries(keywords) as Array<[Genre, string[]]>) {
    if (list.some((keyword) => normalized.includes(normalizeCategory(keyword)))) {
      target.add(genre)
    }
  }

  if (normalized.includes("thriller") || normalized.includes("suspense")) {
    target.add("MYSTERY")
  }

  if (normalized.includes("psychological") && normalized.includes("thriller")) {
    target.add("HORROR")
  }
}

function addCrossoverGenres(target: Set<Genre>, text: string) {
  const normalized = normalizeCategory(text)
  for (const trigger of CROSSOVER_TRIGGERS) {
    if (normalized.includes(normalizeCategory(trigger.phrase))) {
      for (const tag of trigger.tags) {
        target.add(tag)
      }
    }
  }
}

function normalizeCategory(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[\/:\-]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function splitBisacSegments(value: string): string[] {
  return value
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function isNonFictionTopLevel(segment: string): boolean {
  const trimmed = segment.trim().toUpperCase()
  if (TOP_LEVEL_FICTION.some((prefix) => trimmed.startsWith(prefix))) return false
  if (FICTION_TOP_LEVEL_MARKERS.some((marker) => trimmed.includes(marker))) return false
  if (NON_FICTION_TOP_LEVEL.some((marker) => trimmed.startsWith(marker))) return true
  return !trimmed.includes("FICTION")
}

function beginsWithReliabilityNonFiction(value: string): boolean {
  const trimmed = value.trim().toUpperCase()
  if (trimmed.includes("SCIENCE FICTION") || trimmed.includes("SCI FI") || trimmed.includes("SCI-FI")) {
    return false
  }
  return (
    trimmed.startsWith("BIO") ||
    trimmed.startsWith("HIS") ||
    trimmed.startsWith("PHI") ||
    trimmed.startsWith("PSY") ||
    trimmed.startsWith("SOC") ||
    trimmed.startsWith("SCI") ||
    trimmed.startsWith("BUS") ||
    trimmed.startsWith("TRC")
  )
}

function mapBisacToGenre(value: string): Genre | null {
  const normalized = normalizeCategory(value)

  if (
    normalized.includes("science fiction") ||
    normalized.includes("sci fi") ||
    normalized.includes("sci-fi") ||
    normalized.includes("dystopian") ||
    normalized.includes("cyberpunk") ||
    normalized.includes("space opera") ||
    normalized.includes("afrofuturism") ||
    normalized.includes("time travel") ||
    normalized.includes("hard science fiction")
  ) {
    return "SCI-FI"
  }

  if (
    normalized.includes("fantasy") ||
    normalized.includes("magic") ||
    normalized.includes("sword") ||
    normalized.includes("grimdark") ||
    normalized.includes("gaslamp") ||
    normalized.includes("urban fantasy")
  ) {
    return "FANTASY"
  }

  if (normalized.includes("romance")) return "ROMANCE"

  if (
    normalized.includes("horror") ||
    normalized.includes("supernatural") ||
    normalized.includes("ghost") ||
    normalized.includes("occult")
  ) {
    return "HORROR"
  }

  if (
    normalized.includes("mystery") ||
    normalized.includes("detective") ||
    normalized.includes("thriller") ||
    normalized.includes("crime") ||
    normalized.includes("psychological")
  ) {
    return "MYSTERY"
  }

  if (
    normalized.includes("action") ||
    normalized.includes("adventure") ||
    normalized.includes("war") ||
    normalized.includes("military") ||
    normalized.includes("western") ||
    normalized.includes("sea stories")
  ) {
    return "ADVENTURE"
  }

  if (!normalized.includes("fiction") && !normalized.includes("juvenile fiction")) {
    return "NON-FICTION"
  }

  return null
}

function addTagWeight(
  map: Map<Genre, { weight: number; sources: string[] }>,
  tag: Genre,
  weight: number,
  source: string
) {
  const current = map.get(tag)
  if (!current) {
    map.set(tag, { weight: Math.min(1, weight), sources: [source] })
    return
  }

  const nextWeight = Math.min(1, current.weight + weight)
  const sources = current.sources.includes(source) ? current.sources : [...current.sources, source]
  map.set(tag, { weight: nextWeight, sources })
}

function countOccurrences(text: string, phrase: string): number {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`\\b${escaped}\\b`, "gi")
  const matches = text.match(regex)
  return matches ? matches.length : 0
}

function applyCrossover(
  map: Map<Genre, { weight: number; sources: string[] }>,
  text: string,
  weight: number,
  source: string
) {
  for (const trigger of CROSSOVER_TRIGGERS) {
    if (text.includes(trigger.phrase)) {
      for (const tag of trigger.tags) {
        addTagWeight(map, tag, weight, `${source}: ${trigger.phrase}`)
      }
    }
  }
}

function applyKeywords(
  map: Map<Genre, { weight: number; sources: string[] }>,
  text: string,
  weight: number,
  source: string,
  keywords: Record<Genre, string[]>
) {
  const isSciFiContext =
    text.includes("science fiction") ||
    text.includes("sci fi") ||
    text.includes("sci-fi") ||
    text.includes("scifi")

  for (const [genre, list] of Object.entries(keywords) as Array<[Genre, string[]]>) {
    for (const keyword of list) {
      const normalizedKeyword = normalizeCategory(keyword)
      if (genre === "NON-FICTION" && normalizedKeyword === "science" && isSciFiContext) {
        continue
      }
      if (text.includes(normalizedKeyword)) {
        addTagWeight(map, genre, weight, `${source}: ${keyword}`)
      }
    }
  }

  if (text.includes("thriller") || text.includes("suspense")) {
    addTagWeight(map, "MYSTERY", weight, `${source}: thriller/suspense rule`)
  }

  if (text.includes("psychological") && text.includes("thriller")) {
    addTagWeight(map, "HORROR", weight, `${source}: psychological thriller rule`)
  }
}

function parseDeweyRange(value: string): number | null {
  const match = value.match(/\d{3}(?:\.\d+)?/)
  if (!match) return null
  const numeric = Number(match[0])
  return Number.isFinite(numeric) ? numeric : null
}

function isPsModernAmericanRange(value: string): boolean {
  const match = value.match(/PS\s*(\d{4})/i)
  if (!match) return false
  const number = Number(match[1])
  return number >= 3550 && number <= 3626
}

function hasFictionLcClassification(values: string[]): boolean {
  return values.some((value) => value.trim().toUpperCase().startsWith("P"))
}


function uniqueGenres(genres: Genre[]): Genre[] {
  const seen = new Set<Genre>()
  const result: Genre[] = []
  for (const genre of genres) {
    if (seen.has(genre)) continue
    seen.add(genre)
    result.push(genre)
  }
  return result
}

export function enforceGenreRulesFromList(genres: Genre[]): Genre[] {
  const unique = uniqueGenres(genres)
  if (unique.length === 0) return []
  if (unique.includes("NON-FICTION") && unique.some((genre) => genre !== "NON-FICTION")) {
    return unique.filter((genre) => genre !== "NON-FICTION")
  }
  return unique
}

export function inferGenresFromMetadata(input: TaggingInput): Genre[] {
  const genres = new Set<Genre>()
  const mainCategory = input.googleMainCategory?.trim()
  const googleCategories = input.googleCategories?.filter(Boolean) ?? []
  const openLibrary = input.openLibrary

  if (mainCategory) {
    addGenresFromKeywords(genres, mainCategory, BISAC_KEYWORDS)
    if (beginsWithReliabilityNonFiction(mainCategory)) genres.add("NON-FICTION")
  }

  for (const rawCategory of googleCategories) {
    const segments = splitBisacSegments(rawCategory)
    const topLevel = segments[0] ?? rawCategory
    if (beginsWithReliabilityNonFiction(rawCategory) || isNonFictionTopLevel(topLevel)) {
      genres.add("NON-FICTION")
    }
    addGenresFromKeywords(genres, rawCategory, BISAC_KEYWORDS)
    addCrossoverGenres(genres, rawCategory)
  }

  if (openLibrary?.subjects?.length) {
    const subjectsText = openLibrary.subjects.join(" ")
    addGenresFromKeywords(genres, subjectsText, KEYWORDS)
    addCrossoverGenres(genres, subjectsText)
  }

  const descriptionText = `${input.googleDescription ?? ""} ${openLibrary?.description ?? ""}`
  addGenresFromKeywords(genres, descriptionText, KEYWORDS)
  addCrossoverGenres(genres, descriptionText)

  return enforceGenreRulesFromList(Array.from(genres))
}

