-- =============================================================================
-- D-021 (3/4): casos nuevos de derivación, video .mov y moto en registro.
-- Misma firma en las tres funciones: create or replace conserva los grants.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- derivar: pasos generales para calle, arbol_caido y riesgo_electrico.
-- 911 = número nacional de emergencias. 071 de CFE: POR CONFIRMAR fuente oficial (PREGUNTAS P-34).
-- -----------------------------------------------------------------------------
create or replace function public.derivar(
  p_caso public.tipo_caso, p_municipio text,
  p_lat double precision, p_lng double precision
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_municipio text := lower(trim(p_municipio));
  v_punto extensions.geography;
  v_instituciones jsonb;
  v_refugios jsonb;
  v_pasos jsonb;
begin
  if p_caso is null or p_municipio is null or length(v_municipio) not between 2 and 100
    or p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90
    or p_lng < -180 or p_lng > 180 then
    raise exception 'parametros_invalidos';
  end if;
  v_punto := public.punto(p_lat, p_lng);
  select coalesce(jsonb_agg(to_jsonb(i) order by i.nombre), '[]'::jsonb)
    into v_instituciones
    from public.instituciones_publicas i
    where lower(trim(i.municipio)) = v_municipio
      and p_caso = any(i.tipos_caso);
  select coalesce(jsonb_agg(to_jsonb(r) order by r.distancia_m), '[]'::jsonb)
    into v_refugios from (
      select id, nombre, direccion, municipio, capacidad, fuente, verificado_en,
        extensions.st_y(ubicacion::extensions.geometry) as lat,
        extensions.st_x(ubicacion::extensions.geometry) as lng,
        round(extensions.st_distance(ubicacion, v_punto))::integer as distancia_m
      from public.refugios
      where verificado_en is not null and verificado_en <= now()
        and extensions.st_dwithin(ubicacion, v_punto,
          public.param('radio_refugios_derivacion_m'))
      order by extensions.st_distance(ubicacion, v_punto), id
      limit public.param('max_refugios_derivacion')::integer
    ) r;
  v_pasos := case p_caso::text
    when 'persona_herida' then jsonb_build_array(
      'Aléjate del agua y ubícate en un lugar seguro.',
      'Solicita ayuda a los servicios de emergencia de tu localidad.')
    when 'riesgo_electrico' then jsonb_build_array(
      'Aléjate al menos 10 m de cables caídos, postes o transformadores.',
      'No toques el agua cercana: puede estar electrificada.',
      'Reporta a CFE al 071 o al 911 si hay peligro inmediato.')
    when 'arbol_caido' then jsonb_build_array(
      'No muevas el árbol ni las ramas si tienen cables enredados.',
      'Avisa a Protección Civil llamando al 911.')
    when 'calle' then jsonb_build_array(
      'No cruces si el agua cubre la banqueta o te pasa de la rodilla.',
      'Busca otra ruta y consulta el mapa antes de avanzar.')
    else jsonb_build_array(
      'Aléjate del agua y ubícate en un lugar seguro.',
      'Consulta los contactos verificados disponibles para tu caso y municipio.')
  end;
  return jsonb_build_object('instituciones', v_instituciones,
    'refugios', v_refugios, 'pasos', v_pasos);
end $$;

-- -----------------------------------------------------------------------------
-- Evidencias: .mov (video/quicktime), típico de iPhone.
-- -----------------------------------------------------------------------------
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp',
                                  'video/mp4', 'video/webm', 'video/quicktime']::text[]
 where id = 'evidencias';

create or replace function public.puede_subir_evidencia(p_ruta text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_reporte_id uuid;
begin
  if (select auth.uid()) is null or p_ruta is null or p_ruta !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|mp4|webm|mov)$'
    then return false; end if;
  v_reporte_id := split_part(p_ruta, '/', 1)::uuid;
  perform 1 from public.reportes where id = v_reporte_id
    and perfil_id = (select auth.uid()) and estado in ('pendiente', 'activo') for update;
  if not found then return false; end if;
  return (select count(*) < public.param('max_evidencias_por_reporte')
    from storage.objects o where o.bucket_id = 'evidencias'
      and o.name like v_reporte_id::text || '/%' and not o.is_delete_marker);
end $$;

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
  v_ext := substring(p_ruta from '\.([a-z]+)$');
  v_mime := coalesce(v_objeto.metadata ->> 'mimetype', '');
  if not (
    (p_tipo = 'foto' and ((v_ext in ('jpg', 'jpeg') and v_mime = 'image/jpeg')
      or (v_ext = 'png' and v_mime = 'image/png')
      or (v_ext = 'webp' and v_mime = 'image/webp')))
    or (p_tipo = 'video' and ((v_ext = 'mp4' and v_mime = 'video/mp4')
      or (v_ext = 'webm' and v_mime = 'video/webm')
      or (v_ext = 'mov' and v_mime = 'video/quicktime')))
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

-- -----------------------------------------------------------------------------
-- registrar_entrada: acepta moto (P-28).
-- -----------------------------------------------------------------------------
create or replace function public.registrar_entrada(medio text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'sin_sesion'; end if;
  if medio is null or medio not in ('peaton', 'bici', 'moto', 'auto', 'transporte_publico') then
    raise exception 'parametros_invalidos';
  end if;
  perform 1 from public.perfiles where id = v_uid for update;
  if not found then raise exception 'sin_perfil'; end if;
  if (select count(*) from public.entradas e
      where e.perfil_id = v_uid and e.creado_en > now() - interval '1 hour')
      >= public.param('max_entradas_por_hora') then
    raise exception 'limite_entradas';
  end if;
  insert into public.entradas (perfil_id, medio)
  values (v_uid, medio::public.medio_transporte);
end $$;
