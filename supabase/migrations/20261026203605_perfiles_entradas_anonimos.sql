-- F1-T2: perfil de cada usuario de Auth, medio por visita y preferencias de accesibilidad.
-- Las escrituras del cliente pasan por RPC; los datos solo se leen por su dueño.

create type public.medio_transporte as enum ('peaton', 'bici', 'auto', 'transporte_publico');

create table public.perfiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  accesibilidad jsonb not null default '{}'::jsonb,
  creado_en     timestamptz not null default now(),
  constraint perfiles_accesibilidad_valida check (
    jsonb_typeof(accesibilidad) = 'object'
    and accesibilidad - 'daltonismo' = '{}'::jsonb
    and (not (accesibilidad ? 'daltonismo')
         or jsonb_typeof(accesibilidad -> 'daltonismo') = 'boolean')
  )
);

create table public.entradas (
  id         bigint generated always as identity primary key,
  perfil_id  uuid not null references public.perfiles (id) on delete cascade,
  medio      public.medio_transporte not null,
  creado_en  timestamptz not null default now()
);
create index entradas_perfil_creado_idx on public.entradas (perfil_id, creado_en desc);

alter table public.perfiles enable row level security;
alter table public.entradas enable row level security;

revoke all on public.perfiles, public.entradas from public, anon, authenticated;
revoke all on sequence public.entradas_id_seq from public, anon, authenticated;
grant select on public.perfiles, public.entradas to authenticated;

create policy perfiles_solo_propietario on public.perfiles
  for select to authenticated using (id = (select auth.uid()));
create policy entradas_solo_propietario on public.entradas
  for select to authenticated using (perfil_id = (select auth.uid()));

-- Crear el perfil al crear el usuario, incluso si fue una sesión anónima.
-- El esquema privado no se expone por la Data API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create or replace function private.crear_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function private.crear_perfil() from public, anon, authenticated;
drop trigger if exists crear_perfil_al_registrar_usuario on auth.users;
create trigger crear_perfil_al_registrar_usuario
  after insert on auth.users for each row execute function private.crear_perfil();

-- Cubrir usuarios de Auth creados antes de aplicar esta migración.
insert into public.perfiles (id) select id from auth.users on conflict (id) do nothing;

create function public.registrar_entrada(medio text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'sin_sesion';
  end if;
  if medio is null or medio not in ('peaton', 'bici', 'auto', 'transporte_publico') then
    raise exception 'parametros_invalidos';
  end if;

  insert into public.entradas (perfil_id, medio)
  values (v_uid, medio::public.medio_transporte);
end $$;
revoke execute on function public.registrar_entrada(text) from public, anon;
grant execute on function public.registrar_entrada(text) to authenticated;

create function public.guardar_accesibilidad(prefs jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'sin_sesion';
  end if;
  if prefs is null or jsonb_typeof(prefs) <> 'object'
     or prefs - 'daltonismo' <> '{}'::jsonb
     or ((prefs ? 'daltonismo') and jsonb_typeof(prefs -> 'daltonismo') <> 'boolean') then
    raise exception 'parametros_invalidos';
  end if;

  update public.perfiles set accesibilidad = prefs where id = v_uid;
end $$;
revoke execute on function public.guardar_accesibilidad(jsonb) from public, anon;
grant execute on function public.guardar_accesibilidad(jsonb) to authenticated;
