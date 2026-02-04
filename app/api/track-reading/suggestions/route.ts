import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim()

  if (!q) {
    return NextResponse.json({ results: [] as Array<{ id: string; title: string; author: string }> })
  }

  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("books")
    .select("id,title,author")
    .or(`title.ilike.%${q}%,author.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .limit(8)

  if (error) {
    console.error("Suggestions query failed", error)
    return NextResponse.json({ results: [] }, { status: 200 })
  }

  return NextResponse.json({ results: data ?? [] })
}
