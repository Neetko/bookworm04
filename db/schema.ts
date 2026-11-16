import { sql } from "drizzle-orm"
import { pgTable, pgEnum, uuid, varchar, text, integer, timestamp, uniqueIndex, boolean, check, jsonb, date, index } from "drizzle-orm/pg-core"

export const titles = pgTable("titles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  author: text("author").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  genre: text("genre").array(),
  workId: text("work_id"),
  isbnList: jsonb("isbn_list"),
  dupeWorkIds: jsonb("dupe_work_ids"),
  publishedYear: integer("published_year"),
  isbn: text("isbn"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
})

export const appRole = pgEnum("app_role", ["admin", "moderator", "user"])
export const suggestionStatus = pgEnum("suggestion_status", ["pending", "approved", "dismissed"])
export const suggestionMatchType = pgEnum("suggestion_match_type", ["exact_auto_dupe", "bookworm_suggested"])

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    role: appRole("role").default("user").notNull(),
  },
  (t: any) => ({
    uniqUserRoleUser: uniqueIndex("user_roles_user_id_unique").on(t.userId),
  })
)

export const editions = pgTable(
  "editions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workId: text("work_id").notNull(),
    isbn10: text("isbn_10"),
    isbn13: text("isbn_13"),
    asin: text("asin"),
    volumeId: text("volume_id"),
    format: text("format"),
    saleability: text("saleability"),
    rawGoogleData: jsonb("raw_google_data"),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqIsbn10: uniqueIndex("editions_isbn_10_unique").on(t.isbn10),
    uniqIsbn13: uniqueIndex("editions_isbn_13_unique").on(t.isbn13),
    uniqVolumeId: uniqueIndex("editions_volume_id_unique").on(t.volumeId),
  })
)

export const activityEvents = pgTable("activity_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userProfileId: uuid("user_profile_id")
    .references(() => userProfiles.id, { onDelete: "cascade" })
    .notNull(),
  titleId: uuid("title_id").references(() => titles.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
})

export const titleLists = pgTable(
  "title_lists",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userProfileId: uuid("user_profile_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    listType: text("list_type").default("custom").notNull(),
    isPublic: boolean("is_public").default(true).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqUserListType: uniqueIndex("title_lists_user_type_unique").on(t.userProfileId, t.listType),
  })
)

export const titleListItems = pgTable(
  "title_list_items",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    listId: uuid("list_id")
      .references(() => titleLists.id, { onDelete: "cascade" })
      .notNull(),
    titleId: uuid("title_id")
      .references(() => titles.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqListTitle: uniqueIndex("title_list_items_list_title_unique").on(t.listId, t.titleId),
  })
)

export const titleListLikes = pgTable(
  "title_list_likes",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    listId: uuid("list_id")
      .references(() => titleLists.id, { onDelete: "cascade" })
      .notNull(),
    userProfileId: uuid("user_profile_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqListLike: uniqueIndex("title_list_likes_user_list_unique").on(t.userProfileId, t.listId),
  })
)

export const userGenrePoints = pgTable(
  "user_genre_points",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userProfileId: uuid("user_profile_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    titleId: uuid("title_id").references(() => titles.id, { onDelete: "set null" }),
    genre: text("genre").notNull(),
    points: integer("points").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqUserSourceGenreReason: uniqueIndex("user_genre_points_user_source_genre_reason_unique").on(
      t.userProfileId,
      t.sourceType,
      t.sourceId,
      t.genre,
      t.reason
    ),
  })
)

export const userExperience = pgTable("user_experience", {
  userProfileId: uuid("user_profile_id")
    .primaryKey()
    .references(() => userProfiles.id, { onDelete: "cascade" }),
  totalExperience: integer("total_experience").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
})

export const titleSources = pgTable(
  "title_sources",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    titleId: uuid("title_id")
      .references(() => titles.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqSourceExternalId: uniqueIndex("title_sources_source_external_id_unique").on(t.source, t.externalId),
  })
)

export const titleReferenceWorks = pgTable(
  "title_reference_works",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    titleId: uuid("title_id")
      .references(() => titles.id, { onDelete: "cascade" })
      .notNull(),
    workId: text("work_id").notNull(),
    source: text("source").default("unknown").notNull(),
    confidenceScore: integer("confidence_score"),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqTitleWork: uniqueIndex("title_reference_works_title_work_unique").on(t.titleId, t.workId),
    titleReferenceWorksTitleIdx: index("title_reference_works_title_idx").on(t.titleId),
    titleReferenceWorksWorkIdx: index("title_reference_works_work_idx").on(t.workId),
  })
)

export const referenceIsbns = pgTable(
  "reference_isbns",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    titleId: uuid("title_id")
      .references(() => titles.id, { onDelete: "cascade" })
      .notNull(),
    workId: text("work_id").notNull(),
    isbn: text("isbn").notNull(),
    source: text("source").default("unknown").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqReferenceIsbn: uniqueIndex("reference_isbns_isbn_unique").on(t.isbn),
    referenceIsbnsTitleIdx: index("reference_isbns_title_idx").on(t.titleId),
    referenceIsbnsWorkIdx: index("reference_isbns_work_idx").on(t.workId),
  })
)

export const workCoverCache = pgTable(
  "work_cover_cache",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workId: text("work_id").notNull(),
    source: text("source").notNull(),
    sourceCoverKey: text("source_cover_key").notNull(),
    remoteUrl: text("remote_url").notNull(),
    cachedFilePath: text("cached_file_path"),
    cachedPublicUrl: text("cached_public_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqWorkCoverCache: uniqueIndex("work_cover_cache_work_source_key_unique").on(t.workId, t.source, t.sourceCoverKey),
    workCoverCacheWorkIdx: index("work_cover_cache_work_idx").on(t.workId),
  })
)

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    username: varchar("username", { length: 100 }).notNull(),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    favoriteGenres: text("favorite_genres").array().notNull().default(sql`'{}'::text[]`),
    email: varchar("email", { length: 255 }),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    role: varchar("role", { length: 100 }).default("reader"), // Public role label: reader, moderator, or admin.
    signature: text("signature"), // User signature text
    signatureImage: text("signature_image"), // URL to signature GIF/image
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
    authUserId: uuid("auth_user_id"),
  },
  (t: any) => ({
    uniqAuthUser: uniqueIndex("user_profiles_auth_user_id_unique").on(t.authUserId),
  })
)

export const googleIngestPreviews = pgTable(
  "google_ingest_previews",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    profileId: uuid("profile_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    volumeId: text("volume_id").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t: any) => ({
    googleIngestPreviewsProfileExpiryIdx: index("google_ingest_previews_profile_expiry_idx").on(
      t.profileId,
      t.expiresAt
    ),
  })
)

export const suggestions = pgTable(
  "suggestions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    titleId: uuid("title_id")
      .references(() => titles.id, { onDelete: "cascade" })
      .notNull(),
    suggestedGenres: text("suggested_genres").array(),
    algorithmSuggestedGenres: text("algorithm_suggested_genres").array(),
    suggestedSelectedWorkIds: text("suggested_selected_work_ids").array(),
    suggestedSelectedWorkSnapshots: jsonb("suggested_selected_work_snapshots"),
    adminFinalGenres: text("admin_final_genres").array(),
    adminFinalSelectedWorkIds: text("admin_final_selected_work_ids").array(),
    adminFinalSelectedWorkSnapshots: jsonb("admin_final_selected_work_snapshots"),
    adminFinalCoverSelection: jsonb("admin_final_cover_selection"),
    adminReviewedAt: timestamp("admin_reviewed_at", { withTimezone: true }),
    adminReviewedByProfileId: uuid("admin_reviewed_by_profile_id")
      .references(() => userProfiles.id, { onDelete: "set null" }),
    suggestedByProfileId: uuid("suggested_by_profile_id")
      .references(() => userProfiles.id, { onDelete: "set null" }),
    status: suggestionStatus("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (t) => ({
    suggestionsStatusCreatedAtIdx: index("suggestions_status_created_at_idx").on(t.status, t.createdAt),
  })
)

export const suggestionWorkMatches = pgTable(
  "suggestion_work_matches",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    suggestionId: uuid("suggestion_id")
      .references(() => suggestions.id, { onDelete: "cascade" })
      .notNull(),
    workId: text("work_id").notNull(),
    matchType: suggestionMatchType("match_type").notNull(),
    confidenceScore: integer("confidence_score"),
    reason: text("reason"),
    workSnapshot: jsonb("work_snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqSuggestionMatch: uniqueIndex("suggestion_work_matches_unique_match").on(t.suggestionId, t.workId, t.matchType),
    suggestionIdx: index("suggestion_work_matches_suggestion_idx").on(t.suggestionId),
  })
)

export const userFollows = pgTable(
  "user_follows",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    followerProfileId: uuid("follower_profile_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    followedProfileId: uuid("followed_profile_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    isPrivate: boolean("is_private").default(true).notNull(),
    isFriend: boolean("is_friend").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqFollowPair: uniqueIndex("user_follows_unique_pair").on(t.followerProfileId, t.followedProfileId),
    followerFollowedCheck: check(
      "user_follows_follower_followed_check",
      sql`follower_profile_id <> followed_profile_id`
    ),
  })
)

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    senderProfileId: uuid("sender_profile_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    recipientProfileId: uuid("recipient_profile_id").references(() => userProfiles.id, { onDelete: "set null" }),
    recipientUsername: text("recipient_username"),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status").default("sent").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    senderDeleted: boolean("sender_deleted").default(false).notNull(),
    recipientDeleted: boolean("recipient_deleted").default(false).notNull(),
    replyTo: uuid("reply_to"),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    senderIdx: index("messages_sender_profile_id_idx").on(t.senderProfileId),
    recipientIdx: index("messages_recipient_profile_id_idx").on(t.recipientProfileId),
    statusIdx: index("messages_status_idx").on(t.status),
  })
)

export const clubReadingItems = pgTable("club_reading_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: uuid("club_id")
    .references(() => clubs.id, { onDelete: "cascade" })
    .notNull(),
  titleId: uuid("title_id").references(() => titles.id, { onDelete: "set null" }),
  title: text("title"),
  author: text("author"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
}, (t: any) => ({
  requireBookOrTitle: check(
    "club_reading_items_book_or_title_check",
    sql`title_id is not null`
  ),
}))

export const clubApplications = pgTable(
  "club_applications",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    clubId: uuid("club_id")
      .references(() => clubs.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => userProfiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqUserClub: uniqueIndex("club_applications_user_club_unique").on(t.userId, t.clubId),
  })
)

export const clubInvitations = pgTable(
  "club_invitations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    clubId: uuid("club_id")
      .references(() => clubs.id, { onDelete: "cascade" })
      .notNull(),
    inviterUserId: uuid("inviter_user_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    inviteeUserId: uuid("invitee_user_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqInviteeClub: uniqueIndex("club_invitations_invitee_club_unique").on(t.inviteeUserId, t.clubId),
  })
)

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").references(() => userProfiles.id, { onDelete: "cascade" }),
    titleId: uuid("title_id").references(() => titles.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(), // 1-10 scale
    reviewText: text("review_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqUserTitle: uniqueIndex("reviews_user_title_unique").on(t.userId, t.titleId),
  })
)

export const reviewLikes = pgTable(
  "review_likes",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    reviewId: uuid("review_id")
      .references(() => reviews.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqUserReview: uniqueIndex("review_likes_user_review_unique").on(t.userId, t.reviewId),
  })
)

export const titleBookmarks = pgTable(
  "title_bookmarks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userProfileId: uuid("user_profile_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    titleId: uuid("title_id")
      .references(() => titles.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqUserTitle: uniqueIndex("title_bookmarks_user_title_unique").on(t.userProfileId, t.titleId),
    userIdx: index("title_bookmarks_user_idx").on(t.userProfileId),
    titleIdx: index("title_bookmarks_title_idx").on(t.titleId),
  })
)

export const titleUserProgress = pgTable(
  "title_user_progress",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userProfileId: uuid("user_profile_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    titleId: uuid("title_id")
      .references(() => titles.id, { onDelete: "cascade" })
      .notNull(),
    currentPage: integer("current_page").default(0).notNull(),
    totalPages: integer("total_pages"),
    minutesListened: integer("minutes_listened"),
    totalMinutes: integer("total_minutes"),
    progressPercent: integer("progress_percent"),
    isCompleted: boolean("is_completed").default(false).notNull(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqUserTitleProgress: uniqueIndex("title_user_progress_user_title_unique").on(t.userProfileId, t.titleId),
  })
)

export const readingDiaryEntries = pgTable("reading_diary_entries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userProfileId: uuid("user_profile_id")
    .references(() => userProfiles.id, { onDelete: "cascade" })
    .notNull(),
  titleId: uuid("title_id")
    .references(() => titles.id, { onDelete: "cascade" })
    .notNull(),
  entryDate: date("entry_date").default(sql`CURRENT_DATE`).notNull(),
  noteHtml: text("note_html"),
  noteText: text("note_text"),
  progressMode: text("progress_mode").notNull(),
  currentPage: integer("current_page"),
  totalPages: integer("total_pages"),
  minutesListened: integer("minutes_listened"),
  totalMinutes: integer("total_minutes"),
  progressPercent: integer("progress_percent"),
  isCompleted: boolean("is_completed").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
})

export const discussionPosts = pgTable("discussion_posts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  titleId: uuid("title_id")
    .references(() => titles.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => userProfiles.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  likesCount: integer("likes_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
})

export const postLikes = pgTable(
  "post_likes",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    postId: uuid("post_id")
      .references(() => discussionPosts.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqUserPost: uniqueIndex("post_likes_user_post_unique").on(t.userId, t.postId),
  })
)

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    recipientProfileId: uuid("recipient_profile_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    actorProfileId: uuid("actor_profile_id").references(() => userProfiles.id, { onDelete: "set null" }),
    titleId: uuid("title_id").references(() => titles.id, { onDelete: "set null" }),
    postId: uuid("post_id").references(() => discussionPosts.id, { onDelete: "set null" }),
    reviewId: uuid("review_id").references(() => reviews.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    metadata: jsonb("metadata"),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    recipientIdx: index("notifications_recipient_idx").on(t.recipientProfileId),
    readIdx: index("notifications_read_idx").on(t.isRead),
    createdIdx: index("notifications_created_idx").on(t.createdAt),
  })
)

export const clubs = pgTable("clubs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 20 }).notNull(), // "book" | "writer"
  joinPolicy: varchar("join_policy", { length: 20 }).default("approval_required").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  avatarUrl: text("avatar_url"),
  categories: text("categories").array(),
  currentTitleId: uuid("current_title_id").references(() => titles.id, { onDelete: "set null" }),
  ownerUserId: uuid("owner_user_id")
    .references(() => userProfiles.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
})

export const clubWriterWorks = pgTable(
  "club_writer_works",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    clubId: uuid("club_id")
      .references(() => clubs.id, { onDelete: "cascade" })
      .notNull(),
    authorUserId: uuid("author_user_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    contentHtml: text("content_html").default("").notNull(),
    contentText: text("content_text").default("").notNull(),
    isPublic: boolean("is_public").default(false).notNull(),
    isCompleted: boolean("is_completed").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    clubWriterWorksClubIdx: index("club_writer_works_club_idx").on(t.clubId, t.updatedAt),
    clubWriterWorksAuthorIdx: index("club_writer_works_author_idx").on(t.authorUserId, t.updatedAt),
  })
)

export const clubWriterWorkLikes = pgTable(
  "club_writer_work_likes",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workId: uuid("work_id")
      .references(() => clubWriterWorks.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqUserWriterWorkLike: uniqueIndex("club_writer_work_likes_user_work_unique").on(t.userId, t.workId),
    clubWriterWorkLikesWorkIdx: index("club_writer_work_likes_work_idx").on(t.workId),
  })
)

export const clubReadingComments = pgTable("club_reading_comments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: uuid("club_id")
    .references(() => clubs.id, { onDelete: "cascade" })
    .notNull(),
  titleId: uuid("title_id")
    .references(() => titles.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => userProfiles.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  likesCount: integer("likes_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
})

export const clubMembers = pgTable(
  "club_members",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    clubId: uuid("club_id")
      .references(() => clubs.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqUserClub: uniqueIndex("club_members_user_club_unique").on(t.userId, t.clubId),
  })
)
