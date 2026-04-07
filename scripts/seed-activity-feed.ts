import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import { randomUUID } from "crypto"

dotenv.config({ path: ".env.local" })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string

if (!url || !serviceRole) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.")
  process.exit(1)
}

const supabase = createClient(url, serviceRole)

type TitleRow = {
  id: string
  title: string
  author: string
  cover_image_url: string | null
}

type SeedUser = {
  authUserId: string
  username: string
  email: string
  bio: string
}

const seedUsers: SeedUser[] = [
  {
    authUserId: randomUUID(),
    username: "AvaReads",
    email: "ava@bookworm.local",
    bio: "Sci-fi lover. Always chasing the next big idea.",
  },
  {
    authUserId: randomUUID(),
    username: "TheoShelf",
    email: "theo@bookworm.local",
    bio: "Cozy mysteries, thoughtful reviews, and extra tea.",
  },
  {
    authUserId: randomUUID(),
    username: "MayaPages",
    email: "maya@bookworm.local",
    bio: "Fantasy collector and club organizer.",
  },
]

async function ensureSeedUsers() {
  const map = new Map<string, { id: string; username: string }>()

  for (const user of seedUsers) {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { username: user.username },
    })

    if (createError && (createError as any).code !== "email_exists") {
      console.error("Failed to create auth user", createError)
      process.exit(1)
    }

    if (created?.user?.id) {
      user.authUserId = created.user.id
    } else {
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers()
      if (listError) {
        console.error("Failed to list users", listError)
        process.exit(1)
      }
      const existing = listData.users.find((entry) => entry.email === user.email)
      if (!existing?.id) {
        console.error("Auth user not found after create attempt", user.email)
        process.exit(1)
      }
      user.authUserId = existing.id
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .upsert(
        {
          auth_user_id: user.authUserId,
          username: user.username,
          email: user.email,
          bio: user.bio,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "auth_user_id" }
      )
      .select("id, auth_user_id, username")
      .single()

    if (error) {
      console.error("Failed to seed users", error)
      process.exit(1)
    }

    map.set(data.auth_user_id as string, { id: data.id as string, username: data.username as string })
  }

  return map
}

async function fetchSeedTitles() {
  const { data, error } = await supabase
    .from("titles")
    .select("id,title,author,cover_image_url")
    .order("created_at", { ascending: false })
    .limit(6)

  if (error) {
    console.error("Failed to fetch titles", error)
    process.exit(1)
  }

  const titles = (data ?? []) as TitleRow[]
  if (titles.length < 4) {
    console.error("Need at least 4 existing titles to seed activity feed.")
    process.exit(1)
  }

  return titles
}

async function ensureList(userId: string, listType: string, name: string, isDefault = true) {
  const { data: existing, error: fetchError } = await supabase
    .from("title_lists")
    .select("id,name,list_type")
    .eq("user_profile_id", userId)
    .eq("list_type", listType)
    .maybeSingle()

  if (fetchError) {
    console.error("Failed to fetch list", fetchError)
    process.exit(1)
  }

  if (existing?.id) return existing.id as string

  const { data: created, error: createError } = await supabase
    .from("title_lists")
    .insert({
      user_profile_id: userId,
      name,
      list_type: listType,
      is_public: false,
      is_default: isDefault,
    })
    .select("id")
    .single()

  if (createError || !created?.id) {
    console.error("Failed to create list", createError)
    process.exit(1)
  }

  return created.id as string
}

async function addListItem(listId: string, titleId: string) {
  const { data, error } = await supabase
    .from("title_list_items")
    .upsert(
      {
        list_id: listId,
        title_id: titleId,
      },
      { onConflict: "list_id,title_id" }
    )
    .select("id")
    .single()

  if (error) {
    console.error("Failed to add list item", error)
    process.exit(1)
  }

  return data?.id as string
}

async function logActivity(input: {
  userProfileId: string
  titleId?: string | null
  eventType: string
  metadata: Record<string, any>
}) {
  const { error } = await supabase.from("activity_events").insert({
    user_profile_id: input.userProfileId,
    title_id: input.titleId ?? null,
    event_type: input.eventType,
    metadata: input.metadata,
  })

  if (error) {
    console.error("Failed to log activity", { error, input })
    process.exit(1)
  }
}

async function seed() {
  const userMap = await ensureSeedUsers()
  const titles = await fetchSeedTitles()

  const [titleA, titleB, titleC, titleD] = titles

  const ava = userMap.get(seedUsers[0].authUserId)
  const theo = userMap.get(seedUsers[1].authUserId)
  const maya = userMap.get(seedUsers[2].authUserId)

  if (!ava || !theo || !maya) {
    console.error("Failed to map seed users")
    process.exit(1)
  }

  const reviewPayload = {
    user_id: ava.id,
    title_id: titleA.id,
    rating: 9,
    review_text: "A thrilling blend of space opera and heart. Could not put it down.",
  }

  const { data: reviewRow, error: reviewError } = await supabase
    .from("reviews")
    .upsert(reviewPayload, { onConflict: "user_id,title_id" })
    .select("id")
    .single()

  if (reviewError) {
    console.error("Failed to seed review", reviewError)
    process.exit(1)
  }

  await logActivity({
    userProfileId: ava.id,
    titleId: titleA.id,
    eventType: "review_posted",
    metadata: {
      actor: { id: ava.id, username: ava.username },
      title: { id: titleA.id, title: titleA.title, author: titleA.author, cover: titleA.cover_image_url },
      rating: 9,
      reviewId: reviewRow?.id ?? null,
      reviewText: reviewPayload.review_text,
    },
  })

  const finishedListId = await ensureList(ava.id, "finished-reading", "Finished Reading")
  const finishedItemId = await addListItem(finishedListId, titleB.id)

  await logActivity({
    userProfileId: ava.id,
    titleId: titleB.id,
    eventType: "title_finished",
    metadata: {
      actor: { id: ava.id, username: ava.username },
      title: { id: titleB.id, title: titleB.title, author: titleB.author, cover: titleB.cover_image_url },
      list: { id: finishedListId, name: "Finished Reading", listType: "finished-reading" },
      listItemId: finishedItemId,
    },
  })

  const customListName = "April Mood Reads"
  const { data: customList, error: customListError } = await supabase
    .from("title_lists")
    .insert({
      user_profile_id: theo.id,
      name: customListName,
      list_type: "custom",
      is_public: false,
      is_default: false,
    })
    .select("id")
    .single()

  if (customListError || !customList?.id) {
    console.error("Failed to create custom list", customListError)
    process.exit(1)
  }

  await logActivity({
    userProfileId: theo.id,
    eventType: "list_created",
    metadata: {
      actor: { id: theo.id, username: theo.username },
      list: { id: customList.id, name: customListName, listType: "custom" },
    },
  })

  const listItemId = await addListItem(customList.id as string, titleC.id)

  await logActivity({
    userProfileId: theo.id,
    titleId: titleC.id,
    eventType: "list_item_added",
    metadata: {
      actor: { id: theo.id, username: theo.username },
      list: { id: customList.id, name: customListName, listType: "custom" },
      title: { id: titleC.id, title: titleC.title, author: titleC.author, cover: titleC.cover_image_url },
      listItemId,
    },
  })

  const toReadListId = await ensureList(theo.id, "to-read", "Planned Reading")
  const toReadItemId = await addListItem(toReadListId, titleD.id)

  await logActivity({
    userProfileId: theo.id,
    titleId: titleD.id,
    eventType: "list_item_added",
    metadata: {
      actor: { id: theo.id, username: theo.username },
      list: { id: toReadListId, name: "Planned Reading", listType: "to-read" },
      title: { id: titleD.id, title: titleD.title, author: titleD.author, cover: titleD.cover_image_url },
      listItemId: toReadItemId,
    },
  })

  const { data: clubRow, error: clubError } = await supabase
    .from("clubs")
    .insert({
      type: "book",
      name: "Midnight Readers",
      description: "A cozy club for late-night reading sessions.",
      categories: ["FANTASY", "MYSTERY"],
      owner_user_id: maya.id,
      updated_at: new Date().toISOString(),
    })
    .select("id,name")
    .single()

  if (clubError || !clubRow?.id) {
    console.error("Failed to create club", clubError)
    process.exit(1)
  }

  await logActivity({
    userProfileId: maya.id,
    eventType: "club_created",
    metadata: {
      actor: { id: maya.id, username: maya.username },
      club: { id: clubRow.id, name: clubRow.name },
    },
  })

  const { data: memberRow, error: memberError } = await supabase
    .from("club_members")
    .insert({
      club_id: clubRow.id,
      user_id: ava.id,
    })
    .select("id")
    .single()

  if (memberError || !memberRow?.id) {
    console.error("Failed to add club member", memberError)
    process.exit(1)
  }

  await logActivity({
    userProfileId: ava.id,
    eventType: "club_joined",
    metadata: {
      actor: { id: ava.id, username: ava.username },
      club: { id: clubRow.id, name: clubRow.name },
      clubMemberId: memberRow.id,
    },
  })

  await logActivity({
    userProfileId: ava.id,
    eventType: "achievement_earned",
    metadata: {
      actor: { id: ava.id, username: ava.username },
      achievement: {
        id: "bookworm",
        name: "Bookworm",
        description: "Read 10 books",
        icon: "📚",
      },
    },
  })

  console.log("Seeded activity feed data.")
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
