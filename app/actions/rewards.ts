"use server"

import { enforceGenreRulesFromList } from "@/lib/book-tagging"
import { type Genre, isGenre, normalizeGenres } from "@/lib/types"

const BONUS_POINTS = {
  member: 1,
  owner: 2,
} as const

export type PointsSourceType = "title_read" | "review" | "discussion_post" | "club_bonus"

type GenrePointRow = {
  user_profile_id: string
  title_id: string | null
  genre: Genre
  points: number
  source_type: PointsSourceType
  source_id: string
  reason: string
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

async function getTitleGenres(
  supabase: any,
  titleId: string
): Promise<Genre[]> {
  const [titleRow, trackedRow, trackedByIdRow] = await Promise.all([
    supabase.from("titles").select("genre").eq("id", titleId).maybeSingle(),
    supabase.from("tracked_books").select("genre").eq("title_id", titleId).maybeSingle(),
    supabase.from("tracked_books").select("genre").eq("id", titleId).maybeSingle(),
  ])

  const fallback = uniqueGenres([
    ...normalizeGenres(titleRow.data?.genre),
    ...normalizeGenres(trackedRow.data?.genre),
    ...normalizeGenres(trackedByIdRow.data?.genre),
  ])

  return enforceGenreRulesFromList(fallback)
}

async function getClubGenreSets(supabase: any, profileId: string) {
  const [owned, member] = await Promise.all([
    supabase.from("clubs").select("id,categories").eq("owner_user_id", profileId),
    supabase
      .from("club_members")
      .select("club_id, clubs ( id, categories, owner_user_id )")
      .eq("user_id", profileId),
  ])

  const ownerGenres = new Set<Genre>()
  for (const club of owned.data ?? []) {
    for (const genre of normalizeGenres(club?.categories)) {
      ownerGenres.add(genre)
    }
  }

  const memberGenres = new Set<Genre>()
  for (const row of member.data ?? []) {
    const club = (row as any)?.clubs
    if (!club) continue
    for (const genre of normalizeGenres(club?.categories)) {
      memberGenres.add(genre)
    }
  }

  return { ownerGenres, memberGenres }
}

function buildBonusRows(
  profileId: string,
  titleId: string,
  sourceId: string,
  genres: Genre[],
  ownerGenres: Set<Genre>,
  memberGenres: Set<Genre>
): GenrePointRow[] {
  const rows: GenrePointRow[] = []
  for (const genre of genres) {
    if (ownerGenres.has(genre)) {
      rows.push({
        user_profile_id: profileId,
        title_id: titleId,
        genre,
        points: BONUS_POINTS.owner,
        source_type: "club_bonus",
        source_id: sourceId,
        reason: "club_owner",
      })
      continue
    }

    if (memberGenres.has(genre)) {
      rows.push({
        user_profile_id: profileId,
        title_id: titleId,
        genre,
        points: BONUS_POINTS.member,
        source_type: "club_bonus",
        source_id: sourceId,
        reason: "club_member",
      })
    }
  }

  return rows
}

export async function awardPointsForTitleAction(params: {
  supabase: any
  profileId: string
  titleId: string
  sourceType: PointsSourceType
  sourceId: string
  basePoints: number
  reason: string
}) {
  const { supabase, profileId, titleId, sourceType, sourceId, basePoints, reason } = params

  const genres = await getTitleGenres(supabase, titleId)
  if (genres.length === 0) return

  const baseRows: GenrePointRow[] = genres.map((genre) => ({
    user_profile_id: profileId,
    title_id: titleId,
    genre,
    points: basePoints,
    source_type: sourceType,
    source_id: sourceId,
    reason,
  }))

  const { ownerGenres, memberGenres } = await getClubGenreSets(supabase, profileId)
  const bonusRows = buildBonusRows(profileId, titleId, sourceId, genres, ownerGenres, memberGenres)

  const rows = [...baseRows, ...bonusRows]
  if (rows.length === 0) return

  const { error } = await supabase.from("user_genre_points").upsert(rows, {
    onConflict: "user_profile_id,source_type,source_id,genre,reason",
    ignoreDuplicates: true,
  })

  if (error) {
    console.error("Failed to award points", error)
    throw new Error("Failed to award points")
  }
}

export async function summarizeGenrePoints(rows: Array<{ genre: string | null; points: number | null }>) {
  const totals = new Map<Genre, number>()
  for (const row of rows) {
    if (!row.genre || !isGenre(row.genre)) continue
    const current = totals.get(row.genre) ?? 0
    totals.set(row.genre, current + (row.points ?? 0))
  }
  return totals
}
