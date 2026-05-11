"use server"

import { revalidatePath } from "next/cache"

import { extractPlainTextFromHtml, sanitizeRichTextHtml } from "@/lib/sanitize"
import { createServerClient } from "@/lib/supabase-server"

export interface ClubWriterWorkAuthor {
	id: string
	username: string | null
	avatar_url: string | null
	role: string | null
}

export interface ClubWriterWorkListItem {
	id: string
	club_id: string
	author_user_id: string
	title: string
	content_text: string
	excerpt: string
	is_public: boolean
	is_completed: boolean
	created_at: string
	updated_at: string
	likes_count: number
	viewer_has_liked: boolean
	author: ClubWriterWorkAuthor | null
}

export interface ClubWriterWorkDetail extends ClubWriterWorkListItem {
	content_html: string
	viewer_can_edit: boolean
}

export interface ClubWriterWorkEditorItem {
	id: string
	club_id: string
	author_user_id: string
	title: string
	content_html: string
	content_text: string
	is_public: boolean
	is_completed: boolean
	created_at: string
	updated_at: string
}

type WriterClubRecord = {
	id: string
	type: string
	name: string
	owner_user_id: string
}

type WriterWorkRow = {
	id: string
	club_id: string
	author_user_id: string
	title: string
	content_html?: string | null
	content_text: string | null
	is_public: boolean | null
	is_completed: boolean | null
	created_at: string
	updated_at: string
}

async function getAuthedProfileIdOrNull(supabase: Awaited<ReturnType<typeof createServerClient>>) {
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser()

	if (authError || !user) return null

	const { data: profile } = await supabase
		.from("user_profiles")
		.select("id")
		.eq("auth_user_id", user.id)
		.maybeSingle()

	return (profile?.id as string | null) ?? null
}

async function requireAuthedProfileId(supabase: Awaited<ReturnType<typeof createServerClient>>) {
	const profileId = await getAuthedProfileIdOrNull(supabase)
	if (!profileId) throw new Error("Unauthorized")
	return profileId
}

async function getWriterClubOrThrow(
	supabase: Awaited<ReturnType<typeof createServerClient>>,
	clubId: string
) {
	const { data: club, error } = await supabase
		.from("clubs")
		.select("id, type, name, owner_user_id")
		.eq("id", clubId)
		.maybeSingle()

	if (error || !club) throw new Error("Club not found")
	if (club.type !== "writer") throw new Error("This is not a writer club")

	return club as WriterClubRecord
}

async function getWriterClubParticipantState(
	supabase: Awaited<ReturnType<typeof createServerClient>>,
	clubId: string,
	profileId: string | null
) {
	const club = await getWriterClubOrThrow(supabase, clubId)

	if (!profileId) {
		return {
			club,
			isOwner: false,
			isParticipant: false,
		}
	}

	const isOwner = club.owner_user_id === profileId

	if (isOwner) {
		return {
			club,
			isOwner: true,
			isParticipant: true,
		}
	}

	const { data: membership } = await supabase
		.from("club_members")
		.select("id")
		.eq("club_id", clubId)
		.eq("user_id", profileId)
		.maybeSingle()

	return {
		club,
		isOwner: false,
		isParticipant: Boolean(membership),
	}
}

async function requireWriterClubParticipant(
	supabase: Awaited<ReturnType<typeof createServerClient>>,
	clubId: string
) {
	const profileId = await requireAuthedProfileId(supabase)
	const state = await getWriterClubParticipantState(supabase, clubId, profileId)

	if (!state.isParticipant) throw new Error("Join this club to write or like works")

	return {
		profileId,
		club: state.club,
	}
}

function buildExcerpt(value: string | null | undefined) {
	const normalized = (value ?? "").trim()
	if (!normalized) return ""
	if (normalized.length <= 220) return normalized
	return `${normalized.slice(0, 217).trimEnd()}…`
}

async function hydrateWriterWorks(
	supabase: Awaited<ReturnType<typeof createServerClient>>,
	rows: WriterWorkRow[],
	viewerProfileId: string | null
) {
	if (rows.length === 0) return [] as ClubWriterWorkListItem[]

	const authorIds = Array.from(new Set(rows.map((row) => row.author_user_id).filter(Boolean)))
	const workIds = rows.map((row) => row.id)

	const [{ data: authors }, { data: likes }] = await Promise.all([
		authorIds.length
			? supabase.from("public_profiles").select("id, username, avatar_url, role").in("id", authorIds)
			: Promise.resolve({ data: [] as ClubWriterWorkAuthor[] }),
		workIds.length
			? supabase.from("club_writer_work_likes").select("work_id, user_id").in("work_id", workIds)
			: Promise.resolve({ data: [] as Array<{ work_id: string; user_id: string }> }),
	])

	const authorMap = new Map<string, ClubWriterWorkAuthor>()
	for (const author of authors ?? []) {
		if (!author?.id) continue
		authorMap.set(author.id as string, {
			id: author.id as string,
			username: (author.username as string | null) ?? null,
			avatar_url: (author.avatar_url as string | null) ?? null,
			role: (author.role as string | null) ?? null,
		})
	}

	const likesCountMap = new Map<string, number>()
	const viewerLikedSet = new Set<string>()

	for (const like of likes ?? []) {
		const workId = like.work_id as string | undefined
		if (!workId) continue
		likesCountMap.set(workId, (likesCountMap.get(workId) ?? 0) + 1)
		if (viewerProfileId && like.user_id === viewerProfileId) {
			viewerLikedSet.add(workId)
		}
	}

	return rows.map((row) => ({
		id: row.id,
		club_id: row.club_id,
		author_user_id: row.author_user_id,
		title: row.title,
		content_text: row.content_text ?? "",
		excerpt: buildExcerpt(row.content_text),
		is_public: Boolean(row.is_public),
		is_completed: Boolean(row.is_completed),
		created_at: row.created_at,
		updated_at: row.updated_at,
		likes_count: likesCountMap.get(row.id) ?? 0,
		viewer_has_liked: viewerLikedSet.has(row.id),
		author: authorMap.get(row.author_user_id) ?? null,
	}))
}

export async function getVisibleClubWriterWorks(clubId: string) {
	const supabase = await createServerClient()
	const profileId = await getAuthedProfileIdOrNull(supabase)
	const state = await getWriterClubParticipantState(supabase, clubId, profileId)

	if (!state.isParticipant) return [] as ClubWriterWorkListItem[]

	const { data, error } = await supabase
		.from("club_writer_works")
		.select("id, club_id, author_user_id, title, content_text, is_public, is_completed, created_at, updated_at")
		.eq("club_id", clubId)
		.eq("is_public", true)
		.order("updated_at", { ascending: false })

	if (error) {
		console.error("Failed to load club writer works", error)
		return [] as ClubWriterWorkListItem[]
	}

	return hydrateWriterWorks(supabase, (data ?? []) as WriterWorkRow[], profileId)
}

export async function getMyClubWriterWorks(clubId: string) {
	const supabase = await createServerClient()
	const { profileId } = await requireWriterClubParticipant(supabase, clubId)

	const { data, error } = await supabase
		.from("club_writer_works")
		.select("id, club_id, author_user_id, title, content_html, content_text, is_public, is_completed, created_at, updated_at")
		.eq("club_id", clubId)
		.eq("author_user_id", profileId)
		.order("updated_at", { ascending: false })

	if (error) {
		console.error("Failed to load author works", error)
		return [] as ClubWriterWorkEditorItem[]
	}

	return ((data ?? []) as WriterWorkRow[]).map((row) => ({
		id: row.id,
		club_id: row.club_id,
		author_user_id: row.author_user_id,
		title: row.title,
		content_html: row.content_html ?? "",
		content_text: row.content_text ?? "",
		is_public: Boolean(row.is_public),
		is_completed: Boolean(row.is_completed),
		created_at: row.created_at,
		updated_at: row.updated_at,
	}))
}

export async function getClubWriterWorkDetail(clubId: string, workId: string) {
	const supabase = await createServerClient()
	const profileId = await getAuthedProfileIdOrNull(supabase)
	const state = await getWriterClubParticipantState(supabase, clubId, profileId)

	const { data, error } = await supabase
		.from("club_writer_works")
		.select("id, club_id, author_user_id, title, content_html, content_text, is_public, is_completed, created_at, updated_at")
		.eq("id", workId)
		.eq("club_id", clubId)
		.maybeSingle()

	if (error || !data) return null

	const isAuthor = profileId === data.author_user_id
	const canView = isAuthor || (Boolean(data.is_public) && state.isParticipant)
	if (!canView) return null

	const [item] = await hydrateWriterWorks(supabase, [data as WriterWorkRow], profileId)
	if (!item) return null

	return {
		...item,
		content_html: (data.content_html as string | null) ?? "",
		viewer_can_edit: isAuthor,
	} as ClubWriterWorkDetail
}

export async function saveClubWriterWork(
	clubId: string,
	input: {
		workId?: string | null
		title: string
		contentHtml: string
		isPublic: boolean
		isCompleted: boolean
	}
) {
	const supabase = await createServerClient()
	const { profileId } = await requireWriterClubParticipant(supabase, clubId)

	const title = input.title.trim()
	if (!title) throw new Error("A title is required")

	const contentHtml = sanitizeRichTextHtml(input.contentHtml)
	const contentText = extractPlainTextFromHtml(contentHtml).trim()

	if (!contentText) throw new Error("Write something before saving")

	const payload = {
		title,
		content_html: contentHtml,
		content_text: contentText,
		is_public: input.isPublic,
		is_completed: input.isCompleted,
		updated_at: new Date().toISOString(),
	}

	let workId = input.workId?.trim() || null

	if (workId) {
		const { data: existingWork, error: existingWorkError } = await supabase
			.from("club_writer_works")
			.select("id, author_user_id, club_id")
			.eq("id", workId)
			.eq("club_id", clubId)
			.maybeSingle()

		if (existingWorkError || !existingWork) throw new Error("Work not found")
		if (existingWork.author_user_id !== profileId) throw new Error("Only the author can edit this work")

		const { error } = await supabase
			.from("club_writer_works")
			.update(payload)
			.eq("id", workId)

		if (error) throw new Error("Failed to save work")
	} else {
		const { data, error } = await supabase
			.from("club_writer_works")
			.insert({
				club_id: clubId,
				author_user_id: profileId,
				...payload,
			})
			.select("id")
			.single()

		if (error || !data?.id) throw new Error("Failed to save work")
		workId = data.id as string
	}

	revalidatePath(`/community/clubs/${clubId}`)
	revalidatePath(`/community/clubs/${clubId}/write`)
	revalidatePath(`/community/clubs/${clubId}/works/${workId}`)

	return { id: workId }
}

export async function toggleClubWriterWorkLike(workId: string) {
	const supabase = await createServerClient()
	const profileId = await requireAuthedProfileId(supabase)

	const { data: work, error: workError } = await supabase
		.from("club_writer_works")
		.select("id, club_id, is_public")
		.eq("id", workId)
		.maybeSingle()

	if (workError || !work?.id) throw new Error("Work not found")
	if (!work.is_public) throw new Error("Only published works can be liked")

	const state = await getWriterClubParticipantState(supabase, work.club_id as string, profileId)
	if (!state.isParticipant) throw new Error("Join this club to like works")

	const { data: existing } = await supabase
		.from("club_writer_work_likes")
		.select("id")
		.eq("work_id", workId)
		.eq("user_id", profileId)
		.maybeSingle()

	if (existing?.id) {
		const { error } = await supabase
			.from("club_writer_work_likes")
			.delete()
			.eq("id", existing.id)

		if (error) throw new Error("Failed to remove like")

		revalidatePath(`/community/clubs/${work.club_id}`)
		revalidatePath(`/community/clubs/${work.club_id}/works/${workId}`)
		return { liked: false }
	}

	const { error: insertError } = await supabase
		.from("club_writer_work_likes")
		.insert({
			work_id: workId,
			user_id: profileId,
		})

	if (insertError) throw new Error("Failed to like work")

	revalidatePath(`/community/clubs/${work.club_id}`)
	revalidatePath(`/community/clubs/${work.club_id}/works/${workId}`)

	return { liked: true }
}
