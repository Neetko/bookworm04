import "server-only"

import { createAdminClient } from "@/lib/supabase-server"
import { normalizeReferenceIsbns } from "@/lib/reference-data"

export type TitleMatchSource =
  | "google-source"
  | "reference-work"
  | "reference-isbn"
  | "primary-isbn"
  | "isbn-list"
  | "exact-title-author"

export type ExistingTitleMatch = {
  titleId: string
  title: Record<string, unknown> | null
  source: TitleMatchSource
  confidenceScore: number
  isAmbiguous: boolean
}

type GoogleVolumeMatchInput = {
  volumeId: string
  title: string
  author: string
  workId?: string | null
  isbns: string[]
  selectFields: string
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)))
}

async function loadTitleById(admin: ReturnType<typeof createAdminClient>, titleId: string, selectFields: string) {
  const { data, error } = await admin.from("titles").select(selectFields).eq("id", titleId).maybeSingle()
  if (error) {
    console.error("Failed to load matched title", error)
    throw new Error("Failed to load title match")
  }
  return (data as Record<string, unknown> | null) ?? null
}

async function singleMatchFromTitleIds(
  admin: ReturnType<typeof createAdminClient>,
  titleIds: string[],
  selectFields: string,
  source: TitleMatchSource,
  confidenceScore: number
): Promise<ExistingTitleMatch | null> {
  const uniqueTitleIds = uniqueStrings(titleIds)
  if (uniqueTitleIds.length === 0) return null
  if (uniqueTitleIds.length > 1) {
    return {
      titleId: uniqueTitleIds[0],
      title: null,
      source,
      confidenceScore,
      isAmbiguous: true,
    }
  }

  return {
    titleId: uniqueTitleIds[0],
    title: await loadTitleById(admin, uniqueTitleIds[0], selectFields),
    source,
    confidenceScore,
    isAmbiguous: false,
  }
}

export async function findExistingTitleForGoogleVolume(input: GoogleVolumeMatchInput): Promise<ExistingTitleMatch | null> {
  const admin = createAdminClient()
  const normalizedIsbns = normalizeReferenceIsbns(input.isbns)

  const { data: sourceRow, error: sourceError } = await admin
    .from("title_sources")
    .select("title_id")
    .eq("source", "google")
    .eq("external_id", input.volumeId)
    .maybeSingle()

  if (sourceError) {
    console.error("Error looking up title_sources mapping", sourceError)
    throw new Error(`Failed to lookup title mapping (title_sources). ${sourceError.code ?? ""} ${sourceError.message}`.trim())
  }

  if (sourceRow?.title_id) {
    return {
      titleId: sourceRow.title_id as string,
      title: await loadTitleById(admin, sourceRow.title_id as string, input.selectFields),
      source: "google-source",
      confidenceScore: 100,
      isAmbiguous: false,
    }
  }

  const normalizedWorkId = input.workId?.trim() ?? ""
  if (normalizedWorkId) {
    const [referenceWorkResult, primaryWorkResult] = await Promise.all([
      admin
        .from("title_reference_works")
        .select("title_id")
        .eq("work_id", normalizedWorkId),
      admin
        .from("titles")
        .select("id")
        .eq("work_id", normalizedWorkId),
    ])

    if (referenceWorkResult.error) {
      console.error("Failed to lookup reference work title matches", referenceWorkResult.error)
      throw new Error("Failed to lookup title reference works")
    }

    if (primaryWorkResult.error) {
      console.error("Failed to lookup primary work title matches", primaryWorkResult.error)
      throw new Error("Failed to lookup title work IDs")
    }

    const workMatch = await singleMatchFromTitleIds(
      admin,
      [
        ...(referenceWorkResult.data ?? []).map((row: any) => row.title_id),
        ...(primaryWorkResult.data ?? []).map((row: any) => row.id),
      ],
      input.selectFields,
      "reference-work",
      99
    )

    if (workMatch && !workMatch.isAmbiguous) return workMatch
    if (workMatch?.isAmbiguous) return null
  }

  if (normalizedIsbns.length > 0) {
    const { data: referenceRows, error: referenceError } = await admin
      .from("reference_isbns")
      .select("title_id")
      .in("isbn", normalizedIsbns)

    if (referenceError) {
      console.error("Failed to lookup reference ISBN title matches", referenceError)
      throw new Error("Failed to lookup title reference ISBNs")
    }

    const referenceMatch = await singleMatchFromTitleIds(
      admin,
      (referenceRows ?? []).map((row: any) => row.title_id),
      input.selectFields,
      "reference-isbn",
      98
    )
    if (referenceMatch && !referenceMatch.isAmbiguous) return referenceMatch
    if (referenceMatch?.isAmbiguous) return null

    const { data: primaryRows, error: primaryError } = await admin
      .from("titles")
      .select(input.selectFields)
      .in("isbn", normalizedIsbns)

    if (primaryError) {
      console.error("Failed to lookup primary ISBN title matches", primaryError)
      throw new Error("Failed to lookup title ISBNs")
    }

    const primaryMatch = await singleMatchFromTitleIds(
      admin,
      (primaryRows ?? []).map((row: any) => row.id),
      input.selectFields,
      "primary-isbn",
      96
    )
    if (primaryMatch && !primaryMatch.isAmbiguous) return primaryMatch
    if (primaryMatch?.isAmbiguous) return null

    for (const isbn of normalizedIsbns) {
      const { data: isbnListRows, error: isbnListError } = await admin
        .from("titles")
        .select(input.selectFields)
        .contains("isbn_list", [isbn])

      if (isbnListError) {
        console.error("Failed to lookup ISBN-list title matches", isbnListError)
        throw new Error("Failed to lookup title ISBN list")
      }

      const isbnListMatch = await singleMatchFromTitleIds(
        admin,
        (isbnListRows ?? []).map((row: any) => row.id),
        input.selectFields,
        "isbn-list",
        94
      )
      if (isbnListMatch && !isbnListMatch.isAmbiguous) return isbnListMatch
      if (isbnListMatch?.isAmbiguous) return null
    }
  }

  const title = input.title.trim()
  const author = input.author.trim()
  if (!title || !author) return null

  const { data: exactRows, error: exactError } = await admin
    .from("titles")
    .select(input.selectFields)
    .ilike("title", title)
    .ilike("author", author)

  if (exactError) {
    console.error("Failed to lookup exact title/author match", exactError)
    throw new Error("Failed to lookup title match")
  }

  const exactMatch = await singleMatchFromTitleIds(
    admin,
    (exactRows ?? []).map((row: any) => row.id),
    input.selectFields,
    "exact-title-author",
    80
  )

  return exactMatch?.isAmbiguous ? null : exactMatch
}
