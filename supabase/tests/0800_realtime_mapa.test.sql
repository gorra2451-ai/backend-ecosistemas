-- F3-T3: Broadcast del mapa sin filas privadas ni postgres_changes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select ok(exists (select 1 from pg_publication_rel r
  join pg_publication p on p.oid = r.prpubid
  where p.pubname = 'supabase_realtime' and r.prrelid = 'realtime.messages'::regclass),
  'Realtime publica solamente la tabla de mensajes');
select ok(not exists (select 1 from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public'
    and tablename in ('reportes', 'confirmaciones')),
  'reportes y confirmaciones no usan postgres_changes');
select ok(exists (select 1 from pg_trigger
  where tgrelid = 'public.reportes'::regclass and tgname = 'reportes_mapa_broadcast' and not tgisinternal),
  'reportes tiene trigger de Broadcast');
select ok(exists (select 1 from pg_trigger
  where tgrelid = 'public.confirmaciones'::regclass and tgname = 'confirmaciones_mapa_broadcast' and not tgisinternal),
  'confirmaciones actualizan zonas por Broadcast');

insert into auth.users (id, aud, role)
  values ('00000000-0000-0000-0000-00000000008a', 'authenticated', 'authenticated');
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, estado)
  values ('10000000-0000-4000-8000-00000000008a',
    '00000000-0000-0000-0000-00000000008a', 'calle', true,
    public.punto(20.95, -103.70), 'pendiente');
select is((select count(*) from realtime.messages where topic = 'reportes'
  and payload ->> 'id' = '10000000-0000-4000-8000-00000000008a')::int,
  0, 'un reporte pendiente no se anuncia');

create temp table eventos_base as
  select public.celda_mapa(ubicacion) as celda,
    (select count(*) from realtime.messages m where m.topic = 'zonas'
      and m.payload ->> 'celda' = public.celda_mapa(r.ubicacion)) as n
  from public.reportes r where id = '10000000-0000-4000-8000-00000000008a';
update public.reportes set estado = 'activo'
  where id = '10000000-0000-4000-8000-00000000008a';
select is((select count(*) from realtime.messages where topic = 'reportes'
  and payload ->> 'id' = '10000000-0000-4000-8000-00000000008a')::int,
  1, 'activar emite un evento de reporte');
select is((select payload ->> 'estado' from realtime.messages where topic = 'reportes'
  and payload ->> 'id' = '10000000-0000-4000-8000-00000000008a' limit 1),
  'activo', 'el evento indica estado activo');
select ok(not exists (select 1 from realtime.messages where topic = 'reportes'
  and payload ->> 'id' = '10000000-0000-4000-8000-00000000008a'
  and (payload ? 'perfil_id' or payload ? 'ubicacion' or payload ? 'precision_m')),
  'ningún evento expone autor ni ubicación bruta');
select is((select count(*) - (select n from eventos_base) from realtime.messages
  where topic = 'zonas' and payload ->> 'celda' = (select celda from eventos_base))::int,
  1, 'activar invalida la celda');
select is((select celda from eventos_base),
  (select celda from public.zonas_publicas where total_reportes > 0
    and celda = (select celda from eventos_base) limit 1),
  'la celda emitida coincide con la vista del mapa');

insert into public.confirmaciones (reporte_id, perfil_id, sigue)
  values ('10000000-0000-4000-8000-00000000008a',
    '00000000-0000-0000-0000-00000000008a', true);
select is((select count(*) - (select n from eventos_base) from realtime.messages
  where topic = 'zonas' and payload ->> 'celda' = (select celda from eventos_base))::int,
  2, 'confirmación positiva invalida la celda');
select ok(not exists (select 1 from realtime.messages where topic = 'zonas'
  and payload ->> 'celda' = (select celda from eventos_base)
  and (payload ? 'perfil_id' or payload ? 'ubicacion')),
  'zona no publica autor ni punto preciso');

update public.reportes set estado = 'resuelto'
  where id = '10000000-0000-4000-8000-00000000008a';
select is((select payload ->> 'estado' from realtime.messages where topic = 'reportes'
  and payload ->> 'id' = '10000000-0000-4000-8000-00000000008a'
  order by inserted_at desc limit 1),
  'resuelto', 'resolver comunica salida del mapa');
select is((select count(*) - (select n from eventos_base) from realtime.messages
  where topic = 'zonas' and payload ->> 'celda' = (select celda from eventos_base))::int,
  3, 'resolver vuelve a invalidar la celda');

select * from finish();
rollback;
