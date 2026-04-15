export function normalizeReferenceIsbn(value: string | null | undefined): string | null {
  if (!value) return null

  const normalized = value.replace(/[^0-9Xx]/g, "").toUpperCase().trim()
  if (!normalized) return null
  if (normalized.length !== 10 && normalized.length !== 13) return null
  return normalized
}

export function normalizeReferenceIsbns(values: Array<string | null | undefined>): string[] {
  const normalized = values
    .map((value) => normalizeReferenceIsbn(value))
    .filter((value): value is string => Boolean(value))

  return Array.from(new Set(normalized))
}

function normalizeWorkIds(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(
    values
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim())
  ))
}

export type LinkedTitleSummary = {
  titleId: string
  title: string
}

export async function getTitleReferenceWorkIds(
  supabase: any,
  input: {
    titleId: string
    fallbackWorkIds?: Array<string | null | undefined>
  }
): Promise<string[]> {
  const titleId = input.titleId.trim()
  const fallbackWorkIds = normalizeWorkIds(input.fallbackWorkIds ?? [])

  if (!titleId) return fallbackWorkIds

  const { data, error } = await supabase
    .from("title_reference_works")
    .select("work_id")
    .eq("title_id", titleId)

  if (error) {
    console.error("Failed to load title reference works", error)
    return fallbackWorkIds
  }

  const pooledWorkIds = normalizeWorkIds(
    (data ?? []).map((row: any) => (typeof row?.work_id === "string" ? row.work_id : null))
  )

  return normalizeWorkIds([...pooledWorkIds, ...fallbackWorkIds])
}

export async function getLinkedTitlesByWorkId(
  supabase: any,
  input: {
    workIds: string[]
    excludeTitleId?: string | null
  }
): Promise<Record<string, LinkedTitleSummary[]>> {
  const workIds = normalizeWorkIds(input.workIds)
  const excludeTitleId = input.excludeTitleId?.trim() || null

  if (workIds.length === 0) return {}

  const workIdsSet = new Set(workIds)
  const workTitleMap = new Map<string, Map<string, string>>()
  const pooledTitleIds = new Set<string>()
  const dupeFilter = workIds.map((workId) => `dupe_work_ids.cs.{${workId}}`).join(",")

  const [{ data: pooledRows }, { data: primaryRows }, { data: dupeRows }] = await Promise.all([
    supabase.from("title_reference_works").select("title_id,work_id").in("work_id", workIds),
    supabase.from("titles").select("id,title,work_id").in("work_id", workIds),
    dupeFilter
      ? supabase.from("titles").select("id,title,dupe_work_ids").or(dupeFilter)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const addLink = (workId: string, titleId: string, title?: string | null) => {
    if (!workIdsSet.has(workId)) return
    if (excludeTitleId && titleId === excludeTitleId) return

    let titleMap = workTitleMap.get(workId)
    if (!titleMap) {
      titleMap = new Map<string, string>()
      workTitleMap.set(workId, titleMap)
    }

    if (title && title.trim().length > 0) {
      titleMap.set(titleId, title)
      return
    }

    if (!titleMap.has(titleId)) {
      titleMap.set(titleId, "")
    }
  }

  for (const row of pooledRows ?? []) {
    const titleId = typeof (row as any)?.title_id === "string" ? (row as any).title_id.trim() : ""
    const workId = typeof (row as any)?.work_id === "string" ? (row as any).work_id.trim() : ""
    if (!titleId || !workId) continue
    if (!excludeTitleId || titleId !== excludeTitleId) pooledTitleIds.add(titleId)
    addLink(workId, titleId)
  }

  for (const row of primaryRows ?? []) {
    const titleId = typeof (row as any)?.id === "string" ? (row as any).id.trim() : ""
    const title = typeof (row as any)?.title === "string" ? (row as any).title : ""
    const workId = typeof (row as any)?.work_id === "string" ? (row as any).work_id.trim() : ""
    if (!titleId || !workId) continue
    addLink(workId, titleId, title)
  }

  for (const row of dupeRows ?? []) {
    const titleId = typeof (row as any)?.id === "string" ? (row as any).id.trim() : ""
    const title = typeof (row as any)?.title === "string" ? (row as any).title : ""
    const dupeWorkIds = Array.isArray((row as any)?.dupe_work_ids)
      ? normalizeWorkIds((row as any).dupe_work_ids)
      : []
    if (!titleId || dupeWorkIds.length === 0) continue

    for (const workId of dupeWorkIds) {
      addLink(workId, titleId, title)
    }
  }

  const missingTitleIds = Array.from(pooledTitleIds).filter((titleId) => {
    for (const titles of workTitleMap.values()) {
      const title = titles.get(titleId)
      if (typeof title === "string" && title.length > 0) return false
    }
    return true
  })

  if (missingTitleIds.length > 0) {
    const { data: titleRows } = await supabase
      .from("titles")
      .select("id,title")
      .in("id", missingTitleIds)

    for (const row of titleRows ?? []) {
      const titleId = typeof (row as any)?.id === "string" ? (row as any).id.trim() : ""
      const title = typeof (row as any)?.title === "string" ? (row as any).title : ""
      if (!titleId || !title) continue

      for (const titles of workTitleMap.values()) {
        if (titles.has(titleId) && !titles.get(titleId)) {
          titles.set(titleId, title)
        }
      }
    }
  }

  const result: Record<string, LinkedTitleSummary[]> = {}
  for (const workId of workIds) {
    const titles = workTitleMap.get(workId)
    if (!titles || titles.size === 0) continue
    result[workId] = Array.from(titles.entries())
      .map(([titleId, title]) => ({
        titleId,
        title: title || titleId,
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
  }

  return result
}

export async function upsertTitleReferenceWorks(
  supabase: any,
  input: {
    titleId: string
    workIds: string[]
    source: string
    confidenceScore?: number | null
  }
) {
  const titleId = input.titleId.trim()
  const workIds = Array.from(new Set(input.workIds.map((value) => value.trim()).filter(Boolean)))

  if (!titleId || workIds.length === 0) return

  const now = new Date().toISOString()
  const rows = workIds.map((workId) => ({
    title_id: titleId,
    work_id: workId,
    source: input.source,
    confidence_score: input.confidenceScore ?? null,
    updated_at: now,
  }))

  const { error } = await supabase.from("title_reference_works").upsert(rows, {
    onConflict: "title_id,work_id",
  })

  if (error) {
    console.error("Failed to upsert title reference works", error)
    throw new Error("Failed to save reference works")
  }
}

export async function upsertReferenceIsbns(
  supabase: any,
  input: {
    titleId: string
    workId: string
    isbns: string[]
    source: string
  }
) {
  const titleId = input.titleId.trim()
  const workId = input.workId.trim()
  const isbns = normalizeReferenceIsbns(input.isbns)

  if (!titleId || !workId || isbns.length === 0) return

  const now = new Date().toISOString()
  const rows = isbns.map((isbn) => ({
    title_id: titleId,
    work_id: workId,
    isbn,
    source: input.source,
    updated_at: now,
  }))

  const { error } = await supabase.from("reference_isbns").upsert(rows, {
    onConflict: "isbn",
  })

  if (error) {
    console.error("Failed to upsert reference ISBNs", error)
    throw new Error("Failed to save reference ISBNs")
  }
}
