import { expect, test } from "@playwright/test"
import { DEMO_READER, DEMO_TITLES } from "./fixtures/demo"
import { createAnonymousTestClient, createDemoReaderTestClient } from "./helpers/supabase"

test("database policies reject engagement writes until the reader finishes the title", async () => {
  const anonymous = createAnonymousTestClient()
  const reader = await createDemoReaderTestClient()
  const titleId = DEMO_TITLES.frankenstein.id
  const anonymousPostId = crypto.randomUUID()
  const readerPostId = crypto.randomUUID()

  const { data: finishedList, error: listError } = await reader
    .from("title_lists")
    .select("id")
    .eq("user_profile_id", DEMO_READER.profileId)
    .eq("list_type", "finished-reading")
    .single()

  expect(listError).toBeNull()
  expect(finishedList?.id).toBeTruthy()
  const finishedListId = finishedList!.id as string

  await reader.from("discussion_posts").delete().eq("id", readerPostId)
  await reader.from("reviews").delete().eq("user_id", DEMO_READER.profileId).eq("title_id", titleId)
  await reader.from("title_list_items").delete().eq("list_id", finishedListId).eq("title_id", titleId)

  try {
    const { error: anonymousPostError } = await anonymous.from("discussion_posts").insert({
      id: anonymousPostId,
      title_id: titleId,
      user_id: DEMO_READER.profileId,
      content: "<p>Anonymous policy probe</p>",
    })
    expect(anonymousPostError).not.toBeNull()

    const { error: unreadPostError } = await reader.from("discussion_posts").insert({
      id: readerPostId,
      title_id: titleId,
      user_id: DEMO_READER.profileId,
      content: "<p>Unread policy probe</p>",
    })
    expect(unreadPostError).not.toBeNull()

    const { error: unreadReviewError } = await reader.from("reviews").insert({
      user_id: DEMO_READER.profileId,
      title_id: titleId,
      rating: 8,
      review_text: "Unread review policy probe",
    })
    expect(unreadReviewError).not.toBeNull()

    const { error: finishError } = await reader.from("title_list_items").insert({
      list_id: finishedListId,
      title_id: titleId,
    })
    expect(finishError).toBeNull()

    const { error: invalidRatingError } = await reader.from("reviews").insert({
      user_id: DEMO_READER.profileId,
      title_id: titleId,
      rating: 11,
      review_text: "Invalid rating policy probe",
    })
    expect(invalidRatingError).not.toBeNull()

    const { error: readPostError } = await reader.from("discussion_posts").insert({
      id: readerPostId,
      title_id: titleId,
      user_id: DEMO_READER.profileId,
      content: "<p>Finished reader policy probe</p>",
    })
    expect(readPostError).toBeNull()

    const { error: readReviewError } = await reader.from("reviews").insert({
      user_id: DEMO_READER.profileId,
      title_id: titleId,
      rating: 8,
      review_text: "Finished reader policy probe",
    })
    expect(readReviewError).toBeNull()
  } finally {
    await reader.from("discussion_posts").delete().eq("id", readerPostId)
    await reader.from("reviews").delete().eq("user_id", DEMO_READER.profileId).eq("title_id", titleId)
    await reader.from("title_list_items").delete().eq("list_id", finishedListId).eq("title_id", titleId)
    await reader.auth.signOut()
  }
})
