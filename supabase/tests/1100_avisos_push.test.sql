-- F4-T2: una alerta por celda/usuario por intervalo, cola privada y reclamos seguros.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select has_table('public', 'avisos_push', 'existe cola de avisos');
select ok((select relrowsecurity from pg_class where oid = 'public.avisos_push'::regclass),
  'cola tiene RLS');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.reportes'::regclass
  and tgname = 'reportes_avisos_push' and not tgisinternal), 'estados disparan cola');
select ok(exists (select 1 from cron.job where jobname = 'procesar-avisos-push'),
  'procesador tiene trabajo programado');

insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-00000000011a', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000011b', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000011c', 'authenticated', 'authenticated');
insert into public.suscripciones_push (id, perfil_id, endpoint, p256dh, auth, celda, municipio)
values
  ('20000000-0000-4000-8000-00000000011a', '00000000-0000-0000-0000-00000000011a',
   'https://fcm.googleapis.com/fcm/send/11a', repeat('A', 87), repeat('B', 22),
   public.celda_mapa(public.punto(20.95, -103.70)), null),
  ('20000000-0000-4000-8000-00000000011b', '00000000-0000-0000-0000-00000000011b',
   'https://fcm.googleapis.com/fcm/send/11b', repeat('A', 87), repeat('B', 22),
   '9999_9999', null),
  ('20000000-0000-4000-8000-00000000011c', '00000000-0000-0000-0000-00000000011c',
   'https://fcm.googleapis.com/fcm/send/11c', repeat('A', 87), repeat('B', 22),
   null, 'guadalajara');

insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, estado)
values ('10000000-0000-4000-8000-00000000011a',
  '00000000-0000-0000-0000-00000000011a', 'calle', true,
  public.punto(20.95, -103.70), 'activo');
select is((select count(*) from public.avisos_push)::int, 1,
  'primera zona activa crea una entrega');
select is((select tipo::text from public.avisos_push), 'zona_activada',
  'la entrega distingue activación');
select ok(not exists (select 1 from information_schema.columns where table_schema='public'
  and table_name='avisos_push' and column_name in ('lat','lng','ubicacion','perfil_id')),
  'cola no guarda posición ni autor');
select is((select suscripcion_id from public.avisos_push),
  '20000000-0000-4000-8000-00000000011a'::uuid, 'solo coincide la celda suscrita');
select is((select count(*) from public.avisos_push where suscripcion_id =
  '20000000-0000-4000-8000-00000000011c')::int, 0,
  'sin polígonos, no se inventa el municipio del reporte');

insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, estado)
values ('10000000-0000-4000-8000-00000000011b',
  '00000000-0000-0000-0000-00000000011b', 'calle', true,
  public.punto(20.95001, -103.70001), 'activo');
select is((select count(*) from public.avisos_push)::int, 1,
  'otro reporte en la misma celda no duplica aviso');
update public.reportes set estado = 'resuelto'
  where id = '10000000-0000-4000-8000-00000000011a';
select is((select count(*) from public.avisos_push)::int, 1,
  'zona con otro reporte activo no se resuelve');

update public.avisos_push set creado_en = now() - interval '31 minutes';
update public.reportes set estado = 'resuelto'
  where id = '10000000-0000-4000-8000-00000000011b';
select is((select count(*) from public.avisos_push)::int, 2,
  'al desaparecer la zona fuera del intervalo, crea aviso');
select is((select tipo::text from public.avisos_push
  order by creado_en desc limit 1), 'zona_resuelta', 'la entrega distingue resolución');

set local role anon;
select throws_ok($$ select * from public.avisos_push $$, '42501', null,
  'público no lee la cola');
reset role;
set local role authenticated;
select throws_ok($$ select * from public.tomar_avisos_push(5) $$, '42501', null,
  'usuario no reclama envíos');
reset role;

set local role service_role;
create temp table tomados as select * from public.tomar_avisos_push(5);
select is((select count(*) from tomados)::int, 2, 'servicio reclama ambas entregas');
select is((select count(*) from public.tomar_avisos_push(5))::int, 0,
  'reclamo impide enviar dos veces en paralelo');
select is(public.finalizar_aviso_push(
  (select id from tomados order by id limit 1),
  (select token_reclamo from tomados order by id limit 1), true), true,
  'servicio marca envío exitoso');
select is(public.finalizar_aviso_push(
  (select id from tomados order by id desc limit 1),
  (select token_reclamo from tomados order by id desc limit 1), false), true,
  'fallo programa reintento');
select is(public.finalizar_aviso_push(
  (select id from tomados order by id limit 1),
  gen_random_uuid(), false), false, 'token viejo no cambia entrega');
reset role;

select * from finish();
rollback;
