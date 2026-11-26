import { createFileRoute } from "@tanstack/react-router"
import { handleDiaryNoteUpdate, handleDiaryProgress } from "../features/diary/write.server"

export const Route = createFileRoute("/api/diary")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handleDiaryProgress(request)
        } catch (error) {
          console.error("Diary progress failed", error)
          return Response.json({ error: "Failed to save diary progress" }, { status: 500 })
        }
      },
      PATCH: async ({ request }) => {
        try {
          return await handleDiaryNoteUpdate(request)
        } catch (error) {
          console.error("Diary note update failed", error)
          return Response.json({ error: "Failed to update diary entry" }, { status: 500 })
        }
      },
    },
  },
})
