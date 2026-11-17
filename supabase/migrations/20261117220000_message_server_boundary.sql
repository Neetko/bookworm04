-- Apply after the API has deployed and uses the service role for message writes.
-- Browser sessions retain RLS-scoped reads but cannot bypass server validation.
drop policy if exists "messages_insert_own" on public.messages;
revoke insert, update, delete on table public.messages from public, anon, authenticated;
grant insert, update, delete on table public.messages to service_role;
