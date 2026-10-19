-- PRIME Gestão: controle de versão para impedir sobrescrita silenciosa.
-- Execute no SQL Editor do NOVO projeto Supabase.
-- Requer as tabelas prime_data e prime_operators e as políticas RLS já criadas.
alter table public.prime_data add column if not exists version bigint not null default 0;

create or replace function public.prime_save_snapshot(
  p_id text, p_expected_version bigint, p_dados jsonb
) returns bigint
language plpgsql security invoker set search_path = public
as $$
declare v_new bigint;
begin
  if auth.uid() is null or not exists (
    select 1 from public.prime_operators where user_id = auth.uid()
  ) then raise exception 'Operador não autorizado'; end if;
  if p_id <> 'prime_shared_v1' then raise exception 'Identificador inválido'; end if;
  if p_expected_version = 0 then
    insert into public.prime_data(id,dados,version,atualizado_em)
    values (p_id,p_dados,1,now()) on conflict(id) do nothing
    returning version into v_new;
    if v_new is not null then return v_new; end if;
  end if;
  update public.prime_data
    set dados=p_dados,version=version+1,atualizado_em=now()
    where id=p_id and version=p_expected_version
    returning version into v_new;
  return coalesce(v_new,-1);
end;
$$;
revoke all on function public.prime_save_snapshot(text,bigint,jsonb) from public,anon;
grant execute on function public.prime_save_snapshot(text,bigint,jsonb) to authenticated;
-- Verifique também as políticas RLS de prime_data antes de usar.
