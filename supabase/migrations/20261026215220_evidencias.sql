-- F2-T4: evidencias opcionales de reportes. El bucket es privado; solo el autor
-- sube a la carpeta de su reporte y la RPC registra objetos que sí existen.

create type public.tipo_evidencia as enum ('foto', 'video');

insert into public.parametros (clave, valor, descripcion) values
  ('max_evidencia_bytes', 10485760, 'Máximo por foto o video en bytes (propuesta P-18)'),
  ('max_evidencias_por_reporte', 3, 'Máximo de evidencias por reporte (propuesta P-18)');

create table public.evidencias (
  id uuid primary key default gen_random_uuid(),
  reporte_id uuid not null references public.reportes (id) on delete cascade,
  ruta_storage text not null unique,
  tipo public.tipo_evidencia not null,
  creado_en timestamptz not null default now()
);
create index evidencias_reporte_idx on public.evidencias (reporte_id, creado_en);
alter table public.evidencias enable row level security;
revoke all on public.evidencias from public, anon, authenticated;
grant select on public.evidencias to anon, authenticated;

-- Función limitada a contestar si el JWT actual es autor de ese reporte.
create function public.es_autor_reporte(p_reporte_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.reportes r
    where r.id = p_reporte_id and r.perfil_id = (select auth.uid())
  )
$$;
revoke execute on function public.es_autor_reporte(uuid) from public, anon;
grant execute on function public.es_autor_reporte(uuid) to authenticated;

create policy evidencias_de_reportes_activos on public.evidencias
  for select to anon using (exists (
    select 1 from public.reportes r where r.id = reporte_id and r.estado = 'activo'
  ));
create policy evidencias_autorizadas on public.evidencias
  for select to authenticated using (
    public.es_autor_reporte(reporte_id) or exists (
      select 1 from public.reportes r where r.id = reporte_id and r.estado = 'activo'
    )
  );

-- SQL para crear el bucket; la configuración viaja en la migración a la nube.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'evidencias', 'evidencias', false, valor::bigint,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']::text[]
from public.parametros where clave = 'max_evidencia_bytes'
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Las rutas aceptadas son <reporte_uuid>/<archivo_uuid>.<extensión>.
create function public.puede_subir_evidencia(p_ruta text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_reporte_id uuid;
  v_max integer;
begin
  if (select auth.uid()) is null or p_ruta is null or p_ruta !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|mp4|webm)$' then
    return false;
  end if;
  v_reporte_id := split_part(p_ruta, '/', 1)::uuid;
  if not exists (
    select 1 from public.reportes r where r.id = v_reporte_id
      and r.perfil_id = (select auth.uid()) and r.estado in ('pendiente', 'activo')
  ) then
    return false;
  end if;
  v_max := public.param('max_evidencias_por_reporte')::integer;
  return (
    select count(*) < v_max from storage.objects o
    where o.bucket_id = 'evidencias' and o.name like v_reporte_id::text || '/%'
      and not o.is_delete_marker
  );
end $$;
revoke execute on function public.puede_subir_evidencia(text) from public, anon;
grant execute on function public.puede_subir_evidencia(text) to authenticated;

drop policy if exists evidencias_subir_autor on storage.objects;
create policy evidencias_subir_autor on storage.objects
  for insert to authenticated with check (
    bucket_id = 'evidencias'
    and owner_id = (select auth.uid()::text)
    and public.puede_subir_evidencia(name)
  );
drop policy if exists evidencias_leer_autorizados on storage.objects;
create policy evidencias_leer_autorizados on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'evidencias' and (
      owner_id = (select auth.uid()::text)
      or exists (select 1 from public.evidencias e where e.ruta_storage = name)
    )
  );
drop policy if exists evidencias_borrar_sin_registrar on storage.objects;
create policy evidencias_borrar_sin_registrar on storage.objects
  for delete to authenticated using (
    bucket_id = 'evidencias' and owner_id = (select auth.uid()::text)
    and not exists (select 1 from public.evidencias e where e.ruta_storage = name)
  );

create function public.agregar_evidencia(p_reporte_id uuid, p_ruta text, p_tipo text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_autor uuid;
  v_estado public.estado_reporte;
  v_objeto storage.objects%rowtype;
  v_ext text;
  v_mime text;
  v_id uuid;
  v_tipo_actual public.tipo_evidencia;
begin
  if v_uid is null then raise exception 'sin_sesion'; end if;
  if p_reporte_id is null or p_ruta is null or p_tipo is null
    or p_tipo not in ('foto', 'video')
    or p_ruta !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|mp4|webm)$'
    or split_part(p_ruta, '/', 1) <> p_reporte_id::text then
    raise exception 'parametros_invalidos';
  end if;

  select perfil_id, estado into v_autor, v_estado from public.reportes
    where id = p_reporte_id for update;
  if not found then raise exception 'reporte_no_existe'; end if;
  if v_autor <> v_uid then raise exception 'reporte_no_autorizado'; end if;
  if v_estado not in ('pendiente', 'activo') then raise exception 'reporte_no_activo'; end if;

  select id, tipo into v_id, v_tipo_actual from public.evidencias
    where ruta_storage = p_ruta;
  if found then
    if v_tipo_actual::text <> p_tipo then raise exception 'tipo_archivo_invalido'; end if;
    return v_id;
  end if;

  select * into v_objeto from storage.objects
    where bucket_id = 'evidencias' and name = p_ruta and not is_delete_marker;
  if not found or v_objeto.owner_id is distinct from v_uid::text then
    raise exception 'archivo_no_existe';
  end if;
  v_ext := substring(p_ruta from '\.([a-z]+)$');
  v_mime := coalesce(v_objeto.metadata ->> 'mimetype', '');
  if not (
    (p_tipo = 'foto' and ((v_ext in ('jpg', 'jpeg') and v_mime = 'image/jpeg')
      or (v_ext = 'png' and v_mime = 'image/png')
      or (v_ext = 'webp' and v_mime = 'image/webp')))
    or (p_tipo = 'video' and ((v_ext = 'mp4' and v_mime = 'video/mp4')
      or (v_ext = 'webm' and v_mime = 'video/webm')))
  ) then raise exception 'tipo_archivo_invalido'; end if;
  if coalesce(v_objeto.metadata ->> 'size', '') !~ '^[0-9]{1,15}$'
    or (v_objeto.metadata ->> 'size')::bigint > public.param('max_evidencia_bytes') then
    raise exception 'archivo_invalido';
  end if;
  if (select count(*) from public.evidencias where reporte_id = p_reporte_id)
    >= public.param('max_evidencias_por_reporte') then
    raise exception 'limite_evidencias';
  end if;

  insert into public.evidencias (reporte_id, ruta_storage, tipo)
    values (p_reporte_id, p_ruta, p_tipo::public.tipo_evidencia) returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.agregar_evidencia(uuid, text, text) from public, anon;
grant execute on function public.agregar_evidencia(uuid, text, text) to authenticated;
