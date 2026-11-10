-- F3-T3: invalidaciones del mapa por Broadcast. Nunca se replica la fila de
-- reportes/confirmaciones: sus columnas privadas no pueden entrar al mensaje.

-- Realtime lee los mensajes de esta publicación, no las tablas de negocio.
do $publicacion$
begin
  if not exists (
    select 1 from pg_publication_rel r
    join pg_publication p on p.oid = r.prpubid
    where p.pubname = 'supabase_realtime'
      and r.prrelid = 'realtime.messages'::regclass
  ) then
    alter publication supabase_realtime add table realtime.messages;
  end if;
end
$publicacion$;

-- La misma proyección UTM y parámetro que usa zonas_publicas.
create function public.celda_mapa(p_ubicacion extensions.geography) returns text
language sql stable set search_path = '' as $$
  select floor(extensions.st_x(u.g) / public.param('tamano_celda_m'))::bigint::text
    || '_' || floor(extensions.st_y(u.g) / public.param('tamano_celda_m'))::bigint::text
  from (select extensions.st_transform(p_ubicacion::extensions.geometry, 32613) as g) u
$$;
revoke execute on function public.celda_mapa(extensions.geography) from public, anon, authenticated;

create function public.reportes_mapa_broadcast() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_antes_activo boolean := false;
  v_despues_activo boolean := false;
  v_id uuid;
  v_estado text;
  v_celda text;
  v_celda_anterior text;
begin
  if tg_op = 'INSERT' then
    v_despues_activo := new.estado = 'activo';
    v_id := new.id;
    v_estado := new.estado::text;
    v_celda := public.celda_mapa(new.ubicacion);
  elsif tg_op = 'DELETE' then
    v_antes_activo := old.estado = 'activo';
    v_id := old.id;
    v_estado := 'borrado';
    v_celda := public.celda_mapa(old.ubicacion);
  else
    v_antes_activo := old.estado = 'activo';
    v_despues_activo := new.estado = 'activo';
    if old.estado = new.estado
       and old.pasan_carros = new.pasan_carros
       and old.ultima_confirmacion is not distinct from new.ultima_confirmacion
       and old.ubicacion::text = new.ubicacion::text then
      return new;
    end if;
    v_id := new.id;
    v_estado := new.estado::text;
    v_celda := public.celda_mapa(new.ubicacion);
    if old.ubicacion::text <> new.ubicacion::text then
      v_celda_anterior := public.celda_mapa(old.ubicacion);
    end if;
  end if;

  if v_antes_activo or v_despues_activo then
    perform realtime.send(
      jsonb_build_object('id', v_id, 'estado', v_estado),
      'cambio', 'reportes', false
    );
    perform realtime.send(jsonb_build_object('celda', v_celda), 'cambio', 'zonas', false);
    if v_celda_anterior is not null and v_celda_anterior <> v_celda then
      perform realtime.send(jsonb_build_object('celda', v_celda_anterior), 'cambio', 'zonas', false);
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke execute on function public.reportes_mapa_broadcast() from public, anon, authenticated;
drop trigger if exists reportes_mapa_broadcast on public.reportes;
create trigger reportes_mapa_broadcast
  after insert or update or delete on public.reportes
  for each row execute function public.reportes_mapa_broadcast();

create function public.confirmaciones_mapa_broadcast() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_reporte_id uuid;
  v_sigue boolean;
  v_ubicacion extensions.geography;
begin
  if tg_op = 'DELETE' then
    v_reporte_id := old.reporte_id;
    v_sigue := old.sigue;
  else
    v_reporte_id := new.reporte_id;
    v_sigue := new.sigue;
  end if;
  if tg_op = 'UPDATE' and old.sigue is not distinct from new.sigue then return new; end if;
  if tg_op <> 'UPDATE' and not v_sigue then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  select ubicacion into v_ubicacion from public.reportes
    where id = v_reporte_id and estado = 'activo';
  if found then
    perform realtime.send(
      jsonb_build_object('celda', public.celda_mapa(v_ubicacion)),
      'cambio', 'zonas', false
    );
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke execute on function public.confirmaciones_mapa_broadcast() from public, anon, authenticated;
drop trigger if exists confirmaciones_mapa_broadcast on public.confirmaciones;
create trigger confirmaciones_mapa_broadcast
  after insert or update or delete on public.confirmaciones
  for each row execute function public.confirmaciones_mapa_broadcast();
