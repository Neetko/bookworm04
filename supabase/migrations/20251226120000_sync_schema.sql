-- Sync local Supabase DB schema with `db/schema.ts`

-- 1) user_profiles: add community fields
ALTER TABLE IF EXISTS public.user_profiles
  ADD COLUMN IF NOT EXISTS role varchar(100) DEFAULT 'Reader',
  ADD COLUMN IF NOT EXISTS signature text,
  ADD COLUMN IF NOT EXISTS signature_image text;

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_auth_user_id_unique
  ON public.user_profiles (auth_user_id);


-- 2) books: genre should be text[]
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'books'
      AND column_name = 'genre'
      AND udt_name <> '_text'
  ) THEN
    ALTER TABLE public.books
      ALTER COLUMN genre TYPE text[]
      USING CASE WHEN genre IS NULL THEN NULL ELSE ARRAY[genre] END;
  END IF;
END $$;


-- 3) book_contents
CREATE TABLE IF NOT EXISTS public.book_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  book_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.book_contents
    ADD CONSTRAINT book_contents_book_id_books_id_fk
    FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- 4) user_progress
CREATE TABLE IF NOT EXISTS public.user_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_profile_id uuid NOT NULL,
  book_id uuid NOT NULL,
  current_page integer DEFAULT 0 NOT NULL,
  is_completed boolean DEFAULT false NOT NULL,
  last_read_at timestamp with time zone DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.user_progress
    ADD CONSTRAINT user_progress_user_profile_id_user_profiles_id_fk
    FOREIGN KEY (user_profile_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.user_progress
    ADD CONSTRAINT user_progress_book_id_books_id_fk
    FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS user_progress_user_book_unique
  ON public.user_progress (user_profile_id, book_id);


-- 5) discussion_posts
CREATE TABLE IF NOT EXISTS public.discussion_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  book_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  likes_count integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.discussion_posts
    ADD CONSTRAINT discussion_posts_book_id_books_id_fk
    FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.discussion_posts
    ADD CONSTRAINT discussion_posts_user_id_user_profiles_id_fk
    FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- 6) post_likes
CREATE TABLE IF NOT EXISTS public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.post_likes
    ADD CONSTRAINT post_likes_post_id_discussion_posts_id_fk
    FOREIGN KEY (post_id) REFERENCES public.discussion_posts(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.post_likes
    ADD CONSTRAINT post_likes_user_id_user_profiles_id_fk
    FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS post_likes_user_post_unique
  ON public.post_likes (user_id, post_id);
