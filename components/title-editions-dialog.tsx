"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getTitleEditionsAction, type TitleEditionRow } from "@/app/actions/title"

export function TitleEditionsDialog({ titleId }: { titleId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editions, setEditions] = useState<TitleEditionRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadEditions = async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await getTitleEditionsAction(titleId)
      setEditions(rows)
    } catch (e: any) {
      setError(e?.message ?? "Failed to load editions")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => { setOpen(true); loadEditions() }}>
        Editions
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editions</DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading editions...</div>
          ) : error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : editions.length === 0 ? (
            <div className="text-sm text-muted-foreground">No editions found.</div>
          ) : (
            <div className="space-y-2">
              {editions.map((edition, index) => (
                <div key={`${edition.workId}-${edition.asin ?? edition.isbn10 ?? edition.isbn13 ?? index}`} className="rounded-md border p-2 text-sm">
                  <div className="font-medium">{edition.format ?? "Unknown format"}</div>
                  <div className="text-xs text-muted-foreground">Work: {edition.workId}</div>
                  <div className="text-xs">
                    {edition.asin ? `ASIN: ${edition.asin}` : null}
                    {!edition.asin && edition.isbn13 ? `ISBN-13: ${edition.isbn13}` : null}
                    {!edition.asin && !edition.isbn13 && edition.isbn10 ? `ISBN-10: ${edition.isbn10}` : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {edition.saleability === "FOR_SALE" ? "For sale" : "Not for sale"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
