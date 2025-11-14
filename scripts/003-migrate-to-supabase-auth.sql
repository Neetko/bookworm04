-- Migrate user_profiles to Supabase Auth
-- 1) Replace kinde_user_id with auth_user_id referencing auth.users
ALTER TABLE IF EXISTS public.user_profiles
  DROP COLUMN IF EXISTS kinde_user_id,
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2) Ensure username and email columns exist (no-op if already present)
ALTER TABLE IF EXISTS public.user_profiles
  ALTER COLUMN username DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL;

-- 3) Create function to auto-provision profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (auth_user_id, username, email)
  VALUES (NEW.id, NEW.email, NEW.email)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Trigger after auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
