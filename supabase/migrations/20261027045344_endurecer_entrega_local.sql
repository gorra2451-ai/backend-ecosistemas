-- Revisión final: límites concurrentes y entrega de avisos todavía vigentes.
create or replace function public.puede_subir_evidencia(p_ruta text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_reporte_id uuid;
begin
  if (select auth.uid()) is null or p_ruta is null or p_ruta !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|mp4|webm)$'
    then return false; end if;
  v_reporte_id := split_part(p_ruta, '/', 1)::uuid;
  perform 1 from public.reportes where id = v_reporte_id
    and perfil_id = (select auth.uid()) and estado in ('pendiente', 'activo') for update;
  if not found then return false; end if;
  -- La función VOLATILE lee el conteo después de obtener el lock compartido con
  -- agregar_evidencia y la política de borrado. Altas simultáneas no evaden el límite.
  return (select count(*) < public.param('max_evidencias_por_reporte')
    from storage.objects o where o.bucket_id = 'evidencias'
      and o.name like v_reporte_id::text || '/%' and not o.is_delete_marker);
end $$;

create or replace function public.puede_borrar_evidencia(p_ruta text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_reporte_id uuid;
begin
  if (select auth.uid()) is null or p_ruta is null or p_ruta !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' then return false; end if;
  v_reporte_id := split_part(p_ruta, '/', 1)::uuid;
  if not exists (select 1 from storage.objects where bucket_id = 'evidencias'
    and name = p_ruta and owner_id = (select auth.uid()::text)) then return false; end if;
  perform 1 from public.reportes where id = v_reporte_id
    and perfil_id = (select auth.uid()) for update;
  if not found and exists (select 1 from public.reportes where id = v_reporte_id) then return false; end if;
  return not exists (select 1 from public.evidencias where ruta_storage = p_ruta);
end $$;
revoke execute on function public.puede_borrar_evidencia(text) from public, anon, authenticated;
grant execute on function public.puede_borrar_evidencia(text) to authenticated;
drop policy if exists evidencias_borrar_sin_registrar on storage.objects;
create policy evidencias_borrar_sin_registrar on storage.objects for delete to authenticated using (
  bucket_id = 'evidencias' and owner_id = (select auth.uid()::text)
  and public.puede_borrar_evidencia(name));

create or replace function public.encolar_aviso_zona() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_tipo public.tipo_aviso_push;
  v_celda text;
  v_activos integer;
  v_intervalo interval := public.param('minutos_entre_avisos') * interval '1 minute';
  s record;
begin
  if tg_op = 'INSERT' then
    if new.estado <> 'activo' then return new; end if;
    v_tipo := 'zona_activada';
  elsif old.estado <> 'activo' and new.estado = 'activo' then
    v_tipo := 'zona_activada';
  elsif old.estado = 'activo' and new.estado = 'resuelto' then
    v_tipo := 'zona_resuelta';
  else return new;
  end if;
  v_celda := public.celda_mapa(new.ubicacion);
  -- Serializar antes de contar, incluso si cambian dos reportes diferentes.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_celda, 7401));
  select count(*) into v_activos from public.reportes r
    where r.estado = 'activo' and public.celda_mapa(r.ubicacion) = v_celda;
  if (v_tipo = 'zona_activada' and v_activos <> 1)
    or (v_tipo = 'zona_resuelta' and v_activos <> 0) then return new; end if;
  for s in select id from public.suscripciones_push where celda = v_celda order by id for update
  loop
    if not exists (select 1 from public.avisos_push a where a.suscripcion_id = s.id
      and a.celda = v_celda and a.creado_en > now() - v_intervalo) then
      insert into public.avisos_push (suscripcion_id, celda, tipo, titulo, mensaje)
      values (s.id, v_celda, v_tipo,
        case when v_tipo = 'zona_activada' then 'Inundación reportada en tu zona'
          else 'Alerta de zona resuelta' end, 'Consulta el mapa para ver el estado actual.');
    end if;
  end loop;
  return new;
end $$;

create or replace function public.tomar_avisos_push(p_lote integer)
returns table (id uuid, suscripcion_id uuid, titulo text, mensaje text, token_reclamo uuid)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_lote is null or p_lote < 1 or p_lote > 20 then raise exception 'parametros_invalidos'; end if;
  -- No enviar un estado antiguo ni datos de una zona a la que ya no se suscribe.
  update public.avisos_push a set estado = 'fallido', bloqueado_hasta = null, token_reclamo = null
    where (a.estado = 'pendiente' or (a.estado = 'en_proceso' and a.bloqueado_hasta <= now()))
      and (a.intentos >= public.param('max_intentos_push') or not exists (
        select 1 from public.suscripciones_push s where s.id = a.suscripcion_id and (
          (a.tipo = 'clima' and s.municipio = a.municipio and exists (
            select 1 from public.alertas_clima c where c.id = a.alerta_clima_id
              and lower(trim(c.municipio)) = a.municipio
              and c.verificado_en is not null and c.verificado_en <= now()
              and c.vigente_desde <= now() and c.vigente_hasta > now()))
          or (a.tipo <> 'clima' and s.celda = a.celda and (
            (a.tipo = 'zona_activada') = exists (select 1 from public.reportes r
              where r.estado = 'activo' and public.celda_mapa(r.ubicacion) = a.celda)))
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

drop function public.finalizar_aviso_push(uuid, uuid, boolean);
create function public.finalizar_aviso_push(p_id uuid, p_token uuid, p_exito boolean,
  p_descartado boolean default false) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_id is null or p_token is null or p_exito is null or p_descartado is null then
    raise exception 'parametros_invalidos'; end if;
  update public.avisos_push a set estado = case
      when p_descartado then 'fallido'::public.estado_aviso_push
      when p_exito then 'enviado'::public.estado_aviso_push
      when a.intentos >= public.param('max_intentos_push') then 'fallido'::public.estado_aviso_push
      else 'pendiente'::public.estado_aviso_push end,
    proximo_intento_en = case when p_exito or p_descartado then a.proximo_intento_en
      else now() + public.param('minutos_reintento_push') * interval '1 minute' end,
    bloqueado_hasta = null, token_reclamo = null,
    enviado_en = case when p_exito and not p_descartado then now() else a.enviado_en end
  where a.id = p_id and a.estado = 'en_proceso' and a.token_reclamo = p_token;
  return found;
end $$;
revoke execute on function public.finalizar_aviso_push(uuid, uuid, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.finalizar_aviso_push(uuid, uuid, boolean, boolean) to service_role;

create or replace function private.limpiar_avisos_push() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.avisos_push a
    where a.creado_en < now() - public.param('dias_retencion_avisos_push') * interval '1 day'
      -- Conservar la deduplicación mientras una alerta climática siga vigente.
      and not exists (select 1 from public.alertas_clima c where c.id = a.alerta_clima_id
        and c.vigente_hasta > now());
end $$;
