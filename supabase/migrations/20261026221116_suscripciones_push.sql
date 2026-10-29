-- F4-T1: el endpoint y las claves de Web Push son datos de dispositivo.
-- Nunca se exponen al cliente por SELECT; solo escritura/baja mediante RPC propia.

insert into public.parametros (clave, valor, descripcion) values
  ('max_suscripciones_push_por_usuario', 5,
   'Máximo de dispositivos push por perfil (propuesta P-20)');

create table public.suscripciones_push (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  municipio text,
  celda text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint push_ambito_unico check ((municipio is not null) <> (celda is not null)),
  constraint push_endpoint_https check (endpoint ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/[^[:space:]#]*$'),
  constraint push_municipio_valido check (municipio is null or length(municipio) between 1 and 100),
  constraint push_celda_valida check (celda is null or celda ~ '^[0-9]+_[0-9]+$')
);
create index push_perfil_idx on public.suscripciones_push (perfil_id);
create index push_municipio_idx on public.suscripciones_push (municipio)
  where municipio is not null;
create index push_celda_idx on public.suscripciones_push (celda)
  where celda is not null;
create trigger push_actualizado_en before update on public.suscripciones_push
  for each row execute function public.tocar_actualizado_en();

alter table public.suscripciones_push enable row level security;
revoke all on public.suscripciones_push from public, anon, authenticated;
-- Sin políticas: únicamente service_role y RPC SECURITY DEFINER la consultan.

create function public.suscribir_push(
  p_endpoint text, p_p256dh text, p_auth text, p_municipio text,
  p_celda text default null
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_municipio text := nullif(lower(trim(p_municipio)), '');
  v_celda text := nullif(trim(p_celda), '');
  v_id uuid;
  v_dueno uuid;
begin
  if v_uid is null then raise exception 'sin_sesion'; end if;
  if p_endpoint is null or length(p_endpoint) > 2048
     or p_endpoint !~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/[^[:space:]#]*$'
     or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{80,100}$'
     or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{16,32}$'
     or ((v_municipio is null) = (v_celda is null))
     or (v_municipio is not null and length(v_municipio) > 100)
     or (v_celda is not null and v_celda !~ '^[0-9]+_[0-9]+$') then
    raise exception 'parametros_invalidos';
  end if;

  -- Serializa el límite por perfil, incluso con dos altas simultáneas.
  perform 1 from public.perfiles where id = v_uid for update;
  select id, perfil_id into v_id, v_dueno from public.suscripciones_push
    where endpoint = p_endpoint for update;
  if found then
    if v_dueno <> v_uid then raise exception 'suscripcion_en_uso'; end if;
    update public.suscripciones_push
      set p256dh = p_p256dh, auth = p_auth, municipio = v_municipio, celda = v_celda
      where id = v_id;
    return v_id;
  end if;
  if (select count(*) from public.suscripciones_push where perfil_id = v_uid)
    >= public.param('max_suscripciones_push_por_usuario') then
    raise exception 'limite_suscripciones';
  end if;

  insert into public.suscripciones_push (perfil_id, endpoint, p256dh, auth, municipio, celda)
    values (v_uid, p_endpoint, p_p256dh, p_auth, v_municipio, v_celda)
    on conflict (endpoint) do update
      set p256dh = excluded.p256dh, auth = excluded.auth,
          municipio = excluded.municipio, celda = excluded.celda
      where public.suscripciones_push.perfil_id = v_uid
    returning id into v_id;
  if v_id is null then raise exception 'suscripcion_en_uso'; end if;
  return v_id;
end $$;
revoke execute on function public.suscribir_push(text, text, text, text, text) from public, anon;
grant execute on function public.suscribir_push(text, text, text, text, text) to authenticated;

create function public.baja_push(p_endpoint text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'sin_sesion'; end if;
  delete from public.suscripciones_push
    where endpoint = p_endpoint and perfil_id = (select auth.uid());
  return found;
end $$;
revoke execute on function public.baja_push(text) from public, anon;
grant execute on function public.baja_push(text) to authenticated;
