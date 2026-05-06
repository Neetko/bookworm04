alter table public.clubs
  add column if not exists join_policy varchar(20);

update public.clubs
set join_policy = coalesce(join_policy, 'approval_required');

alter table public.clubs
  alter column join_policy set default 'approval_required';

alter table public.clubs
  alter column join_policy set not null;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clubs_join_policy_check'
      AND conrelid = 'public.clubs'::regclass
  ) THEN
    ALTER TABLE public.clubs
      ADD CONSTRAINT clubs_join_policy_check
      CHECK (join_policy IN ('open', 'approval_required', 'invite_only'));
  END IF;
END
$$;

alter table public.club_applications
  add column if not exists reviewed_at timestamptz;

alter table public.club_applications
  add column if not exists reviewed_by_user_id uuid references public.user_profiles(id) on delete set null;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'club_applications_status_check'
      AND conrelid = 'public.club_applications'::regclass
  ) THEN
    ALTER TABLE public.club_applications
      ADD CONSTRAINT club_applications_status_check
      CHECK (status IN ('pending', 'accepted', 'declined'));
  END IF;
END
$$;

create table if not exists public.club_invitations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  inviter_user_id uuid not null references public.user_profiles(id) on delete cascade,
  invitee_user_id uuid not null references public.user_profiles(id) on delete cascade,
  status varchar(20) not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists club_invitations_invitee_club_unique
  on public.club_invitations(invitee_user_id, club_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'club_invitations_status_check'
      AND conrelid = 'public.club_invitations'::regclass
  ) THEN
    ALTER TABLE public.club_invitations
      ADD CONSTRAINT club_invitations_status_check
      CHECK (status IN ('pending', 'accepted', 'declined'));
  END IF;
END
$$;

alter table public.club_invitations enable row level security;

drop policy if exists "club_invitations_select_involved" on public.club_invitations;
create policy "club_invitations_select_involved"
on public.club_invitations
for select
to authenticated
using (
  public.is_current_user_admin()
  or invitee_user_id = public.current_profile_id()
  or public.can_manage_club(club_id)
);

drop policy if exists "club_invitations_insert_owner" on public.club_invitations;
create policy "club_invitations_insert_owner"
on public.club_invitations
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or public.can_manage_club(club_id)
);

drop policy if exists "club_invitations_update_involved" on public.club_invitations;
create policy "club_invitations_update_involved"
on public.club_invitations
for update
to authenticated
using (
  public.is_current_user_admin()
  or invitee_user_id = public.current_profile_id()
  or public.can_manage_club(club_id)
)
with check (
  public.is_current_user_admin()
  or invitee_user_id = public.current_profile_id()
  or public.can_manage_club(club_id)
);

drop policy if exists "club_invitations_delete_involved" on public.club_invitations;
create policy "club_invitations_delete_involved"
on public.club_invitations
for delete
to authenticated
using (
  public.is_current_user_admin()
  or invitee_user_id = public.current_profile_id()
  or public.can_manage_club(club_id)
);
