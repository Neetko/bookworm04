"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, Save } from "lucide-react"

import { saveClubWriterWork, type ClubWriterWorkEditorItem } from "@/app/actions/club-writer-works"
import { RichTextEditor } from "@/components/rich-text-editor"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

type ClubWriterWorkEditorProps = {
  clubId: string
  initialWork?: ClubWriterWorkEditorItem | null
}

export function ClubWriterWorkEditor({ clubId, initialWork = null }: ClubWriterWorkEditorProps) {
  const router = useRouter()
  const [title, setTitle] = useState(initialWork?.title ?? "")
  const [contentHtml, setContentHtml] = useState(initialWork?.content_html ?? "")
  const [contentText, setContentText] = useState(initialWork?.content_text ?? "")
  const [isPublic, setIsPublic] = useState(initialWork?.is_public ?? false)
  const [isCompleted, setIsCompleted] = useState(initialWork?.is_completed ?? false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setTitle(initialWork?.title ?? "")
    setContentHtml(initialWork?.content_html ?? "")
    setContentText(initialWork?.content_text ?? "")
    setIsPublic(initialWork?.is_public ?? false)
    setIsCompleted(initialWork?.is_completed ?? false)
  }, [initialWork])

  const wordCount = useMemo(() => {
    const trimmed = contentText.trim()
    if (!trimmed) return 0
    return trimmed.split(/\s+/).length
  }, [contentText])

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const saved = await saveClubWriterWork(clubId, {
        workId: initialWork?.id ?? null,
        title,
        contentHtml,
        isPublic,
        isCompleted,
      })

      toast.success(initialWork ? "Work updated" : "Work saved")
      router.replace(`/community/clubs/${clubId}/write?work=${saved.id}`)
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Failed to save work")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>{initialWork ? "Edit work" : "Start a new work"}</CardTitle>
        <div className="flex items-center gap-2">
          {initialWork?.id ? (
            <Button asChild variant="outline">
              <Link href={`/community/clubs/${clubId}/works/${initialWork.id}`}>Open work page</Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost">
            <Link href={`/community/clubs/${clubId}/write`}>
              <Plus className="mr-2 h-4 w-4" />
              New work
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="writer-work-title">Title</Label>
          <Input
            id="writer-work-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Name your work"
            maxLength={200}
            disabled={isSaving}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Draft</Label>
            <span className="text-xs text-muted-foreground">{wordCount} words</span>
          </div>
          <RichTextEditor
            value={contentHtml}
            onChange={(html, text) => {
              setContentHtml(html)
              setContentText(text)
            }}
            placeholder="Begin writing your work here…"
            disabled={isSaving}
            editorClassName="min-h-[360px] rounded-md border border-zinc-300 bg-white px-6 py-8 font-[Georgia,_Times_New_Roman,_serif] text-[17px] leading-8 tracking-normal text-zinc-950 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/5 focus:outline-none"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <div className="font-medium">Visible to club members</div>
              <p className="text-sm text-muted-foreground">
                Published works appear in the club&apos;s Written Works tab.
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} disabled={isSaving} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <div className="font-medium">Mark as complete</div>
              <p className="text-sm text-muted-foreground">
                Completed works get a checkmark on their card.
              </p>
            </div>
            <Switch checked={isCompleted} onCheckedChange={setIsCompleted} disabled={isSaving} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {initialWork ? "Save changes" : "Save work"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Drafts stay private to you. Published works are readable only by fellow club members.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
