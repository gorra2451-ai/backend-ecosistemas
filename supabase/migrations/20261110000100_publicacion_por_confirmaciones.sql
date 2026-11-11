-- =============================================================================
-- D-021 (2/4): contrato v2 validado por los equipos (mid-fi, 2026-11-10).
-- - gravedad del reporte (bloqueado | limitado | sin_riesgo) y crear_reporte(p_gravedad).
-- - Publicación por confirmaciones: pendiente -> activo con confirmaciones_para_publicar "sí"
--   de otras personas. Se retira la activación por N reportes cercanos (umbral_activacion,
--   P-01) y "nace activo junto a un activo" (P-15). persona_en_riesgo sigue naciendo activo.
-- - Niveles por confirmaciones "sí" (bajo 5–9 · medio 10–14 · alto 15–19 · critico ≥ 20).
-- - reportes_cercanos / reportes_activos_en_area / zonas_publicas con gravedad y nivel.
-- - mis_reportes().
-- Ver docs/REGLAS_NEGOCIO.md y docs/API.md (contrato v2).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Gravedad
-- -----------------------------------------------------------------------------
create type public.gravedad_reporte as enum ('bloqueado', 'limitado', 'sin_riesgo');
alter table public.reportes add column gravedad public.gravedad_reporte;
grant select (gravedad) on public.reportes to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Parámetros
-- -----------------------------------------------------------------------------
insert into public.parametros (clave, valor, descripcion) values
  ('confirmaciones_para_publicar', 5,
   'Confirmaciones "si" de otras personas para que un reporte pendiente pase a activo (D-021)'),
  ('nivel_bajo_min', 5, 'Confirmaciones "si" para nivel bajo (D-021)'),
  ('nivel_critico_min', 20, 'Confirmaciones "si" para nivel critico (D-021)');
update public.parametros set valor = 10, actualizado_en = now(),
       descripcion = 'Confirmaciones "si" para nivel medio (D-021)'
 where clave = 'nivel_medio_min';
update public.parametros set valor = 15, actualizado_en = now(),
       descripcion = 'Confirmaciones "si" para nivel alto (D-021)'
 where clave = 'nivel_alto_min';
update public.parametros set actualizado_en = now(),
       descripcion = 'OBSOLETO (D-021): ya no se usa; un reporte se publica con confirmaciones_para_publicar. '
                     'Antes: reportes cercanos que activaban una alerta'
 where clave = 'umbral_activacion';
update public.parametros set actualizado_en = now(),
       descripcion = 'Minutos para juntar confirmaciones_para_publicar; si no, pendiente -> resuelto'
 where clave = 'ventana_activacion_min';
update public.parametros set actualizado_en = now(),
       descripcion = 'Radio en metros para duplicados del mismo usuario y para agrupar persona_en_riesgo'
 where clave = 'radio_agrupacion_m';

-- -----------------------------------------------------------------------------
-- Activación. Se evalúa al insertar (trigger existente) y tras cada "sí" (confirmar_reporte).
-- -----------------------------------------------------------------------------
create or replace function public.evaluar_activacion(p_reporte_id uuid) returns public.estado_reporte
language plpgsql security definer set search_path = '' as $$
declare
  r       public.reportes%rowtype;
  v_tipo  public.tipo_reporte;
  v_radio double precision := public.param('radio_agrupacion_m');
  v_desde timestamptz := now() - make_interval(mins => public.param('ventana_activacion_min')::int);
  v_g     extensions.geometry;
  v_llave bigint;
begin
  select tipo, extensions.st_transform(ubicacion::extensions.geometry, 32613) into v_tipo, v_g
    from public.reportes where id = p_reporte_id;
  -- persona_en_riesgo agrupa vecinos: serializa por celdas antes de bloquear filas (igual que v1).
  if v_tipo = 'persona_en_riesgo' and v_g is not null then
    for v_llave in
      select hashtextextended(format('activacion:%s:%s',
               floor(extensions.st_x(v_g) / greatest(v_radio, 1)) + dx,
               floor(extensions.st_y(v_g) / greatest(v_radio, 1)) + dy), 0)
      from generate_series(-1, 1) dx, generate_series(-1, 1) dy
      order by 1
    loop
      perform pg_advisory_xact_lock(v_llave);
    end loop;
  end if;
  select * into r from public.reportes where id = p_reporte_id for update;
  if not found or r.estado <> 'pendiente' then
    return r.estado;
  end if;

  -- 1) persona_en_riesgo: se publica con su propio reporte (umbral_persona_en_riesgo = 1).
  if r.tipo = 'persona_en_riesgo' and (
       select count(*) from public.reportes o
       where o.tipo = 'persona_en_riesgo'
         and o.estado in ('pendiente', 'activo')
         and o.creado_en >= v_desde
         and extensions.st_dwithin(o.ubicacion, r.ubicacion, v_radio)
     ) >= public.param('umbral_persona_en_riesgo') then
    update public.reportes o
       set estado = 'activo', activado_en = now(), ultima_confirmacion = now()
     where o.tipo = 'persona_en_riesgo'
       and o.estado = 'pendiente'
       and o.creado_en >= v_desde
       and extensions.st_dwithin(o.ubicacion, r.ubicacion, v_radio);
    return 'activo';
  end if;

  -- 2) Confirmaciones "sí" de otras personas (el autor nunca cuenta).
  if (
       select count(*) from public.confirmaciones c
       where c.reporte_id = r.id and c.sigue and c.perfil_id <> r.perfil_id
     ) >= public.param('confirmaciones_para_publicar') then
    update public.reportes
       set estado = 'activo', activado_en = now(), ultima_confirmacion = clock_timestamp()
     where id = r.id;
    return 'activo';
  end if;

  return 'pendiente';
end $$;

-- Se puede confirmar (o marcar falso) un pendiente: así junta las confirmaciones para publicarse.
create or replace function public.validar_confirmable(p_reporte_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.reportes%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'sin_sesion';
  end if;
  select * into r from public.reportes where id = p_reporte_id for update;
  if not found then
    raise exception 'reporte_no_existe';
  end if;
  if r.perfil_id = (select auth.uid()) then
    raise exception 'propio_reporte';
  end if;
  if r.estado not in ('pendiente', 'activo') then
    raise exception 'reporte_no_activo';
  end if;
end $$;

create or replace function public.confirmar_reporte(p_reporte_id uuid, p_sigue boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_estado public.estado_reporte;
begin
  if p_sigue is null then
    raise exception 'parametros_invalidos';
  end if;
  perform public.validar_confirmable(p_reporte_id);

  insert into public.confirmaciones as c (reporte_id, perfil_id, sigue)
  values (p_reporte_id, (select auth.uid()), p_sigue)
  on conflict (reporte_id, perfil_id) do update
    set sigue = excluded.sigue,
        falso = case when excluded.sigue then false else c.falso end;

  if p_sigue then
    -- clock_timestamp(): hora real tras esperar el lock (now() es el inicio de la transacción).
    update public.reportes set ultima_confirmacion = clock_timestamp()
     where id = p_reporte_id
    returning estado into v_estado;
    if v_estado = 'pendiente' then
      v_estado := public.evaluar_activacion(p_reporte_id);
    end if;
  else
    v_estado := public.aplicar_votos_no(p_reporte_id);
  end if;

  return jsonb_build_object('reporte_id', p_reporte_id, 'estado', v_estado);
end $$;

-- -----------------------------------------------------------------------------
-- crear_reporte(p_gravedad). Cambia la firma: drop + create con los mismos grants.
-- -----------------------------------------------------------------------------
drop function public.crear_reporte(uuid, public.tipo_reporte, boolean, double precision, double precision, integer);

create function public.crear_reporte(
  p_id           uuid,
  p_tipo         public.tipo_reporte,
  p_pasan_carros boolean,
  p_lat          double precision,
  p_lng          double precision,
  p_precision_m  integer default null,
  p_gravedad     public.gravedad_reporte default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid       uuid := (select auth.uid());
  -- Con gravedad, pasan_carros se deduce: bloqueado -> no pasan; limitado/sin_riesgo -> pasan.
  v_pasan     boolean := case when p_gravedad is null then p_pasan_carros
                              else p_gravedad <> 'bloqueado' end;
  v_dueno     uuid;
  v_estado    public.estado_reporte;
  v_punto     extensions.geography;
  v_insertado uuid;
begin
  if v_uid is null then
    raise exception 'sin_sesion';
  end if;
  if p_id is null or p_tipo is null or v_pasan is null
     or (p_precision_m is not null and p_precision_m < 0) then
    raise exception 'parametros_invalidos';
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
      and r.estado in ('pendiente', 'activo', 'en_revision')
      and extensions.st_dwithin(r.ubicacion, v_punto, public.param('radio_agrupacion_m')::double precision)
  ) then
    raise exception 'duplicado_cercano';
  end if;

  insert into public.reportes (id, perfil_id, tipo, pasan_carros, gravedad, ubicacion, precision_m, estado, creado_en)
  values (p_id, v_uid, p_tipo, v_pasan, p_gravedad, v_punto, p_precision_m, 'pendiente', now())
  on conflict (id) do nothing
  returning id into v_insertado;

  if v_insertado is null then
    raise exception 'id_en_uso';
  end if;

  -- Releer: el trigger de activación publica persona_en_riesgo al insertarse.
  select r.estado into v_estado from public.reportes r where r.id = p_id;
  return pg_catalog.jsonb_build_object('id', p_id, 'estado', v_estado);
end $$;

revoke execute on function public.crear_reporte(uuid, public.tipo_reporte, boolean, double precision,
  double precision, integer, public.gravedad_reporte) from public, anon;
grant execute on function public.crear_reporte(uuid, public.tipo_reporte, boolean, double precision,
  double precision, integer, public.gravedad_reporte) to authenticated;

-- -----------------------------------------------------------------------------
-- Niveles por confirmaciones "sí". nivel_para cambia de significado: drop + create.
-- persona_en_riesgo activa con < nivel_alto_min confirmaciones = alto (D-021).
-- Devuelve null por debajo de nivel_bajo_min (un pendiente todavía no tiene nivel).
-- -----------------------------------------------------------------------------
drop view public.zonas_publicas;
drop function public.nivel_para(integer, boolean);

create function public.nivel_para(p_confirmaciones integer, p_persona_en_riesgo boolean)
returns public.nivel_zona
language sql stable set search_path = '' as $$
  select case
    when coalesce(p_confirmaciones, 0) >= public.param('nivel_critico_min') then 'critico'::public.nivel_zona
    when coalesce(p_confirmaciones, 0) >= public.param('nivel_alto_min')    then 'alto'::public.nivel_zona
    when coalesce(p_persona_en_riesgo, false)                                then 'alto'::public.nivel_zona
    when coalesce(p_confirmaciones, 0) >= public.param('nivel_medio_min')   then 'medio'::public.nivel_zona
    when coalesce(p_confirmaciones, 0) >= public.param('nivel_bajo_min')    then 'bajo'::public.nivel_zona
    else null
  end
$$;
revoke execute on function public.nivel_para(integer, boolean) from public;
grant execute on function public.nivel_para(integer, boolean) to anon, authenticated;

-- Nivel de un reporte: un activo siempre tiene nivel (mínimo bajo); el resto, el que den sus "sí".
-- Uso interno de las RPC (sin grant).
create function public.nivel_reporte(p_confirmaciones integer, p_tipo public.tipo_reporte,
  p_estado public.estado_reporte)
returns public.nivel_zona
language sql stable set search_path = '' as $$
  select case when p_estado = 'activo'
    then coalesce(public.nivel_para(p_confirmaciones, p_tipo = 'persona_en_riesgo'), 'bajo'::public.nivel_zona)
    else public.nivel_para(p_confirmaciones, p_tipo = 'persona_en_riesgo')
  end
$$;
revoke execute on function public.nivel_reporte(integer, public.tipo_reporte, public.estado_reporte)
  from public, anon, authenticated;

-- Zonas: suma de "sí" de los reportes activos de la celda. security_invoker (no toca perfil_id).
create view public.zonas_publicas with (security_invoker = true) as
with cfg as (
  select public.param('tamano_celda_m')::double precision as tam
),
activos as (
  select r.id,
         r.pasan_carros,
         r.tipo = 'persona_en_riesgo' as persona,
         coalesce(r.ultima_confirmacion, r.activado_en, r.creado_en) as momento,
         floor(extensions.st_x(u.g) / cfg.tam)::bigint as ix,
         floor(extensions.st_y(u.g) / cfg.tam)::bigint as iy,
         cfg.tam
  from public.reportes r
  cross join cfg
  cross join lateral (
    select extensions.st_transform(r.ubicacion::extensions.geometry, 32613) as g
  ) u
  where r.estado = 'activo'
),
sies as (
  select c.reporte_id, count(*) filter (where c.sigue) as n
  from public.confirmaciones c
  where c.reporte_id in (select id from activos)
  group by c.reporte_id
),
celdas as (
  select a.ix, a.iy, a.tam,
         count(*)::integer                     as total_reportes,
         coalesce(sum(s.n), 0)::integer        as total_confirmaciones,
         bool_or(not a.pasan_carros)           as alguno_no_pasan_carros,
         bool_or(a.persona)                    as hay_persona,
         max(a.momento)                        as actualizado_en
  from activos a
  left join sies s on s.reporte_id = a.id
  group by a.ix, a.iy, a.tam
)
select c.ix || '_' || c.iy                                              as celda,
       extensions.st_y(ctr.p)                                           as lat,
       extensions.st_x(ctr.p)                                           as lng,
       c.total_reportes,
       c.total_confirmaciones,
       coalesce(public.nivel_para(c.total_confirmaciones, c.hay_persona),
                'bajo'::public.nivel_zona)                              as nivel,
       c.alguno_no_pasan_carros,
       c.actualizado_en
from celdas c
cross join lateral (
  select extensions.st_transform(
           extensions.st_setsrid(
             extensions.st_makepoint((c.ix + 0.5) * c.tam, (c.iy + 0.5) * c.tam), 32613),
           4326) as p
) ctr;

grant select on public.zonas_publicas to anon, authenticated;

-- -----------------------------------------------------------------------------
-- reportes_cercanos: pendientes y activos (para poder confirmarlos). Sin perfil_id.
-- -----------------------------------------------------------------------------
drop function public.reportes_cercanos(double precision, double precision, integer);

create function public.reportes_cercanos(p_lat double precision, p_lng double precision, p_radio_m integer)
returns table (
  id                  uuid,
  tipo                public.tipo_reporte,
  gravedad            public.gravedad_reporte,
  pasan_carros        boolean,
  lat                 double precision,
  lng                 double precision,
  distancia_m         double precision,
  ultima_confirmacion timestamptz,
  creado_en           timestamptz,
  confirmaciones_si   integer,
  nivel               public.nivel_zona,
  estado              public.estado_reporte,
  es_propio           boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_centro extensions.geography := public.punto(p_lat, p_lng);
  v_radio  double precision := greatest(0, least(coalesce(p_radio_m, 0), public.param('radio_cercanos_max_m')));
begin
  if (select auth.uid()) is null then
    raise exception 'sin_sesion';
  end if;
  return query
    select r.id, r.tipo, r.gravedad, r.pasan_carros,
           extensions.st_y(r.ubicacion::extensions.geometry),
           extensions.st_x(r.ubicacion::extensions.geometry),
           extensions.st_distance(r.ubicacion, v_centro),
           r.ultima_confirmacion,
           r.creado_en,
           k.si,
           public.nivel_reporte(k.si, r.tipo, r.estado),
           r.estado,
           r.perfil_id = (select auth.uid())
      from public.reportes r
     cross join lateral (
       select count(*)::integer as si from public.confirmaciones c
        where c.reporte_id = r.id and c.sigue
     ) k
     where r.estado in ('pendiente', 'activo')
       and extensions.st_dwithin(r.ubicacion, v_centro, v_radio)
     order by extensions.st_distance(r.ubicacion, v_centro);
end $$;
revoke execute on function public.reportes_cercanos(double precision, double precision, integer) from public, anon;
grant execute on function public.reportes_cercanos(double precision, double precision, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- reportes_activos_en_area: + gravedad, confirmaciones_si, nivel (al final). Sin perfil_id.
-- -----------------------------------------------------------------------------
drop function public.reportes_activos_en_area(double precision, double precision, double precision, double precision);

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
  creado_en           timestamptz,
  gravedad            public.gravedad_reporte,
  confirmaciones_si   integer,
  nivel               public.nivel_zona
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_area extensions.geography;
begin
  if min_lat is null or min_lng is null or max_lat is null or max_lng is null
     or min_lat not between -90 and 90 or max_lat not between -90 and 90
     or min_lng not between -180 and 180 or max_lng not between -180 and 180
     or min_lat >= max_lat or min_lng >= max_lng then
    raise exception 'parametros_invalidos';
  end if;
  if max_lng - min_lng >= 180 then
    raise exception 'area_demasiado_grande';
  end if;
  v_area := extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::extensions.geography;

  if extensions.st_area(v_area) / 1000000.0 > public.param('area_max_consulta_km2') then
    raise exception 'area_demasiado_grande';
  end if;

  return query
    select r.id, r.tipo, r.pasan_carros,
           extensions.st_y(r.ubicacion::extensions.geometry),
           extensions.st_x(r.ubicacion::extensions.geometry),
           r.ultima_confirmacion, r.creado_en,
           r.gravedad, k.si, public.nivel_reporte(k.si, r.tipo, r.estado)
    from public.reportes r
    cross join lateral (
      select count(*)::integer as si from public.confirmaciones c
       where c.reporte_id = r.id and c.sigue
    ) k
    where r.estado = 'activo'
      and extensions.st_intersects(r.ubicacion, v_area)
    order by (r.tipo = 'persona_en_riesgo') desc, r.creado_en desc;
end $$;
revoke execute on function public.reportes_activos_en_area(double precision, double precision, double precision, double precision)
  from public;
grant execute on function public.reportes_activos_en_area(double precision, double precision, double precision, double precision)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- mis_reportes: los últimos 20 reportes del usuario con sesión. Sin perfil_id.
-- confirmaciones_no no incluye las marcas de falso (se cuentan aparte en marcas_falso).
-- -----------------------------------------------------------------------------
create function public.mis_reportes()
returns table (
  id                  uuid,
  tipo                public.tipo_reporte,
  gravedad            public.gravedad_reporte,
  estado              public.estado_reporte,
  confirmaciones_si   integer,
  confirmaciones_no   integer,
  marcas_falso        integer,
  nivel               public.nivel_zona,
  lat                 double precision,
  lng                 double precision,
  creado_en           timestamptz,
  ultima_confirmacion timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'sin_sesion';
  end if;
  return query
    select r.id, r.tipo, r.gravedad, r.estado,
           k.si, k.nos, k.falsos,
           public.nivel_reporte(k.si, r.tipo, r.estado),
           extensions.st_y(r.ubicacion::extensions.geometry),
           extensions.st_x(r.ubicacion::extensions.geometry),
           r.creado_en, r.ultima_confirmacion
      from public.reportes r
     cross join lateral (
       select count(*) filter (where c.sigue)::integer                   as si,
              count(*) filter (where not c.sigue and not c.falso)::integer as nos,
              count(*) filter (where c.falso)::integer                   as falsos
         from public.confirmaciones c
        where c.reporte_id = r.id
     ) k
     where r.perfil_id = v_uid
     order by r.creado_en desc, r.id
     limit 20;
end $$;
revoke execute on function public.mis_reportes() from public, anon;
grant execute on function public.mis_reportes() to authenticated;
