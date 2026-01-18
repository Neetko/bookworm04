-- Storage buckets + policies for image uploads
-- Buckets: club-avatars, book-covers, user-avatars

-- Create buckets (idempotent)
insert into storage.buckets (id, name, public)
values
  ('club-avatars', 'club-avatars', true),
  ('book-covers', 'book-covers', true),
  ('user-avatars', 'user-avatars', true)
on conflict (id) do update set public = excluded.public;

-- Policies (idempotent via exception handler)
-- Note: storage.objects has RLS enabled by default.

-- Public read
DO $$
BEGIN
  CREATE POLICY "Public read club-avatars"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'club-avatars');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Public read book-covers"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'book-covers');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Public read user-avatars"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'user-avatars');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Authenticated write
DO $$
BEGIN
  CREATE POLICY "Auth write club-avatars"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'club-avatars');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Auth update club-avatars"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'club-avatars')
  WITH CHECK (bucket_id = 'club-avatars');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Auth delete club-avatars"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'club-avatars');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Auth write book-covers"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'book-covers');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Auth update book-covers"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'book-covers')
  WITH CHECK (bucket_id = 'book-covers');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Auth delete book-covers"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'book-covers');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- User avatars: restrict writes to each user's own folder: <auth.uid()>/...
DO $$
BEGIN
  CREATE POLICY "User write own user-avatars"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND name LIKE (auth.uid()::text || '/%')
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "User update own user-avatars"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND name LIKE (auth.uid()::text || '/%')
  )
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND name LIKE (auth.uid()::text || '/%')
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "User delete own user-avatars"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND name LIKE (auth.uid()::text || '/%')
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
