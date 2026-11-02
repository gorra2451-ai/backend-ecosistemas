-- F4-T2: cola privada por celda. El trigger solo encola; el envío sale de la
-- transacción del reporte y se reintenta desde una Edge Function interna.
create extension if not exists pg_net with schema extensions;

create type public.tipo_aviso_push as enum ('zona_activada', 'zona_resuelta');
create type public.estado_aviso_push as enum
  ('pendiente', 'en_proceso', 'enviado', 'fallido');
insert into public.parametros (clave, valor, descripcion) values
  ('max_intentos_push', 3, 'Intentos de envío antes de marcar fallo (propuesta P-22)'),
  ('minutos_reintento_push', 5, 'Espera entre intentos (propuesta P-22)'),
  ('minutos_bloqueo_aviso_push', 2, 'Tiempo de reclamo de un trabajador (propuesta P-22)'),
  ('dias_retencion_avisos_push', 7, 'Retención de la cola e historial (propuesta P-22)');

create table public.avisos_push (
  id uuid primary key default gen_random_uuid(),
  suscripcion_id uuid not null references public.suscripciones_push (id) on delete cascade,
  celda text not null,
  tipo public.tipo_aviso_push not null,
  titulo text not null,
  mensaje text not null,
  estado public.estado_aviso_push not null default 'pendiente',
  intentos integer not null default 0 check (intentos >= 0),
  proximo_intento_en timestamptz not null default now(),
  bloqueado_hasta timestamptz,
  token_reclamo uuid,
  creado_en timestamptz not null default now(),
  enviado_en timestamptz
);
create index avisos_push_pendientes_idx on public.avisos_push
  (proximo_intento_en, creado_en) where estado = 'pendiente';
create index avisos_push_historial_idx on public.avisos_push
  (suscripcion_id, celda, creado_en desc);
alter table public.avisos_push enable row level security;
revoke all on public.avisos_push from public, anon, authenticated;
-- Sin políticas de cliente. El trabajador usa funciones exclusivas de service_role.

create function public.encolar_aviso_zona() returns trigger
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
  else
    return new;
  end if;
  v_celda := public.celda_mapa(new.ubicacion);
  select count(*) into v_activos from public.reportes r
    where r.estado = 'activo' and public.celda_mapa(r.ubicacion) = v_celda;
  if (v_tipo = 'zona_activada' and v_activos <> 1)
     or (v_tipo = 'zona_resuelta' and v_activos <> 0) then
    return new;
  end if;

  -- El bloqueo de la suscripción serializa el límite frente a cambios concurrentes.
  for s in select id from public.suscripciones_push
    where celda = v_celda order by id for update
  loop
    if not exists (
      select 1 from public.avisos_push a
      where a.suscripcion_id = s.id and a.celda = v_celda
        and a.creado_en > now() - v_intervalo
    ) then
      insert into public.avisos_push
        (suscripcion_id, celda, tipo, titulo, mensaje)
      values (s.id, v_celda, v_tipo,
        case when v_tipo = 'zona_activada'
          then 'Inundación reportada en tu zona' else 'Alerta de zona resuelta' end,
        'Consulta el mapa para ver el estado actual.');
    end if;
  end loop;
  return new;
end $$;
revoke execute on function public.encolar_aviso_zona() from public, anon, authenticated;
drop trigger if exists reportes_avisos_push on public.reportes;
create trigger reportes_avisos_push
  after insert or update of estado on public.reportes
  for each row execute function public.encolar_aviso_zona();

create function public.tomar_avisos_push(p_lote integer)
returns table (id uuid, suscripcion_id uuid, titulo text, mensaje text, token_reclamo uuid)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_lote is null or p_lote < 1 or p_lote > 20 then
    raise exception 'parametros_invalidos';
  end if;
  update public.avisos_push a set estado = 'fallido', bloqueado_hasta = null,
      token_reclamo = null
    where a.estado = 'en_proceso' and a.bloqueado_hasta <= now()
      and a.intentos >= public.param('max_intentos_push');
  return query
    with candidatos as (
      select a.id from public.avisos_push a
      where ((a.estado = 'pendiente' and a.proximo_intento_en <= now())
        or (a.estado = 'en_proceso' and a.bloqueado_hasta <= now()))
        and a.intentos < public.param('max_intentos_push')
      order by a.creado_en, a.id
      for update skip locked limit p_lote
    )
    update public.avisos_push a
      set estado = 'en_proceso', intentos = a.intentos + 1,
          bloqueado_hasta = now() + public.param('minutos_bloqueo_aviso_push') * interval '1 minute',
          token_reclamo = gen_random_uuid()
      from candidatos c where a.id = c.id
      returning a.id, a.suscripcion_id, a.titulo, a.mensaje, a.token_reclamo;
end $$;
revoke execute on function public.tomar_avisos_push(integer) from public, anon, authenticated;
grant execute on function public.tomar_avisos_push(integer) to service_role;

create function public.finalizar_aviso_push(p_id uuid, p_token uuid, p_exito boolean)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_id is null or p_token is null or p_exito is null then
    raise exception 'parametros_invalidos';
  end if;
  update public.avisos_push a set
    estado = case when p_exito then 'enviado'::public.estado_aviso_push
      when a.intentos >= public.param('max_intentos_push') then 'fallido'::public.estado_aviso_push
      else 'pendiente'::public.estado_aviso_push end,
    proximo_intento_en = case when p_exito then a.proximo_intento_en
      else now() + public.param('minutos_reintento_push') * interval '1 minute' end,
    bloqueado_hasta = null, token_reclamo = null,
    enviado_en = case when p_exito then now() else a.enviado_en end
  where a.id = p_id and a.estado = 'en_proceso' and a.token_reclamo = p_token;
  return found;
end $$;
revoke execute on function public.finalizar_aviso_push(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.finalizar_aviso_push(uuid, uuid, boolean) to service_role;

-- La URL y la clave se cargan en Vault al desplegar; si faltan, cron no envía.
create or replace function private.invocar_procesador_push() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_clave text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets
    where name = 'ecosistemas_project_url' limit 1;
  select decrypted_secret into v_clave from vault.decrypted_secrets
    where name = 'ecosistemas_secret_key' limit 1;
  if v_url is null or v_clave is null then return; end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/procesar-avisos',
    headers := jsonb_build_object('Content-type', 'application/json', 'apikey', v_clave),
    body := '{}'::jsonb
  );
end $$;
revoke execute on function private.invocar_procesador_push() from public, anon, authenticated;
select cron.schedule('procesar-avisos-push', '* * * * *',
  'select private.invocar_procesador_push()');

create or replace function private.limpiar_avisos_push() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.avisos_push
    where creado_en < now() - public.param('dias_retencion_avisos_push') * interval '1 day';
end $$;
revoke execute on function private.limpiar_avisos_push() from public, anon, authenticated;
select cron.schedule('limpiar-avisos-push', '17 3 * * *',
  'select private.limpiar_avisos_push()');
