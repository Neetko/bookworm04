import { isGenre, type Genre } from "@/lib/types"
import type { OpenLibraryMetadata } from "@/lib/open-library"

export type WeightedTag = {
  name: Genre
  weight: number
  source: string
}

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

const TIER_WEIGHTS = {
  bisacPrimary: 1.0,
  bisacSecondary: 0.8,
  olClassification: 0.9,
  subject: 0.7,
  description: 0.4,
  crossover: 0.4,
  boost: 0.2,
} as const

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
  ],
  "SCI-FI": [
    "science fiction",
    "sci fi",
    "sci-fi",
    "hard science fiction",
    "space opera",
    "cyberpunk",
    "steampunk",
    "dystopian",
    "afrofuturism",
    "time travel",
    "post apocalyptic",
    "post-apocalyptic",
    "alien",
    "aliens",
    "robot",
    "robots",
    "artificial intelligence",
    "ai",
    "genetic engineering",
    "galactic empire",
    "near future",
    "futuristic",
    "alternative history",
    "speculative fiction",
    "interstellar",
    "space travel",
  ],
  ADVENTURE: ["survival", "war", "military", "sea stories", "western", "exploration"],
  MYSTERY: ["detective", "crime", "thriller", "noir", "procedural", "hardboiled"],
  "NON-FICTION": [
    "history",
    "biography",
    "science",
    "philosophy",
    "travel",
    "true crime",
    "psychology",
    "social science",
    "self-help",
    "business",
    "memoir",
    "essays",
    "cooking",
    "religion",
    "political science",
    "art",
    "reference",
    "study aids",
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

export function computeWeightedTags(input: TaggingInput): WeightedTag[] {
  const tagMap = new Map<Genre, { weight: number; sources: string[] }>()

  const mainCategory = input.googleMainCategory?.trim()
  const googleCategories = input.googleCategories?.filter(Boolean) ?? []
  const hasGoogleCategories = googleCategories.length > 0
  const titleText = input.title?.toString() ?? ""
  const googleDescription = input.googleDescription ?? ""
  const openLibrary = input.openLibrary
  const olWeightMultiplier = hasGoogleCategories ? 0.5 : 1

  if (mainCategory) {
    const mapped = mapBisacToGenre(mainCategory)
    if (mapped) {
      addTagWeight(tagMap, mapped, TIER_WEIGHTS.bisacPrimary, "BISAC: mainCategory")
    }
  }

  for (const [index, rawCategory] of googleCategories.entries()) {
    const normalized = normalizeCategory(rawCategory)
    const segments = splitBisacSegments(rawCategory)
    const topLevel = segments[0] ?? rawCategory

    if (beginsWithReliabilityNonFiction(rawCategory)) {
      addTagWeight(tagMap, "NON-FICTION", TIER_WEIGHTS.bisacPrimary, "BISAC: reliability enforcement")
    } else if (isNonFictionTopLevel(topLevel)) {
      addTagWeight(tagMap, "NON-FICTION", TIER_WEIGHTS.bisacPrimary, "BISAC: non-fiction top-level")
    }

    const bisacWeight = index === 0
      ? TIER_WEIGHTS.bisacPrimary
      : segments.length <= 2
        ? TIER_WEIGHTS.bisacPrimary
        : TIER_WEIGHTS.bisacSecondary
    applyKeywords(tagMap, normalized, bisacWeight, "BISAC", BISAC_KEYWORDS)
    applyCrossover(tagMap, normalized, bisacWeight, "BISAC")

    if (normalized.includes("drama")) {
      if (normalized.includes("crime") || normalized.includes("murder")) {
        addTagWeight(tagMap, "MYSTERY", TIER_WEIGHTS.bisacSecondary, "BISAC: drama crime rule")
      } else if (normalized.includes("novel") || normalized.includes("prose")) {
        addTagWeight(tagMap, "ADVENTURE", TIER_WEIGHTS.bisacSecondary, "BISAC: drama prose rule")
      }
    }
  }

  if (openLibrary?.lcClassifications?.length) {
    for (const classification of openLibrary.lcClassifications) {
      const normalized = classification.trim().toUpperCase()

      if (normalized.startsWith("PZ")) {
        addTagWeight(tagMap, "ADVENTURE", TIER_WEIGHTS.olClassification * olWeightMultiplier, "OL LC: PZ")
        addTagWeight(tagMap, "FANTASY", TIER_WEIGHTS.boost * olWeightMultiplier, "OL LC: PZ boost")
        continue
      }

      if (normalized.startsWith("P")) {
        continue
      }

      if (/^[A-OQ-Z]/.test(normalized)) {
        addTagWeight(tagMap, "NON-FICTION", TIER_WEIGHTS.olClassification * olWeightMultiplier, "OL LC: non-fiction")
      }
    }
  }

  if (openLibrary?.deweyDecimalClass?.length) {
    for (const dewey of openLibrary.deweyDecimalClass) {
      const numeric = parseDeweyRange(dewey)
      if (numeric === null) continue
      if (numeric >= 800 && numeric < 900) {
        continue
      }
      addTagWeight(tagMap, "NON-FICTION", TIER_WEIGHTS.olClassification * olWeightMultiplier, "OL Dewey: non-fiction")
    }
  }

  if (openLibrary?.subjects?.length) {
    const normalizedSubjects = normalizeCategory(openLibrary.subjects.join(" "))
    applyKeywords(tagMap, normalizedSubjects, TIER_WEIGHTS.subject * olWeightMultiplier, "OL Subject", KEYWORDS)
    applyCrossover(tagMap, normalizedSubjects, TIER_WEIGHTS.subject * olWeightMultiplier, "OL Subject")
  }

  const descriptionText = normalizeCategory(
    hasGoogleCategories ? googleDescription : `${googleDescription} ${openLibrary?.description ?? ""}`
  )
  if (descriptionText) {
    for (const [genre, list] of Object.entries(KEYWORDS) as Array<[Genre, string[]]>) {
      const matches = list.filter(
        (keyword) => countOccurrences(descriptionText, normalizeCategory(keyword)) >= 3
      )
      if (matches.length > 0) {
        addTagWeight(tagMap, genre, TIER_WEIGHTS.description, `Description: ${matches.join(", ")}`)
      }
    }

    for (const trigger of CROSSOVER_TRIGGERS) {
      if (countOccurrences(descriptionText, normalizeCategory(trigger.phrase)) >= 3) {
        for (const tag of trigger.tags) {
          addTagWeight(tagMap, tag, TIER_WEIGHTS.crossover, `Description: ${trigger.phrase}`)
        }
      }
    }
  }

  const combinedText = normalizeCategory(`${titleText} ${googleDescription}`)
  const hasBiographicalBisac = googleCategories.some((category) => normalizeCategory(category).includes("bio"))
  const hasFictionLc = openLibrary?.lcClassifications
    ? hasFictionLcClassification(openLibrary.lcClassifications)
    : false
  if (hasBiographicalBisac && hasFictionLc && /\ba novel\b/i.test(combinedText)) {
    addTagWeight(tagMap, "NON-FICTION", TIER_WEIGHTS.bisacSecondary, "Biographical Fiction rule")
    addTagWeight(tagMap, "ADVENTURE", TIER_WEIGHTS.bisacSecondary, "Biographical Fiction rule")
  }

  if (openLibrary?.lcClassifications?.some(isPsModernAmericanRange)) {
    const hasTierOneOrTwo = Array.from(tagMap.values()).some((value) => value.weight >= TIER_WEIGHTS.olClassification)
    if (!hasTierOneOrTwo) {
      addTagWeight(tagMap, "ADVENTURE", TIER_WEIGHTS.subject * olWeightMultiplier, "OL LC: PS3550-3626 default")
    }
  }

  const sorted = Array.from(tagMap.entries())
    .map(([name, info]) => ({ name, weight: info.weight, source: info.sources.join(" | ") }))
    .sort((a, b) => b.weight - a.weight)

  return sorted
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

function applyNonFictionExclusivity(tags: WeightedTag[]): WeightedTag[] {
  const hasNonFiction = tags.some((tag) => tag.name === "NON-FICTION")
  if (!hasNonFiction) return tags

  const nonFiction = tags.find((tag) => tag.name === "NON-FICTION")
  if (!nonFiction) return tags

  const fictionTags = tags.filter((tag) => tag.name !== "NON-FICTION")
  if (fictionTags.length === 0) return [nonFiction]

  const topFiction = fictionTags[0]
  const reliableNonFiction = /reliability|BISAC: non-fiction top-level|OL LC: non-fiction|OL Dewey: non-fiction|BISAC: mainCategory|BISAC: non-fiction prefix/i.test(
    nonFiction.source
  )
  const margin = 0.15

  if (nonFiction.weight >= topFiction.weight + margin || (reliableNonFiction && nonFiction.weight >= topFiction.weight)) {
    return [nonFiction]
  }

  return fictionTags
}

export function normalizeWeightedTags(weights: unknown): WeightedTag[] {
  if (!Array.isArray(weights)) return []
  const tags = weights
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const name = (entry as any).name
      const weight = Number((entry as any).weight)
      if (!isGenre(name) || !Number.isFinite(weight)) return null
      return {
        name,
        weight,
        source: typeof (entry as any).source === "string" ? (entry as any).source : "",
      } satisfies WeightedTag
    })
    .filter((entry): entry is WeightedTag => Boolean(entry))
    .sort((a, b) => b.weight - a.weight)

  return tags
}

export function enforceGenreRulesFromList(genres: Genre[]): Genre[] {
  const unique = uniqueGenres(genres)
  if (unique.length === 0) return []
  if (unique.includes("NON-FICTION") && unique.some((genre) => genre !== "NON-FICTION")) {
    return unique.filter((genre) => genre !== "NON-FICTION")
  }
  return unique
}

export function flattenWeightedTags(tags: WeightedTag[]): Genre[] {
  const normalized = applyNonFictionExclusivity(tags)
  const names = uniqueGenres(normalized.map((tag) => tag.name))
  if (names.length === 0) return []
  return names
}

export function genresFromWeights(weights: unknown): Genre[] {
  const normalized = normalizeWeightedTags(weights)
  if (normalized.length === 0) return []
  return flattenWeightedTags(normalized)
}
