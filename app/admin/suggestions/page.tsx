import { createAdminClient } from "@/lib/supabase-server"
import { Navigation } from "@/components/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SuggestionReviewCard } from "@/components/suggestion-review-card"
import { canManageRoles, canReviewSuggestions, getCurrentUserAccess } from "@/lib/server/roles"
import { isExactWorkSnapshotMatch, normalizeCoverChoice, normalizeSuggestionWorkMatches, normalizeWorkIdList, normalizeWorkSnapshots } from "@/lib/suggestions"
import { normalizeGenres } from "@/lib/types"

export default async function SuggestionsAdminPage() {
  const access = await getCurrentUserAccess()
  const user = access.user

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="font-ui max-w-3xl mx-auto p-8">
          <h1 className="text-2xl font-semibold mb-2">Suggestions</h1>
          <p className="text-sm text-muted-foreground">Sign in to review suggestions.</p>
        </div>
      </div>
    )
  }

  if (!canReviewSuggestions(access.role)) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="font-ui max-w-3xl mx-auto p-8 space-y-2">
          <h1 className="text-2xl font-semibold mb-2">Suggestions</h1>
          <p className="text-sm text-muted-foreground">Moderator or admin access required.</p>
          <p className="text-xs text-muted-foreground">Signed in as {user.email ?? "unknown user"}.</p>
          <p className="text-xs text-muted-foreground">Suggestion review access is checked against your application role.</p>
        </div>
      </div>
    )
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from("suggestions")
    .select(
      "id,title_id,suggested_genres,algorithm_suggested_genres,suggested_selected_work_ids,suggested_selected_work_snapshots,admin_final_genres,admin_final_selected_work_ids,admin_final_selected_work_snapshots,admin_final_cover_selection,admin_reviewed_at,status,created_at,title:titles!suggestions_title_id_fkey(id,title,author),suggested_by:user_profiles!suggestions_suggested_by_profile_id_fkey(id,username,email),bookworm_matches:suggestion_work_matches(id,work_id,match_type,confidence_score,reason,work_snapshot,created_at)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="font-ui max-w-3xl mx-auto p-8 space-y-2">
          <h1 className="text-2xl font-semibold mb-2">Suggestions</h1>
          <p className="text-sm text-muted-foreground">Failed to load suggestions.</p>
          <p className="text-xs text-muted-foreground">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="font-ui max-w-5xl mx-auto p-8 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Suggestions</h1>
            <p className="text-sm text-muted-foreground">Review pending user-submitted metadata.</p>
          </div>
          {canManageRoles(access.role) ? (
            <Button asChild variant="outline">
              <Link href="/admin/moderators">Manage moderators</Link>
            </Button>
          ) : null}
        </div>

        {(data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending suggestions.</p>
        ) : (
          <div className="space-y-4">
            {(data ?? []).map((row: any) => {
              const suggestedWorkIds = normalizeWorkIdList(row.suggested_selected_work_ids ?? [])
              const suggestedWorkSnapshots = normalizeWorkSnapshots(row.suggested_selected_work_snapshots ?? [])
              const adminFinalSelectedWorkIds = normalizeWorkIdList(row.admin_final_selected_work_ids ?? [])
              const adminFinalSelectedWorkSnapshots = normalizeWorkSnapshots(row.admin_final_selected_work_snapshots ?? [])
              const adminFinalCoverSelection = normalizeCoverChoice(row.admin_final_cover_selection)

              const bookwormMatches = normalizeSuggestionWorkMatches(row.bookworm_matches ?? []).filter((match) => {
                if (match.matchType === "exact_auto_dupe") return false

                return !isExactWorkSnapshotMatch(match.workSnapshot, {
                  title: row.title?.title ?? "",
                  author: row.title?.author ?? "",
                })
              })

              return (
                <SuggestionReviewCard
                  key={row.id}
                  suggestion={{
                    id: row.id,
                    titleId: row.title_id,
                    title: row.title?.title ?? "Untitled",
                    author: row.title?.author ?? "Unknown author",
                    suggestedBy: row.suggested_by?.username ?? row.suggested_by?.email ?? "Unknown",
                    suggestedGenres: normalizeGenres(row.suggested_genres ?? []),
                    algorithmSuggestedGenres: normalizeGenres(row.algorithm_suggested_genres ?? []),
                    suggestedWorkIds,
                    suggestedWorkSnapshots,
                    bookwormMatches,
                    adminFinalGenres: normalizeGenres(row.admin_final_genres ?? []),
                    adminFinalSelectedWorkIds,
                    adminFinalSelectedWorkSnapshots,
                    adminFinalCoverSelection,
                    adminReviewedAt: row.admin_reviewed_at ?? null,
                  }}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
