import { sql } from "drizzle-orm"
import { pgSchema, pgTable, uuid, varchar, text, integer, timestamp, uniqueIndex, boolean } from "drizzle-orm/pg-core"

// Reference auth schema for foreign keys (do not create it)
const auth = pgSchema("auth")
export const authUsers = auth.table("users", {
  id: uuid("id").primaryKey().notNull(),
})

export const books = pgTable("books", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  titleId: uuid("title_id"),
  title: varchar("title", { length: 255 }).notNull(),
  author: varchar("author", { length: 255 }).notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  genre: text("genre").array(),
  publishedYear: integer("published_year"),
  isbn: varchar("isbn", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
})

export const titles = pgTable("titles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  author: text("author").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  publishedYear: integer("published_year"),
  isbn: text("isbn"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
})

export const titleReads = pgTable(
  "title_reads",
  {
    userProfileId: uuid("user_profile_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    titleId: uuid("title_id")
      .references(() => titles.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqUserTitleRead: uniqueIndex("title_reads_user_title_unique").on(t.userProfileId, t.titleId),
  })
)

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

// Tracked/ingested titles (metadata-only; not readable content in the Library)
export const trackedBooks = pgTable("tracked_books", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  titleId: uuid("title_id").references(() => titles.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  author: varchar("author", { length: 255 }).notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  genre: text("genre").array(),
  publishedYear: integer("published_year"),
  isbn: varchar("isbn", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
})

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    username: varchar("username", { length: 100 }),
    email: varchar("email", { length: 255 }),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    role: varchar("role", { length: 100 }).default("Reader"), // Community role: Reader, Book Club Leader, Critic, etc.
    signature: text("signature"), // User signature text
    signatureImage: text("signature_image"), // URL to signature GIF/image
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
    authUserId: uuid("auth_user_id").references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (t: any) => ({
    uniqAuthUser: uniqueIndex("user_profiles_auth_user_id_unique").on(t.authUserId),
  })
)

export const clubReadingItems = pgTable("club_reading_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: uuid("club_id")
    .references(() => clubs.id, { onDelete: "cascade" })
    .notNull(),
  bookId: uuid("book_id").references(() => books.id, { onDelete: "set null" }),
  titleId: uuid("title_id").references(() => titles.id, { onDelete: "set null" }),
  title: text("title"),
  author: text("author"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
})

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
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqUserClub: uniqueIndex("club_applications_user_club_unique").on(t.userId, t.clubId),
  })
)

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").references(() => userProfiles.id, { onDelete: "cascade" }),
    bookId: uuid("book_id").references(() => books.id, { onDelete: "cascade" }),
    titleId: uuid("title_id").references(() => titles.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(), // 1-10 scale
    reviewText: text("review_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqUserBook: uniqueIndex("reviews_user_book_unique").on(t.userId, t.bookId),
    uniqUserTitle: uniqueIndex("reviews_user_title_unique").on(t.userId, t.titleId),
  })
)

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").references(() => userProfiles.id, { onDelete: "cascade" }),
    bookId: uuid("book_id").references(() => books.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqUserBook: uniqueIndex("bookmarks_user_book_unique").on(t.userId, t.bookId),
  })
)

export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").references(() => userProfiles.id, { onDelete: "cascade" }),
    bookId: uuid("book_id").references(() => books.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqUserBook: uniqueIndex("favorites_user_book_unique").on(t.userId, t.bookId),
  })
)

export const bookContents = pgTable(
  "book_contents",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    bookId: uuid("book_id")
      .references(() => books.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqBookId: uniqueIndex("book_contents_book_id_unique").on(t.bookId),
  })
)

export const userProgress = pgTable(
  "user_progress",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userProfileId: uuid("user_profile_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    bookId: uuid("book_id")
      .references(() => books.id, { onDelete: "cascade" })
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
    uniqUserBookProgress: uniqueIndex("user_progress_user_book_unique").on(t.userProfileId, t.bookId),
  })
)

export const trackedUserProgress = pgTable(
  "tracked_user_progress",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userProfileId: uuid("user_profile_id")
      .references(() => userProfiles.id, { onDelete: "cascade" })
      .notNull(),
    trackedBookId: uuid("tracked_book_id")
      .references(() => trackedBooks.id, { onDelete: "cascade" })
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
    uniqUserTrackedBookProgress: uniqueIndex("tracked_user_progress_user_book_unique").on(t.userProfileId, t.trackedBookId),
  })
)

export const externalBooks = pgTable(
  "external_books",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    trackedBookId: uuid("tracked_book_id")
      .references(() => trackedBooks.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (t: any) => ({
    uniqSourceExternalId: uniqueIndex("external_books_source_external_id_unique").on(t.source, t.externalId),
  })
)

export const discussionPosts = pgTable("discussion_posts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookId: uuid("book_id").references(() => books.id, { onDelete: "cascade" }),
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

export const clubs = pgTable("clubs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 20 }).notNull(), // "book" | "writer"
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
