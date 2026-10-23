-- =============================================================================
-- M2 (F2-T2, F2-T3): activación, confirmación, marcas de falso, reportes cercanos
-- y expiración. Ver docs/REGLAS_NEGOCIO.md §1, §3, §4, §8 y docs/API.md "Confirmar".
-- Todos los números salen de public.param().
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Activación: se evalúa al insertar un reporte pendiente.
-- -----------------------------------------------------------------------------
create function public.evaluar_activacion(p_reporte_id uuid) returns public.estado_reporte
language plpgsql security definer set search_path = '' as $$
declare
  r       public.reportes%rowtype;
  v_radio double precision := public.param('radio_agrupacion_m');
  v_desde timestamptz := now() - make_interval(mins => public.param('ventana_activacion_min')::int);
  v_g     extensions.geometry;
  v_llave bigint;
begin
  -- Serializa la activación SOLO entre reportes vecinos: sin esto, dos reportes simultáneos del mismo
  -- grupo no se ven entre sí (ninguno ha hecho commit) y pueden quedarse sin activar.
  -- Celdas de lado = radio en UTM 13N: dos reportes a <= radio caen en celdas iguales o contiguas, y
  -- cada uno bloquea su celda y las 8 vecinas (en orden, sin deadlocks). Reportes lejanos no se esperan.
  select extensions.st_transform(ubicacion::extensions.geometry, 32613) into v_g
    from public.reportes where id = p_reporte_id;
  if v_g is not null then
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

  -- 1) persona_en_riesgo: umbral propio, solo cuenta reportes del mismo tipo.
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

  -- 2) Junto a un activo: nace activo.
  if exists (
       select 1 from public.reportes o
       where o.estado = 'activo'
         and extensions.st_dwithin(o.ubicacion, r.ubicacion, v_radio)
     ) then
    update public.reportes
       set estado = 'activo', activado_en = now(), ultima_confirmacion = now()
     where id = r.id;
    return 'activo';
  end if;

  -- 3) Grupo: pendiente|activo a ≤ radio dentro de la ventana (incluido él).
  if (
       select count(*) from public.reportes o
       where o.estado in ('pendiente', 'activo')
         and o.creado_en >= v_desde
         and extensions.st_dwithin(o.ubicacion, r.ubicacion, v_radio)
     ) >= public.param('umbral_activacion') then
    update public.reportes o
       set estado = 'activo', activado_en = now(), ultima_confirmacion = now()
     where o.estado = 'pendiente'
       and o.creado_en >= v_desde
       and extensions.st_dwithin(o.ubicacion, r.ubicacion, v_radio);
    return 'activo';
  end if;

  return 'pendiente';
end $$;

create function public.reportes_activacion_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.evaluar_activacion(new.id);
  return null;
end $$;

create trigger reportes_activacion after insert on public.reportes
  for each row when (new.estado = 'pendiente')
  execute function public.reportes_activacion_trigger();

-- -----------------------------------------------------------------------------
-- Regla de "no": cuentan los sigue=false registrados después del último "sí".
-- Uso interno (sin grant). Devuelve el estado resultante.
-- -----------------------------------------------------------------------------
create function public.aplicar_votos_no(p_reporte_id uuid) returns public.estado_reporte
language plpgsql security definer set search_path = '' as $$
declare
  r public.reportes%rowtype;
begin
  select * into r from public.reportes where id = p_reporte_id;
  if r.estado = 'activo' and (
       select count(*) from public.confirmaciones c
       where c.reporte_id = r.id
         and not c.sigue
         and c.actualizado_en > coalesce(r.ultima_confirmacion, r.activado_en, '-infinity'::timestamptz)
     ) >= public.param('votos_no_para_resolver') then
    update public.reportes set estado = 'resuelto', resuelto_en = now() where id = r.id;
    return 'resuelto';
  end if;
  return r.estado;
end $$;

-- Validación común de confirmar_reporte / marcar_falso. Bloquea la fila del reporte.
create function public.validar_confirmable(p_reporte_id uuid) returns void
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
  if r.estado <> 'activo' then
    raise exception 'reporte_no_activo';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- confirmar_reporte
-- -----------------------------------------------------------------------------
create function public.confirmar_reporte(p_reporte_id uuid, p_sigue boolean) returns jsonb
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
    update public.reportes set ultima_confirmacion = clock_timestamp() where id = p_reporte_id;
    v_estado := 'activo';
  else
    v_estado := public.aplicar_votos_no(p_reporte_id);
  end if;

  return jsonb_build_object('reporte_id', p_reporte_id, 'estado', v_estado);
end $$;
grant execute on function public.confirmar_reporte(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- marcar_falso = "no" + falso=true
-- -----------------------------------------------------------------------------
create function public.marcar_falso(p_reporte_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_estado public.estado_reporte;
begin
  perform public.validar_confirmable(p_reporte_id);

  insert into public.confirmaciones (reporte_id, perfil_id, sigue, falso)
  values (p_reporte_id, (select auth.uid()), false, true)
  on conflict (reporte_id, perfil_id) do update set sigue = false, falso = true;

  if (select count(*) from public.confirmaciones where reporte_id = p_reporte_id and falso)
       >= public.param('banderas_para_revision') then
    update public.reportes set estado = 'en_revision' where id = p_reporte_id;
    v_estado := 'en_revision';
  else
    v_estado := public.aplicar_votos_no(p_reporte_id);
  end if;

  return jsonb_build_object('reporte_id', p_reporte_id, 'estado', v_estado);
end $$;
grant execute on function public.marcar_falso(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- reportes_cercanos: activos a ≤ radio (topado), por distancia. Sin perfil_id.
-- -----------------------------------------------------------------------------
create function public.reportes_cercanos(p_lat double precision, p_lng double precision, p_radio_m integer)
returns table (
  id uuid, tipo public.tipo_reporte, pasan_carros boolean, lat double precision, lng double precision,
  distancia_m double precision, ultima_confirmacion timestamptz, es_propio boolean
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
    select r.id, r.tipo, r.pasan_carros,
           extensions.st_y(r.ubicacion::extensions.geometry),
           extensions.st_x(r.ubicacion::extensions.geometry),
           extensions.st_distance(r.ubicacion, v_centro),
           r.ultima_confirmacion,
           r.perfil_id = (select auth.uid())
      from public.reportes r
     where r.estado = 'activo'
       and extensions.st_dwithin(r.ubicacion, v_centro, v_radio)
     order by extensions.st_distance(r.ubicacion, v_centro);
end $$;
grant execute on function public.reportes_cercanos(double precision, double precision, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Expiración (pg_cron cada 5 min). Sin grant a clientes.
-- -----------------------------------------------------------------------------
create function public.expirar_reportes() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_activos    integer;
  v_pendientes integer;
begin
  update public.reportes
     set estado = 'resuelto', resuelto_en = now()
   where estado = 'activo'
     and coalesce(ultima_confirmacion, activado_en, creado_en)
         < now() - make_interval(mins => public.param('minutos_expiracion')::int);
  get diagnostics v_activos = row_count;

  update public.reportes
     set estado = 'resuelto', resuelto_en = now()
   where estado = 'pendiente'
     and creado_en < now() - make_interval(mins => public.param('ventana_activacion_min')::int);
  get diagnostics v_pendientes = row_count;

  return v_activos + v_pendientes;
end $$;

select cron.schedule('expirar-reportes', '*/5 * * * *', 'select public.expirar_reportes()');

-- -----------------------------------------------------------------------------
-- Permisos. El "alter default privileges in schema public revoke execute ... from public" de la
-- base no quita el EXECUTE global de PUBLIC (los defaults por schema solo pueden sumar), así que
-- se revoca explícito. Los grants a clientes están junto a cada RPC expuesta.
-- -----------------------------------------------------------------------------
revoke execute on function
  public.evaluar_activacion(uuid),
  public.reportes_activacion_trigger(),
  public.aplicar_votos_no(uuid),
  public.validar_confirmable(uuid),
  public.confirmar_reporte(uuid, boolean),
  public.marcar_falso(uuid),
  public.reportes_cercanos(double precision, double precision, integer),
  public.expirar_reportes()
from public, anon;
revoke execute on function
  public.evaluar_activacion(uuid),
  public.reportes_activacion_trigger(),
  public.aplicar_votos_no(uuid),
  public.validar_confirmable(uuid),
  public.expirar_reportes()
from authenticated;
