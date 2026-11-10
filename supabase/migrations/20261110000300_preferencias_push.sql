-- =============================================================================
-- D-021 (4/4): preferencias de avisos push (Equipo 5).
-- - solo_cambios: se guarda; hoy el procesador ya solo avisa cambios de zona (activada/resuelta).
-- - solo_fuertes: solo clima `alto` y zonas `alto|critico`.
-- - silenciado_hasta: no se encola ni se entrega nada mientras esté vigente.
-- El encolado salta lo que no corresponde y tomar_avisos_push descarta (fallido) lo que ya estaba
-- en cola si la suscripción se silenció o pasó a solo_fuertes después.
-- =============================================================================

insert into public.parametros (clave, valor, descripcion) values
  ('max_minutos_silencio_push', 10080,
   'Máximo de minutos que se puede silenciar una suscripción push (7 días, propuesta D-021)');

alter table public.suscripciones_push
  add column solo_cambios boolean not null default false,
  add column solo_fuertes boolean not null default false,
  add column silenciado_hasta timestamptz;

-- Nivel de la zona al momento de encolar (para filtrar solo_fuertes también al reclamar).
alter table public.avisos_push add column nivel_zona public.nivel_zona;

-- -----------------------------------------------------------------------------
-- Nivel actual de una celda: igual que zonas_publicas. Uso interno (sin grant).
-- -----------------------------------------------------------------------------
create function public.nivel_de_celda(p_celda text) returns public.nivel_zona
language sql stable set search_path = '' as $$
  with activos as (
    select r.id, r.tipo from public.reportes r
     where r.estado = 'activo' and public.celda_mapa(r.ubicacion) = p_celda
  )
  select case when count(*) = 0 then null
    else coalesce(public.nivel_para(
           coalesce(sum((select count(*) from public.confirmaciones c
                          where c.reporte_id = a.id and c.sigue)), 0)::integer,
           bool_or(a.tipo = 'persona_en_riesgo')), 'bajo'::public.nivel_zona)
  end
  from activos a
$$;
revoke execute on function public.nivel_de_celda(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- preferencias_push: solo el dueño de la suscripción. null = no cambiar;
-- p_silenciar_min = 0 quita el silencio.
-- -----------------------------------------------------------------------------
create function public.preferencias_push(
  p_endpoint text, p_solo_cambios boolean, p_solo_fuertes boolean, p_silenciar_min integer
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := (select auth.uid());
  v_fila public.suscripciones_push%rowtype;
begin
  if v_uid is null then raise exception 'sin_sesion'; end if;
  if p_endpoint is null
     or (p_silenciar_min is not null and (p_silenciar_min < 0
         or p_silenciar_min > public.param('max_minutos_silencio_push'))) then
    raise exception 'parametros_invalidos';
  end if;
  update public.suscripciones_push s
     set solo_cambios = coalesce(p_solo_cambios, s.solo_cambios),
         solo_fuertes = coalesce(p_solo_fuertes, s.solo_fuertes),
         silenciado_hasta = case
           when p_silenciar_min is null then s.silenciado_hasta
           when p_silenciar_min = 0 then null
           else now() + p_silenciar_min * interval '1 minute' end
   where s.endpoint = p_endpoint and s.perfil_id = v_uid
  returning s.* into v_fila;
  -- Mismo error para "no existe" y "es de otro": no revela suscripciones ajenas.
  if not found then raise exception 'suscripcion_no_existe'; end if;
  return jsonb_build_object('solo_cambios', v_fila.solo_cambios,
    'solo_fuertes', v_fila.solo_fuertes, 'silenciado_hasta', v_fila.silenciado_hasta);
end $$;
revoke execute on function public.preferencias_push(text, boolean, boolean, integer) from public, anon;
grant execute on function public.preferencias_push(text, boolean, boolean, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Encolado por zona (versión de 20261027171925 + filtros de preferencias).
-- zona_activada sigue siendo "primer activo de la celda": con la publicación por
-- confirmaciones, la transición pendiente -> activo llega como UPDATE y se detecta igual.
-- -----------------------------------------------------------------------------
create or replace function public.encolar_aviso_zona() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_celdas text[];
  v_celda text;
  v_activos_despues integer;
  v_entraron integer;
  v_salieron integer;
  v_activos_antes integer;
  v_tipo public.tipo_aviso_push;
  v_nivel public.nivel_zona;
  v_intervalo interval := public.param('minutos_entre_avisos') * interval '1 minute';
  s record;
begin
  if tg_op = 'INSERT' then
    select coalesce(array_agg(distinct public.celda_mapa(ubicacion)
      order by public.celda_mapa(ubicacion)), array[]::text[])
      into v_celdas from nuevas where estado = 'activo';
  else
    select coalesce(array_agg(celda order by celda), array[]::text[])
      into v_celdas from (
        select public.celda_mapa(o.ubicacion) as celda
          from anteriores o join nuevas n using (id)
          where o.estado = 'activo' and
            (n.estado <> 'activo' or public.celda_mapa(o.ubicacion) <>
              public.celda_mapa(n.ubicacion))
        union
        select public.celda_mapa(n.ubicacion) as celda
          from anteriores o join nuevas n using (id)
          where n.estado = 'activo' and
            (o.estado <> 'activo' or public.celda_mapa(o.ubicacion) <>
              public.celda_mapa(n.ubicacion))
      ) c;
  end if;

  foreach v_celda in array v_celdas loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_celda, 7401));
    select count(*) into v_activos_despues from public.reportes r
      where r.estado = 'activo' and public.celda_mapa(r.ubicacion) = v_celda;
    if tg_op = 'INSERT' then
      select count(*) into v_entraron from nuevas n
        where n.estado = 'activo' and public.celda_mapa(n.ubicacion) = v_celda;
      v_salieron := 0;
    else
      select count(*) into v_entraron from nuevas n join anteriores o using (id)
        where n.estado = 'activo' and public.celda_mapa(n.ubicacion) = v_celda
          and (o.estado <> 'activo' or public.celda_mapa(o.ubicacion) <> v_celda);
      select count(*) into v_salieron from anteriores o join nuevas n using (id)
        where o.estado = 'activo' and public.celda_mapa(o.ubicacion) = v_celda
          and (n.estado <> 'activo' or public.celda_mapa(n.ubicacion) <> v_celda);
    end if;
    v_activos_antes := v_activos_despues - v_entraron + v_salieron;
    if v_activos_antes = 0 and v_activos_despues > 0 then
      v_tipo := 'zona_activada';
      v_nivel := public.nivel_de_celda(v_celda);
    elsif v_activos_antes > 0 and v_activos_despues = 0 then
      v_tipo := 'zona_resuelta';
      v_nivel := null;
    else
      continue;
    end if;

    for s in select id from public.suscripciones_push
      where celda = v_celda
        and (silenciado_hasta is null or silenciado_hasta <= now())
        and (not solo_fuertes
             or (v_tipo = 'zona_activada' and v_nivel in ('alto', 'critico')))
      order by id for update
    loop
      if v_tipo = 'zona_resuelta' or not exists (
        select 1 from public.avisos_push a
          where a.suscripcion_id = s.id and a.celda = v_celda
            and a.tipo = 'zona_activada'
            and a.creado_en > now() - v_intervalo
      ) then
        insert into public.avisos_push (suscripcion_id, celda, tipo, titulo, mensaje, nivel_zona)
        values (s.id, v_celda, v_tipo,
          case when v_tipo = 'zona_activada'
            then 'Inundación reportada en tu zona' else 'Alerta de zona resuelta' end,
          'Consulta el mapa para ver el estado actual.', v_nivel);
      end if;
    end loop;
  end loop;
  return null;
end $$;

-- -----------------------------------------------------------------------------
-- Encolado de clima (versión de 20261026224500 + filtros de preferencias).
-- -----------------------------------------------------------------------------
create or replace function private.encolar_alertas_clima_vigentes() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_total integer := 0;
  v_filas integer;
  v_intervalo interval := public.param('minutos_entre_avisos') * interval '1 minute';
  a record;
  s record;
begin
  for a in select id, municipio, titulo, descripcion, nivel from public.alertas_clima
    where verificado_en is not null and verificado_en <= now()
      and vigente_desde <= now() and vigente_hasta > now()
    order by id
  loop
    for s in select id from public.suscripciones_push
      where municipio = lower(trim(a.municipio))
        and (silenciado_hasta is null or silenciado_hasta <= now())
        and (not solo_fuertes or a.nivel = 'alto')
      order by id for update
    loop
      if not exists (select 1 from public.avisos_push x
          where x.alerta_clima_id = a.id and x.suscripcion_id = s.id)
        and not exists (select 1 from public.avisos_push x
          where x.suscripcion_id = s.id and x.municipio = lower(trim(a.municipio))
            and x.creado_en > now() - v_intervalo)
      then
        insert into public.avisos_push
          (suscripcion_id, municipio, alerta_clima_id, tipo, titulo, mensaje)
        values (s.id, lower(trim(a.municipio)), a.id, 'clima', a.titulo,
          left(a.descripcion, 240))
        on conflict do nothing;
        get diagnostics v_filas = row_count;
        v_total := v_total + v_filas;
      end if;
    end loop;
  end loop;
  return v_total;
end $$;

-- -----------------------------------------------------------------------------
-- tomar_avisos_push (versión de 20261027045344): además descarta lo silenciado y,
-- con solo_fuertes, lo que no sea clima alto o zona alto|critico.
-- -----------------------------------------------------------------------------
create or replace function public.tomar_avisos_push(p_lote integer)
returns table (id uuid, suscripcion_id uuid, titulo text, mensaje text, token_reclamo uuid)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_lote is null or p_lote < 1 or p_lote > 20 then raise exception 'parametros_invalidos'; end if;
  update public.avisos_push a set estado = 'fallido', bloqueado_hasta = null, token_reclamo = null
    where (a.estado = 'pendiente' or (a.estado = 'en_proceso' and a.bloqueado_hasta <= now()))
      and (a.intentos >= public.param('max_intentos_push')
        or not exists (
          select 1 from public.suscripciones_push s where s.id = a.suscripcion_id and (
            (a.tipo = 'clima' and s.municipio = a.municipio and exists (
              select 1 from public.alertas_clima c where c.id = a.alerta_clima_id
                and lower(trim(c.municipio)) = a.municipio
                and c.verificado_en is not null and c.verificado_en <= now()
                and c.vigente_desde <= now() and c.vigente_hasta > now()))
            or (a.tipo <> 'clima' and s.celda = a.celda and (
              (a.tipo = 'zona_activada') = exists (select 1 from public.reportes r
                where r.estado = 'activo' and public.celda_mapa(r.ubicacion) = a.celda)))
          ))
        or exists (
          select 1 from public.suscripciones_push s where s.id = a.suscripcion_id and (
            (s.silenciado_hasta is not null and s.silenciado_hasta > now())
            or (s.solo_fuertes and not (
              (a.tipo = 'clima' and exists (select 1 from public.alertas_clima c
                 where c.id = a.alerta_clima_id and c.nivel = 'alto'))
              or (a.tipo = 'zona_activada' and a.nivel_zona in ('alto', 'critico'))))
          )));
  return query with candidatos as (
    select a.id from public.avisos_push a
    where ((a.estado = 'pendiente' and a.proximo_intento_en <= now())
      or (a.estado = 'en_proceso' and a.bloqueado_hasta <= now()))
      and a.intentos < public.param('max_intentos_push')
    order by a.creado_en, a.id for update skip locked limit p_lote
  ) update public.avisos_push a
    set estado = 'en_proceso', intentos = a.intentos + 1,
      bloqueado_hasta = now() + public.param('minutos_bloqueo_aviso_push') * interval '1 minute',
      token_reclamo = gen_random_uuid()
    from candidatos c where a.id = c.id
    returning a.id, a.suscripcion_id, a.titulo, a.mensaje, a.token_reclamo;
end $$;
