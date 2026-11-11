import "server-only"

import { getGoogleBookDetails, type GoogleBook } from "@/lib/google-books"
import { fetchOpenLibraryWorkEditionsByIsbn } from "@/lib/open-library"
import { upsertReferenceIsbns, upsertTitleReferenceWorks } from "@/lib/reference-data"
import { createAdminClient, type createServerClient } from "@/lib/supabase-server"
import { mergeDupeWorkIds, mergeIsbnLists, type LocalDuplicate } from "@/lib/google-ingest-utils"
import { findExistingTitleForGoogleVolume } from "@/lib/server/title-matching"
import { searchLocalTitleRows } from "@/lib/server/local-title-search"

type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>

export async function findLocalTitleDuplicates(
  supabase: SupabaseServerClient,
  title: string,
  author: string
): Promise<LocalDuplicate[]> {
  const trimmedTitle = title.trim()
  const trimmedAuthor = author.trim()
  if (!trimmedTitle) return []

  const titleMatches = await searchLocalTitleRows(supabase, {
    title: trimmedTitle,
    author: trimmedAuthor,
    raw: "",
  })

  const titles = titleMatches.map((match) => ({
    id: match.id,
    title: match.title,
    author: match.author,
    coverImageUrl: match.cover_image_url ?? null,
    source: "title" as const,
  }))

  return titles.slice(0, 15)
}

async function ensureTitleSourceMapping(volumeId: string, titleId: string) {
  const admin = createAdminClient()
  const { error } = await admin.from("title_sources").upsert(
    {
      source: "google",
      external_id: volumeId,
      title_id: titleId,
    },
    {
      onConflict: "source,external_id",
    }
  )

  if (error) {
    console.error("Failed to upsert title_sources mapping", error)
    throw new Error("Failed to save title source mapping")
  }
}

async function ensureTitleForGoogleVolume(
  volumeId: string,
  volume: GoogleBook,
  workInfo?: { workId: string | null; isbnList: string[]; dupeWorkIds?: string[] }
) {
  const admin = createAdminClient()
  const author = volume.authors?.[0] ?? "Unknown author"
  const now = new Date().toISOString()

  const selectFields = "id,isbn_list,dupe_work_ids,cover_image_url,description,published_year,isbn,work_id"
  const existingMatch = await findExistingTitleForGoogleVolume({
    volumeId,
    title: volume.title,
    author,
    workId: workInfo?.workId ?? null,
    isbns: [volume.isbn ?? "", ...(workInfo?.isbnList ?? [])],
    selectFields,
  })
  const existingTitle: any = existingMatch?.title ?? null
  let titleId = existingMatch?.titleId ?? null

  if (!titleId) {
    const { data: inserted, error: insertError } = await admin
      .from("titles")
      .insert({
        title: volume.title,
        author,
        description: volume.description,
        cover_image_url: volume.thumbnailUrl,
        published_year: volume.publishedYear,
        isbn: volume.isbn,
        work_id: workInfo?.workId ?? null,
        isbn_list: (workInfo?.isbnList?.length ?? 0) > 0 ? workInfo?.isbnList : null,
        dupe_work_ids: (workInfo?.dupeWorkIds?.length ?? 0) > 0 ? workInfo?.dupeWorkIds : null,
        updated_at: now,
      })
      .select("id")
      .single()

    if (insertError || !inserted?.id) {
      console.error("Failed to insert title", insertError)
      throw new Error("Failed to create title")
    }

    titleId = inserted.id as string
  } else {
    const mergedIsbns = mergeIsbnLists(existingTitle?.isbn_list ?? null, workInfo?.isbnList ?? [])
    const updatePayload: Record<string, any> = {
      updated_at: now,
    }

    if (workInfo?.workId && !existingTitle?.work_id) updatePayload.work_id = workInfo.workId
    if (mergedIsbns.length > 0) updatePayload.isbn_list = mergedIsbns
    if (workInfo?.dupeWorkIds?.length) {
      updatePayload.dupe_work_ids = mergeDupeWorkIds(
        existingTitle?.dupe_work_ids ?? null,
        workInfo.dupeWorkIds,
        workInfo.workId ?? null
      )
    }
    if (!existingTitle?.cover_image_url && volume.thumbnailUrl) updatePayload.cover_image_url = volume.thumbnailUrl
    if (!existingTitle?.description && volume.description) updatePayload.description = volume.description
    if (!existingTitle?.published_year && volume.publishedYear) updatePayload.published_year = volume.publishedYear
    if (!existingTitle?.isbn && volume.isbn) updatePayload.isbn = volume.isbn

    const { error: updateError } = await admin.from("titles").update(updatePayload).eq("id", titleId)
    if (updateError) {
      console.error("Failed to update title", updateError)
      throw new Error("Failed to update title")
    }
  }

  await ensureTitleSourceMapping(volumeId, titleId)
  return titleId
}

export async function ensureGoogleBookIngested(volumeId: string): Promise<{
  titleId: string
  volume: GoogleBook
}> {
  const admin = createAdminClient()
  const details = await getGoogleBookDetails(volumeId)
  if (!details) throw new Error("Unable to fetch Google book")

  const volume = details.refined
  const openLibrary = volume.isbn ? await fetchOpenLibraryWorkEditionsByIsbn(volume.isbn) : null
  const identifiers = mergeIsbnLists(null, [
    volume.isbn ?? "",
    ...details.identifiers,
    ...(openLibrary?.isbns ?? []),
  ])

  const titleId = await ensureTitleForGoogleVolume(volumeId, volume, {
    workId: openLibrary?.workId ?? null,
    isbnList: identifiers,
    dupeWorkIds: [],
  })

  if (openLibrary?.workId) {
    await upsertTitleReferenceWorks(admin, {
      titleId,
      workIds: [openLibrary.workId],
      source: "google-ingest",
      confidenceScore: 100,
    })

    await upsertReferenceIsbns(admin, {
      titleId,
      workId: openLibrary.workId,
      isbns: openLibrary.isbns,
      source: "google-ingest",
    })
  }

  return { titleId, volume }
}
