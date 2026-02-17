-- Drop auth.users foreign key from user_profiles (Supabase-managed schema)

alter table user_profiles drop constraint if exists user_profiles_auth_user_id_fkey;
