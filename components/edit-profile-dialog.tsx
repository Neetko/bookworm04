"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { updateUserProfile } from "@/app/actions/profile"
import { uploadUserAvatar } from "@/app/actions/profile"
import { supabase } from "@/lib/supabase-browser"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface EditProfileDialogProps {
  user: {
    username: string | null
    bio: string | null
    avatarUrl: string | null
  }
}

export function EditProfileDialog({ user }: EditProfileDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)

    const formData = new FormData(event.currentTarget)
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      toast.error("You must be logged in to update your profile")
      setLoading(false)
      return
    }

    // If an avatar file was selected, upload to Storage first and then persist the resulting URL.
    const avatarFile = formData.get("avatarFile")
    if (avatarFile instanceof File && avatarFile.size > 0) {
      const fd = new FormData()
      fd.set("file", avatarFile)
      const res = await uploadUserAvatar(session.access_token, fd)
      if ("error" in res) {
        toast.error(res.error)
        setLoading(false)
        return
      }
      formData.set("avatarUrl", res.url)
    }

    const result = await updateUserProfile(session.access_token, formData)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Profile updated successfully")
      setOpen(false)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Edit Profile</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right">
                Username
              </Label>
              <Input
                id="username"
                name="username"
                defaultValue={user.username || ""}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bio" className="text-right">
                Bio
              </Label>
              <Textarea
                id="bio"
                name="bio"
                defaultValue={user.bio || ""}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Avatar</Label>

              <div className="col-span-3 space-y-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatarUrl ?? undefined} />
                    <AvatarFallback>{(user.username ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="text-sm text-muted-foreground">Uploads to Storage (max 2MB)</div>
                </div>

                <Input id="avatarFile" name="avatarFile" type="file" accept="image/png,image/jpeg,image/webp" />

                {/* Keep existing updateUserProfile contract (avatarUrl string) */}
                <input type="hidden" name="avatarUrl" defaultValue={user.avatarUrl || ""} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
