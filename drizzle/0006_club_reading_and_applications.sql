-- Adds club reading list items + membership applications

CREATE TABLE IF NOT EXISTS "club_reading_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"book_id" uuid,
	"title" text,
	"author" text,
	"created_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "club_reading_items" ADD CONSTRAINT "club_reading_items_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "club_reading_items" ADD CONSTRAINT "club_reading_items_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;

CREATE TABLE IF NOT EXISTS "club_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "club_applications" ADD CONSTRAINT "club_applications_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "club_applications" ADD CONSTRAINT "club_applications_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "club_applications_user_club_unique" ON "club_applications" USING btree ("user_id","club_id");
