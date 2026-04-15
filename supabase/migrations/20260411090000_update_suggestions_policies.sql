-- Update suggestions RLS policies to use direct user_roles checks

alter table public.suggestions enable row level security;

drop policy if exists "Admins have full control" on public.suggestions;
drop policy if exists "Admins can update suggestions" on public.suggestions;
drop policy if exists "Admins can delete suggestions" on public.suggestions;

drop policy if exists "Admins have full control (user_roles)" on public.suggestions;
drop policy if exists "Admins can update suggestions (user_roles)" on public.suggestions;
drop policy if exists "Admins can delete suggestions (user_roles)" on public.suggestions;

create policy "Admins have full control (user_roles)"
  on public.suggestions for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create policy "Admins can update suggestions (user_roles)"
  on public.suggestions for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create policy "Admins can delete suggestions (user_roles)"
  on public.suggestions for delete
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );
