-- =============================================================================
-- PR #14 (revisión, bug B). TEMPORAL hasta tener limpieza de metadatos (GPS) en videos:
-- a las fotos el front las re-codifica sin EXIF; a los videos no, y una evidencia registrada se
-- puede descargar sin sesión. Para el mid-fi se deshabilita el video:
-- - El bucket evidencias solo acepta image/jpeg, image/png e image/webp.
-- - agregar_evidencia rechaza un video (p_tipo 'video' con .mp4/.webm/.mov y su MIME) con
--   video_deshabilitado. Las combinaciones incoherentes siguen dando tipo_archivo_invalido.
-- Para reactivar video: nueva migración que regrese los MIME de video y quite el rechazo.
-- puede_subir_evidencia no cambia: con el bucket sin MIME de video, un .mov/.mp4 no se puede
-- registrar ni queda legible para otros (la lectura pública exige estar registrado).
-- Grants sin cambios: create or replace conserva los de 20261026215220.
-- =============================================================================
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
 where id = 'evidencias';

create or replace function public.agregar_evidencia(p_reporte_id uuid, p_ruta text, p_tipo text)
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
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|mp4|webm|mov)$'
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
  -- [a-z0-9]: antes '[a-z]+' no capturaba 'mp4' (lleva dígito) y lo daba por tipo inválido.
  v_ext := substring(p_ruta from '\.([a-z0-9]+)$');
  v_mime := coalesce(v_objeto.metadata ->> 'mimetype', '');
  -- TEMPORAL: un video válido (extensión y MIME de video) se rechaza con video_deshabilitado.
  if p_tipo = 'video' and ((v_ext = 'mp4' and v_mime = 'video/mp4')
      or (v_ext = 'webm' and v_mime = 'video/webm')
      or (v_ext = 'mov' and v_mime = 'video/quicktime')) then
    raise exception 'video_deshabilitado';
  end if;
  -- Solo fotos; cualquier otra combinación sigue siendo tipo_archivo_invalido.
  if not (p_tipo = 'foto' and ((v_ext in ('jpg', 'jpeg') and v_mime = 'image/jpeg')
      or (v_ext = 'png' and v_mime = 'image/png')
      or (v_ext = 'webp' and v_mime = 'image/webp')))
  then raise exception 'tipo_archivo_invalido'; end if;
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
