-- =============================================================================
-- M1 Reportes (F2-T1, F3-T2): crear_reporte y reportes_activos_en_area.
-- Ver docs/REGLAS_NEGOCIO.md §2 y docs/API.md "Reportar" / "Mapa".
-- =============================================================================

-- -----------------------------------------------------------------------------
-- crear_reporte: alta idempotente por p_id (lo genera el front).
-- Orden de reglas: sin_sesion -> id existente -> fuera_de_zmg -> limite_por_hora
-- -> duplicado_cercano -> insert -> releer estado (un trigger puede activarlo).
-- -----------------------------------------------------------------------------
create function public.crear_reporte(
  p_id           uuid,
  p_tipo         public.tipo_reporte,
  p_pasan_carros boolean,
  p_lat          double precision,
  p_lng          double precision,
  p_precision_m  integer default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid       uuid := (select auth.uid());
  v_dueno     uuid;
  v_estado    public.estado_reporte;
  v_punto     extensions.geography;
  v_insertado uuid;
begin
  if v_uid is null then
    raise exception 'sin_sesion';
  end if;

  -- Serializa las altas de un mismo usuario: el límite por hora y el duplicado no se brincan
  -- con llamadas simultáneas.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('crear_reporte:' || v_uid::text));

  -- Idempotencia: el mismo id del mismo usuario devuelve lo que ya existe.
  select r.perfil_id, r.estado into v_dueno, v_estado from public.reportes r where r.id = p_id;
  if found then
    if v_dueno = v_uid then
      return pg_catalog.jsonb_build_object('id', p_id, 'estado', v_estado);
    end if;
    raise exception 'id_en_uso';
  end if;

  -- Coordenadas fuera de rango (p. ej. lat/lng invertidos) se tratan como fuera de la ZMG
  -- antes de construir la geografía.
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180
     or not public.dentro_de_zmg(p_lat, p_lng) then
    raise exception 'fuera_de_zmg';
  end if;

  if (select count(*) from public.reportes r
      where r.perfil_id = v_uid and r.creado_en > now() - interval '1 hour')
     >= public.param('max_reportes_por_hora') then
    raise exception 'limite_por_hora';
  end if;

  v_punto := public.punto(p_lat, p_lng);

  if exists (
    select 1 from public.reportes r
    where r.perfil_id = v_uid
      and r.estado in ('pendiente', 'activo')
      and extensions.st_dwithin(r.ubicacion, v_punto, public.param('radio_agrupacion_m')::double precision)
  ) then
    raise exception 'duplicado_cercano';
  end if;

  insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, precision_m, estado, creado_en)
  values (p_id, v_uid, p_tipo, p_pasan_carros, v_punto, p_precision_m, 'pendiente', now())
  on conflict (id) do nothing
  returning id into v_insertado;

  if v_insertado is null then
    -- Otro usuario ganó la carrera con el mismo id.
    raise exception 'id_en_uso';
  end if;

  -- Releer: un trigger (M2) puede haberlo activado al insertarse.
  select r.estado into v_estado from public.reportes r where r.id = p_id;
  return pg_catalog.jsonb_build_object('id', p_id, 'estado', v_estado);
end $$;

-- Postgres da EXECUTE a PUBLIC por defecto en todas las funciones; el `alter default privileges
-- in schema public` de la base no lo quita (los defaults por schema solo suman). Se revoca explícito.
revoke execute on function public.crear_reporte(uuid, public.tipo_reporte, boolean, double precision, double precision, integer)
  from public, anon;
grant execute on function public.crear_reporte(uuid, public.tipo_reporte, boolean, double precision, double precision, integer)
  to authenticated;

-- -----------------------------------------------------------------------------
-- reportes_activos_en_area: reportes activos dentro de un rectángulo, sin autor.
-- -----------------------------------------------------------------------------
create function public.reportes_activos_en_area(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision
) returns table (
  id                  uuid,
  tipo                public.tipo_reporte,
  pasan_carros        boolean,
  lat                 double precision,
  lng                 double precision,
  ultima_confirmacion timestamptz,
  creado_en           timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_area extensions.geography;
begin
  v_area := extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::extensions.geography;

  if extensions.st_area(v_area) / 1000000.0 > public.param('area_max_consulta_km2') then
    raise exception 'area_demasiado_grande';
  end if;

  return query
    select r.id, r.tipo, r.pasan_carros,
           extensions.st_y(r.ubicacion::extensions.geometry),
           extensions.st_x(r.ubicacion::extensions.geometry),
           r.ultima_confirmacion, r.creado_en
    from public.reportes r
    where r.estado = 'activo'
      and extensions.st_intersects(r.ubicacion, v_area)
    order by (r.tipo = 'persona_en_riesgo') desc, r.creado_en desc;
end $$;

revoke execute on function public.reportes_activos_en_area(double precision, double precision, double precision, double precision)
  from public;
grant execute on function public.reportes_activos_en_area(double precision, double precision, double precision, double precision)
  to anon, authenticated;
