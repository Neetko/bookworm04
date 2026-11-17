-- Club membership and notification transitions are security boundaries.
-- Keep direct table access read-only and expose narrow, transactional RPCs.

alter table public.club_applications
  drop constraint if exists club_applications_status_check;

alter table public.club_applications
  add constraint club_applications_status_check
  check (status in ('pending', 'accepted', 'declined', 'withdrawn'));

alter table public.club_invitations
  drop constraint if exists club_invitations_status_check;

alter table public.club_invitations
  add constraint club_invitations_status_check
  check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired'));

-- Feed pagination and the unread badge have different access patterns. Keep a
-- stable `(created_at, id)` cursor for the feed and a small partial index for
-- the exact unread count instead of relying on low-selectivity single columns.
create index if not exists notifications_recipient_feed_idx
  on public.notifications (recipient_profile_id, created_at desc, id desc);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_profile_id)
  where is_read = false;

create or replace function public.club_notification_context(
  target_actor_profile_id uuid,
  target_club_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'actor', (
      select jsonb_build_object(
        'id', profile.id,
        'username', profile.username,
        'avatarUrl', profile.avatar_url
      )
      from public.user_profiles profile
      where profile.id = target_actor_profile_id
    ),
    'club', (
      select jsonb_build_object(
        'id', club.id,
        'name', club.name,
        'avatarUrl', club.avatar_url
      )
      from public.clubs club
      where club.id = target_club_id
    )
  )
$$;

create or replace function public.resolve_club_notification(
  target_recipient_profile_id uuid,
  target_event_type text,
  target_entity_key text,
  target_entity_id uuid,
  resolution_action text,
  resolved_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer := 0;
begin
  if target_entity_key not in ('application', 'invitation') then
    raise exception 'Unsupported club notification entity';
  end if;

  update public.notifications notification
  set
    is_read = true,
    metadata = coalesce(notification.metadata, '{}'::jsonb)
      || jsonb_build_object(
        target_entity_key,
        coalesce(notification.metadata -> target_entity_key, '{}'::jsonb)
          || jsonb_build_object(
            'id', target_entity_id,
            'status', resolution_action,
            'respondedAt', resolved_at
          ),
        'resolution', jsonb_build_object(
          'action', resolution_action,
          'respondedAt', resolved_at
        )
      )
  where notification.recipient_profile_id = target_recipient_profile_id
    and notification.event_type = target_event_type
    and notification.metadata #>> array[target_entity_key, 'id'] = target_entity_id::text
    and coalesce(notification.metadata #>> '{resolution,action}', '') = '';

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

create or replace function public.ensure_club_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.club_members (club_id, user_id)
  values (new.id, new.owner_user_id)
  on conflict (user_id, club_id) do nothing;

  return new;
end;
$$;

drop trigger if exists ensure_club_owner_membership on public.clubs;
create trigger ensure_club_owner_membership
after insert on public.clubs
for each row
execute function public.ensure_club_owner_membership();

insert into public.club_members (club_id, user_id)
select club.id, club.owner_user_id
from public.clubs club
on conflict (user_id, club_id) do nothing;

create or replace function public.join_open_club(target_club_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid := public.current_profile_id();
  target_club public.clubs%rowtype;
  inserted_membership_id uuid;
  pending_application_id uuid;
  pending_invitation_id uuid;
  transition_time timestamptz := now();
begin
  if actor_profile_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into target_club
  from public.clubs
  where id = target_club_id
  for update;

  if not found then
    raise exception 'Club not found';
  end if;

  if target_club.owner_user_id = actor_profile_id then
    return target_club.id;
  end if;

  if target_club.join_policy <> 'open' then
    raise exception 'This club requires approval or an invitation';
  end if;

  insert into public.club_members (club_id, user_id)
  values (target_club.id, actor_profile_id)
  on conflict (user_id, club_id) do nothing
  returning id into inserted_membership_id;

  if inserted_membership_id is null then
    return target_club.id;
  end if;

  update public.club_applications
  set
    status = 'withdrawn',
    reviewed_at = transition_time,
    reviewed_by_user_id = null
  where club_id = target_club.id
    and user_id = actor_profile_id
    and status = 'pending'
  returning id into pending_application_id;

  if pending_application_id is not null then
    perform public.resolve_club_notification(
      target_club.owner_user_id,
      'club_application_received',
      'application',
      pending_application_id,
      'withdrawn',
      transition_time
    );
  end if;

  select invitation.id into pending_invitation_id
  from public.club_invitations invitation
  where invitation.club_id = target_club.id
    and invitation.invitee_user_id = actor_profile_id
    and invitation.status = 'pending'
  for update;

  if pending_invitation_id is not null then
    update public.club_invitations
    set status = 'accepted', responded_at = transition_time
    where id = pending_invitation_id;

    perform public.resolve_club_notification(
      actor_profile_id,
      'club_invited_to_club',
      'invitation',
      pending_invitation_id,
      'accepted',
      transition_time
    );
  end if;

  insert into public.activity_events (user_profile_id, event_type, metadata)
  values (
    actor_profile_id,
    'club_joined',
    jsonb_build_object(
      'club', jsonb_build_object(
        'id', target_club.id,
        'name', target_club.name,
        'avatar_url', target_club.avatar_url
      )
    )
  );

  return target_club.id;
end;
$$;

create or replace function public.submit_club_application(target_club_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid := public.current_profile_id();
  target_club public.clubs%rowtype;
  target_application public.club_applications%rowtype;
  transition_time timestamptz := now();
  notification_context jsonb;
begin
  if actor_profile_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into target_club
  from public.clubs
  where id = target_club_id
  for update;

  if not found then
    raise exception 'Club not found';
  end if;

  if target_club.owner_user_id = actor_profile_id
    or exists (
      select 1 from public.club_members member
      where member.club_id = target_club.id
        and member.user_id = actor_profile_id
    ) then
    raise exception 'You are already a member of this club';
  end if;

  if target_club.join_policy <> 'approval_required' then
    raise exception 'This club is not accepting applications';
  end if;

  if exists (
    select 1 from public.club_invitations invitation
    where invitation.club_id = target_club.id
      and invitation.invitee_user_id = actor_profile_id
      and invitation.status = 'pending'
  ) then
    raise exception 'You already have a pending invitation';
  end if;

  select * into target_application
  from public.club_applications application
  where application.club_id = target_club.id
    and application.user_id = actor_profile_id
  for update;

  if found and target_application.status = 'pending' then
    return target_application.id;
  end if;

  if target_application.id is null then
    insert into public.club_applications (
      club_id,
      user_id,
      status,
      created_at,
      reviewed_at,
      reviewed_by_user_id
    )
    values (
      target_club.id,
      actor_profile_id,
      'pending',
      transition_time,
      null,
      null
    )
    returning * into target_application;
  else
    update public.club_applications
    set
      status = 'pending',
      created_at = transition_time,
      reviewed_at = null,
      reviewed_by_user_id = null
    where id = target_application.id
    returning * into target_application;
  end if;

  notification_context := public.club_notification_context(actor_profile_id, target_club.id);

  insert into public.notifications (
    recipient_profile_id,
    actor_profile_id,
    event_type,
    metadata
  )
  values (
    target_club.owner_user_id,
    actor_profile_id,
    'club_application_received',
    notification_context || jsonb_build_object(
      'application', jsonb_build_object(
        'id', target_application.id,
        'submittedAt', transition_time
      )
    )
  );

  return target_application.id;
end;
$$;

create or replace function public.invite_club_member(
  target_club_id uuid,
  target_invitee_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid := public.current_profile_id();
  target_club public.clubs%rowtype;
  target_invitation public.club_invitations%rowtype;
  transition_time timestamptz := now();
  notification_context jsonb;
begin
  if actor_profile_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into target_club
  from public.clubs
  where id = target_club_id
  for update;

  if not found then
    raise exception 'Club not found';
  end if;

  if not public.can_manage_club(target_club.id) then
    raise exception 'Forbidden';
  end if;

  if not exists (
    select 1 from public.user_profiles profile
    where profile.id = target_invitee_profile_id
  ) then
    raise exception 'User not found';
  end if;

  if target_invitee_profile_id = target_club.owner_user_id then
    raise exception 'This reader already manages the club';
  end if;

  if exists (
    select 1 from public.club_members member
    where member.club_id = target_club.id
      and member.user_id = target_invitee_profile_id
  ) then
    raise exception 'This reader is already a member';
  end if;

  if exists (
    select 1 from public.club_applications application
    where application.club_id = target_club.id
      and application.user_id = target_invitee_profile_id
      and application.status = 'pending'
  ) then
    raise exception 'This reader already has a pending application';
  end if;

  select * into target_invitation
  from public.club_invitations invitation
  where invitation.club_id = target_club.id
    and invitation.invitee_user_id = target_invitee_profile_id
  for update;

  if found and target_invitation.status = 'pending' then
    return target_invitation.id;
  end if;

  if target_invitation.id is null then
    insert into public.club_invitations (
      club_id,
      inviter_user_id,
      invitee_user_id,
      status,
      responded_at,
      created_at
    )
    values (
      target_club.id,
      actor_profile_id,
      target_invitee_profile_id,
      'pending',
      null,
      transition_time
    )
    returning * into target_invitation;
  else
    update public.club_invitations
    set
      inviter_user_id = actor_profile_id,
      status = 'pending',
      responded_at = null,
      created_at = transition_time
    where id = target_invitation.id
    returning * into target_invitation;
  end if;

  notification_context := public.club_notification_context(actor_profile_id, target_club.id);

  insert into public.notifications (
    recipient_profile_id,
    actor_profile_id,
    event_type,
    metadata
  )
  values (
    target_invitee_profile_id,
    actor_profile_id,
    'club_invited_to_club',
    notification_context || jsonb_build_object(
      'invitation', jsonb_build_object('id', target_invitation.id, 'status', 'pending')
    )
  );

  return target_invitation.id;
end;
$$;

create or replace function public.review_club_application(
  target_club_id uuid,
  target_application_id uuid,
  approve_application boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid := public.current_profile_id();
  target_club public.clubs%rowtype;
  target_application public.club_applications%rowtype;
  inserted_membership_id uuid;
  pending_invitation_id uuid;
  transition_time timestamptz := now();
  resolution_status text := case when approve_application then 'accepted' else 'declined' end;
  notification_event text := case when approve_application then 'club_application_approved' else 'club_application_declined' end;
  notification_context jsonb;
begin
  if actor_profile_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into target_club
  from public.clubs
  where id = target_club_id
  for update;

  if not found then
    raise exception 'Club not found';
  end if;

  if not public.can_manage_club(target_club.id) then
    raise exception 'Forbidden';
  end if;

  select * into target_application
  from public.club_applications application
  where application.id = target_application_id
    and application.club_id = target_club.id
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  if target_application.status <> 'pending' then
    if target_application.status = resolution_status then
      return target_club.id;
    end if;
    raise exception 'Application is no longer pending';
  end if;

  if approve_application then
    insert into public.club_members (club_id, user_id)
    values (target_club.id, target_application.user_id)
    on conflict (user_id, club_id) do nothing
    returning id into inserted_membership_id;
  end if;

  update public.club_applications
  set
    status = resolution_status,
    reviewed_at = transition_time,
    reviewed_by_user_id = actor_profile_id
  where id = target_application.id
    and status = 'pending';

  update public.club_invitations
  set
    status = case when approve_application then 'accepted' else 'revoked' end,
    responded_at = transition_time
  where club_id = target_club.id
    and invitee_user_id = target_application.user_id
    and status = 'pending'
  returning id into pending_invitation_id;

  if pending_invitation_id is not null then
    perform public.resolve_club_notification(
      target_application.user_id,
      'club_invited_to_club',
      'invitation',
      pending_invitation_id,
      case when approve_application then 'accepted' else 'revoked' end,
      transition_time
    );
  end if;

  perform public.resolve_club_notification(
    target_club.owner_user_id,
    'club_application_received',
    'application',
    target_application.id,
    case when approve_application then 'approved' else 'declined' end,
    transition_time
  );

  notification_context := public.club_notification_context(actor_profile_id, target_club.id);

  insert into public.notifications (
    recipient_profile_id,
    actor_profile_id,
    event_type,
    metadata
  )
  values (
    target_application.user_id,
    actor_profile_id,
    notification_event,
    notification_context || jsonb_build_object(
      'application', jsonb_build_object(
        'id', target_application.id,
        'status', resolution_status,
        'respondedAt', transition_time
      )
    )
  );

  if approve_application and inserted_membership_id is not null then
    insert into public.activity_events (user_profile_id, event_type, metadata)
    values (
      target_application.user_id,
      'club_joined',
      jsonb_build_object(
        'club', jsonb_build_object(
          'id', target_club.id,
          'name', target_club.name,
          'avatar_url', target_club.avatar_url
        )
      )
    );
  end if;

  return target_club.id;
end;
$$;

create or replace function public.respond_to_club_invitation(
  target_invitation_id uuid,
  accept_invitation boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid := public.current_profile_id();
  target_invitation public.club_invitations%rowtype;
  target_club public.clubs%rowtype;
  invitation_club_id uuid;
  pending_application_id uuid;
  inserted_membership_id uuid;
  transition_time timestamptz := now();
  resolution_status text := case when accept_invitation then 'accepted' else 'declined' end;
  notification_context jsonb;
begin
  if actor_profile_id is null then
    raise exception 'Unauthorized';
  end if;

  select invitation.club_id into invitation_club_id
  from public.club_invitations invitation
  where invitation.id = target_invitation_id;

  if not found then
    raise exception 'Invitation not found';
  end if;

  select * into target_club
  from public.clubs
  where id = invitation_club_id
  for update;

  if not found then
    raise exception 'Club not found';
  end if;

  select * into target_invitation
  from public.club_invitations invitation
  where invitation.id = target_invitation_id
    and invitation.club_id = target_club.id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if target_invitation.invitee_user_id <> actor_profile_id then
    raise exception 'Forbidden';
  end if;

  if target_invitation.status <> 'pending' then
    if target_invitation.status = resolution_status then
      return target_club.id;
    end if;
    raise exception 'Invitation is no longer pending';
  end if;

  if accept_invitation then
    insert into public.club_members (club_id, user_id)
    values (target_club.id, actor_profile_id)
    on conflict (user_id, club_id) do nothing
    returning id into inserted_membership_id;
  end if;

  update public.club_invitations
  set status = resolution_status, responded_at = transition_time
  where id = target_invitation.id
    and status = 'pending';

  select application.id into pending_application_id
  from public.club_applications application
  where application.club_id = target_club.id
    and application.user_id = actor_profile_id
    and application.status = 'pending'
  for update;

  if pending_application_id is not null then
    update public.club_applications
    set
      status = 'withdrawn',
      reviewed_at = transition_time,
      reviewed_by_user_id = null
    where id = pending_application_id;

    perform public.resolve_club_notification(
      target_club.owner_user_id,
      'club_application_received',
      'application',
      pending_application_id,
      'withdrawn',
      transition_time
    );
  end if;

  perform public.resolve_club_notification(
    actor_profile_id,
    'club_invited_to_club',
    'invitation',
    target_invitation.id,
    resolution_status,
    transition_time
  );

  notification_context := public.club_notification_context(actor_profile_id, target_club.id);

  insert into public.notifications (
    recipient_profile_id,
    actor_profile_id,
    event_type,
    metadata
  )
  values (
    target_invitation.inviter_user_id,
    actor_profile_id,
    case when accept_invitation then 'club_invitation_accepted' else 'club_invitation_declined' end,
    notification_context || jsonb_build_object(
      'invitation', jsonb_build_object(
        'id', target_invitation.id,
        'status', resolution_status,
        'respondedAt', transition_time
      )
    )
  );

  if accept_invitation and inserted_membership_id is not null then
    insert into public.activity_events (user_profile_id, event_type, metadata)
    values (
      actor_profile_id,
      'club_joined',
      jsonb_build_object(
        'club', jsonb_build_object(
          'id', target_club.id,
          'name', target_club.name,
          'avatar_url', target_club.avatar_url
        )
      )
    );
  end if;

  return target_club.id;
end;
$$;

create or replace function public.withdraw_club_application(target_club_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid := public.current_profile_id();
  target_club public.clubs%rowtype;
  target_application public.club_applications%rowtype;
  transition_time timestamptz := now();
begin
  if actor_profile_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into target_club
  from public.clubs
  where id = target_club_id
  for update;

  if not found then
    raise exception 'Club not found';
  end if;

  select * into target_application
  from public.club_applications application
  where application.club_id = target_club.id
    and application.user_id = actor_profile_id
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  if target_application.status <> 'pending' then
    if target_application.status = 'withdrawn' then
      return target_club.id;
    end if;
    raise exception 'Application is no longer pending';
  end if;

  update public.club_applications
  set
    status = 'withdrawn',
    reviewed_at = transition_time,
    reviewed_by_user_id = null
  where id = target_application.id
    and status = 'pending';

  perform public.resolve_club_notification(
    target_club.owner_user_id,
    'club_application_received',
    'application',
    target_application.id,
    'withdrawn',
    transition_time
  );

  return target_club.id;
end;
$$;

create or replace function public.revoke_club_invitation(
  target_club_id uuid,
  target_invitation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid := public.current_profile_id();
  target_club public.clubs%rowtype;
  target_invitation public.club_invitations%rowtype;
  transition_time timestamptz := now();
begin
  if actor_profile_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into target_club
  from public.clubs
  where id = target_club_id
  for update;

  if not found then
    raise exception 'Club not found';
  end if;

  if not public.can_manage_club(target_club.id) then
    raise exception 'Forbidden';
  end if;

  select * into target_invitation
  from public.club_invitations invitation
  where invitation.id = target_invitation_id
    and invitation.club_id = target_club.id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if target_invitation.status <> 'pending' then
    if target_invitation.status = 'revoked' then
      return target_club.id;
    end if;
    raise exception 'Invitation is no longer pending';
  end if;

  update public.club_invitations
  set status = 'revoked', responded_at = transition_time
  where id = target_invitation.id
    and status = 'pending';

  perform public.resolve_club_notification(
    target_invitation.invitee_user_id,
    'club_invited_to_club',
    'invitation',
    target_invitation.id,
    'revoked',
    transition_time
  );

  return target_club.id;
end;
$$;

create or replace function public.leave_club(target_club_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid := public.current_profile_id();
  target_club public.clubs%rowtype;
begin
  if actor_profile_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into target_club
  from public.clubs
  where id = target_club_id
  for update;

  if not found then
    raise exception 'Club not found';
  end if;

  if target_club.owner_user_id = actor_profile_id then
    raise exception 'Transfer ownership or delete the club before leaving';
  end if;

  delete from public.club_members
  where club_id = target_club.id
    and user_id = actor_profile_id;

  return target_club.id;
end;
$$;

create or replace function public.remove_club_member(
  target_club_id uuid,
  target_member_profile_id uuid,
  removal_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid := public.current_profile_id();
  target_club public.clubs%rowtype;
  removed_membership_id uuid;
  notification_context jsonb;
begin
  if actor_profile_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into target_club
  from public.clubs
  where id = target_club_id
  for update;

  if not found then
    raise exception 'Club not found';
  end if;

  if not public.can_manage_club(target_club.id) then
    raise exception 'Forbidden';
  end if;

  if target_member_profile_id = target_club.owner_user_id then
    raise exception 'Cannot remove the club owner';
  end if;

  delete from public.club_members
  where club_id = target_club.id
    and user_id = target_member_profile_id
  returning id into removed_membership_id;

  if removed_membership_id is null then
    return target_club.id;
  end if;

  notification_context := public.club_notification_context(actor_profile_id, target_club.id);

  insert into public.notifications (
    recipient_profile_id,
    actor_profile_id,
    event_type,
    metadata
  )
  values (
    target_member_profile_id,
    actor_profile_id,
    'club_membership_removed',
    notification_context || jsonb_build_object(
      'membership', jsonb_build_object(
        'reason', nullif(btrim(removal_reason), '')
      )
    )
  );

  return target_club.id;
end;
$$;

create or replace function public.mark_notifications_read(
  target_notification_id uuid default null,
  mark_all boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_recipient_profile_id uuid := public.current_profile_id();
  affected_rows integer := 0;
begin
  if current_recipient_profile_id is null then
    raise exception 'Unauthorized';
  end if;

  if (target_notification_id is not null) = mark_all then
    raise exception 'Choose exactly one notification or explicitly mark all';
  end if;

  if target_notification_id is not null then
    update public.notifications
    set is_read = true
    where id = target_notification_id
      and recipient_profile_id = current_recipient_profile_id;
  else
    update public.notifications
    set is_read = true
    where recipient_profile_id = current_recipient_profile_id
      and is_read = false;
  end if;

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

-- All lifecycle writes now flow through the transactional functions above.
drop policy if exists "club_members_insert_member_or_owner" on public.club_members;
drop policy if exists "club_members_delete_member_or_owner" on public.club_members;

drop policy if exists "club_applications_insert_own" on public.club_applications;
drop policy if exists "club_applications_update_owner" on public.club_applications;
drop policy if exists "club_applications_delete_involved" on public.club_applications;

drop policy if exists "club_invitations_insert_owner" on public.club_invitations;
drop policy if exists "club_invitations_update_involved" on public.club_invitations;
drop policy if exists "club_invitations_delete_involved" on public.club_invitations;

drop policy if exists "notifications_insert_actor" on public.notifications;
drop policy if exists "notifications_update_recipient" on public.notifications;

revoke all on function public.club_notification_context(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.resolve_club_notification(uuid, text, text, uuid, text, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.ensure_club_owner_membership() from public, anon, authenticated, service_role;

revoke all on function public.join_open_club(uuid) from public, anon, authenticated, service_role;
grant execute on function public.join_open_club(uuid) to authenticated;

revoke all on function public.submit_club_application(uuid) from public, anon, authenticated, service_role;
grant execute on function public.submit_club_application(uuid) to authenticated;

revoke all on function public.invite_club_member(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.invite_club_member(uuid, uuid) to authenticated;

revoke all on function public.review_club_application(uuid, uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.review_club_application(uuid, uuid, boolean) to authenticated;

revoke all on function public.respond_to_club_invitation(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.respond_to_club_invitation(uuid, boolean) to authenticated;

revoke all on function public.withdraw_club_application(uuid) from public, anon, authenticated, service_role;
grant execute on function public.withdraw_club_application(uuid) to authenticated;

revoke all on function public.revoke_club_invitation(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.revoke_club_invitation(uuid, uuid) to authenticated;

revoke all on function public.leave_club(uuid) from public, anon, authenticated, service_role;
grant execute on function public.leave_club(uuid) to authenticated;

revoke all on function public.remove_club_member(uuid, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.remove_club_member(uuid, uuid, text) to authenticated;

revoke all on function public.mark_notifications_read(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.mark_notifications_read(uuid, boolean) to authenticated;
