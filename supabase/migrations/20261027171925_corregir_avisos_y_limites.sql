-- Correcciones de la revisión de Diego. No modifica migraciones aplicadas.
-- P-25: valor provisional; confirmar con Diego antes del merge.
insert into public.parametros (clave, valor, descripcion)
values ('max_entradas_por_hora', 20,
  'Máximo provisional de entradas por perfil en una hora (P-25)');

create or replace function public.registrar_entrada(medio text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'sin_sesion'; end if;
  if medio is null or medio not in ('peaton','bici','auto','transporte_publico') then
    raise exception 'parametros_invalidos';
  end if;
  -- El bloqueo del perfil serializa llamadas simultáneas del mismo usuario.
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
revoke execute on function public.registrar_entrada(text) from public, anon;
grant execute on function public.registrar_entrada(text) to authenticated;

create or replace function public.suscribir_push(
  p_endpoint text, p_p256dh text, p_auth text, p_municipio text,
  p_celda text default null
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_municipio text := nullif(lower(trim(p_municipio)), '');
  v_celda text := nullif(trim(p_celda), '');
  v_host text;
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
  -- Misma lista de proveedores que endpointPermitido en enviar-push.
  -- Se rechazan puertos, credenciales y hosts de apariencia parecida.
  v_host := lower(substring(p_endpoint from '^https://([A-Za-z0-9.-]+)/'));
  if v_host is null or not (
      v_host in ('fcm.googleapis.com','updates.push.services.mozilla.com',
                 'web.push.apple.com')
      or v_host ~ '^([a-z0-9-]+\.)+notify\.windows\.com$') then
    raise exception 'proveedor_push_no_permitido';
  end if;

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

-- El trigger por fila no ve el estado anterior de una actualización de grupo.
-- Las tablas de transición permiten reconstruir el conteo por celda antes y después.
drop trigger if exists reportes_avisos_push on public.reportes;
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
    -- Bloqueos siempre en orden de celda para evitar interbloqueos.
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
    elsif v_activos_antes > 0 and v_activos_despues = 0 then
      v_tipo := 'zona_resuelta';
    else
      continue;
    end if;

    for s in select id from public.suscripciones_push
      where celda = v_celda order by id for update
    loop
      if v_tipo = 'zona_resuelta' or not exists (
        select 1 from public.avisos_push a
          where a.suscripcion_id = s.id and a.celda = v_celda
            and a.tipo = 'zona_activada'
            and a.creado_en > now() - v_intervalo
      ) then
        insert into public.avisos_push (suscripcion_id, celda, tipo, titulo, mensaje)
        values (s.id, v_celda, v_tipo,
          case when v_tipo = 'zona_activada'
            then 'Inundación reportada en tu zona' else 'Alerta de zona resuelta' end,
          'Consulta el mapa para ver el estado actual.');
      end if;
    end loop;
  end loop;
  return null;
end $$;
revoke execute on function public.encolar_aviso_zona() from public, anon, authenticated;
create trigger reportes_avisos_push
  after update on public.reportes
  referencing old table as anteriores new table as nuevas
  for each statement execute function public.encolar_aviso_zona();
create trigger reportes_avisos_push_insert
  after insert on public.reportes
  referencing new table as nuevas
  for each statement execute function public.encolar_aviso_zona();
