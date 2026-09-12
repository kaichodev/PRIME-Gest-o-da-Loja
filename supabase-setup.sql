-- PRIME Gestão V11 - estado compartilhado do aplicativo
-- Execute UMA VEZ no SQL Editor do Supabase.

create table if not exists public.prime_app_state (
  id bigint primary key default 1 check (id = 1),
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);

alter table public.prime_app_state enable row level security;

drop policy if exists "prime_state_select" on public.prime_app_state;
create policy "prime_state_select" on public.prime_app_state
for select to authenticated using (true);

drop policy if exists "prime_state_insert" on public.prime_app_state;
create policy "prime_state_insert" on public.prime_app_state
for insert to authenticated with check (true);

drop policy if exists "prime_state_update" on public.prime_app_state;
create policy "prime_state_update" on public.prime_app_state
for update to authenticated using (true) with check (true);

insert into public.prime_app_state (id, dados)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

do $$ begin
  alter publication supabase_realtime add table public.prime_app_state;
exception when duplicate_object then null;
end $$;

select 'PRIME V11 pronta para sincronização!' as resultado;
