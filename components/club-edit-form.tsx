"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { updateClub } from "@/app/actions/clubs"
import { useRouter } from "next/navigation"

type ClubType = "book" | "writer"

export function ClubEditForm({
  clubId,
  initialType,
  initialName,
  initialDescription,
}: {
  clubId: string
  initialType: ClubType
  initialName: string
  initialDescription: string
}) {
  const [type, setType] = useState<ClubType>(initialType)
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  const onSave = async () => {
    if (!name.trim()) {
      toast.error("Club name is required")
      return
    }

    setIsSaving(true)
    try {
      await updateClub(clubId, {
        type,
        name: name.trim(),
        description: description.trim(),
      })
      toast.success("Club updated")
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error("Failed to update club")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit club</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-2">Type</label>
            <Select value={type} onValueChange={(v) => setType(v as ClubType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="book">Book club</SelectItem>
                <SelectItem value="writer">Writer club</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
        </div>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
