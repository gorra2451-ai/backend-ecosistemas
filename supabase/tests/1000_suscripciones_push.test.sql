-- F4-T1: suscripciones Web Push privadas, por municipio o celda.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-00000000010a', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000010b', 'authenticated', 'authenticated');
select has_table('public', 'suscripciones_push', 'existe tabla de suscripciones');
select ok((select relrowsecurity from pg_class
  where oid = 'public.suscripciones_push'::regclass), 'suscripciones tiene RLS');
select ok(not exists (select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'suscripciones_push'
    and column_name in ('lat', 'lng', 'ubicacion')), 'no guarda ubicación exacta');

set local role anon;
select throws_ok($$ select * from public.suscripciones_push $$,
  '42501', null, 'sin sesión no lee endpoints');
select throws_ok($$ select public.suscribir_push('https://push.example.test/abc',
  repeat('A', 87), repeat('B', 22), 'Guadalajara', null) $$,
  '42501', null, 'sin sesión no ejecuta la RPC');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000010a","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select throws_ok($$ select * from public.suscripciones_push $$,
  '42501', null, 'usuario tampoco lee endpoints ni llaves');
select throws_ok($$ select public.suscribir_push('http://push.example.test/abc',
  repeat('A', 87), repeat('B', 22), 'Guadalajara', null) $$,
  'P0001', 'parametros_invalidos', 'rechaza endpoint sin HTTPS');
select throws_ok($$ select public.suscribir_push('https://push.example.test/abc',
  repeat('A', 87), repeat('B', 22), null, null) $$,
  'P0001', 'parametros_invalidos', 'requiere un ámbito');
select throws_ok($$ select public.suscribir_push('https://push.example.test/abc',
  repeat('A', 87), repeat('B', 22), 'Guadalajara', '2240_7617') $$,
  'P0001', 'parametros_invalidos', 'no mezcla municipio y celda');
select throws_ok($$ select public.suscribir_push('https://push.example.test/abc',
  'llave', repeat('B', 22), 'Guadalajara', null) $$,
  'P0001', 'parametros_invalidos', 'valida clave pública del navegador');
select lives_ok($$ select public.suscribir_push('https://push.example.test/abc',
  repeat('A', 87), repeat('B', 22), 'Guadalajara', null) $$,
  'sesión anónima guarda interés municipal');
select lives_ok($$ select public.suscribir_push('https://push.example.test/abc',
  repeat('A', 87), repeat('B', 22), 'Guadalajara', null) $$,
  'reintento del mismo endpoint es idempotente');
select throws_ok($$ insert into public.suscripciones_push
  (perfil_id, endpoint, p256dh, auth, municipio)
  values ('00000000-0000-0000-0000-00000000010a', 'https://push.example.test/otro',
    repeat('A', 87), repeat('B', 22), 'Guadalajara') $$,
  '42501', null, 'cliente no inserta directamente');
reset role;

select is((select count(*) from public.suscripciones_push)::int, 1,
  'reintento no crea otra suscripción');
select is((select municipio from public.suscripciones_push), 'guadalajara',
  'municipio se normaliza');
select is((select perfil_id from public.suscripciones_push),
  '00000000-0000-0000-0000-00000000010a'::uuid, 'la suscripción pertenece al usuario');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000010b","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select throws_ok($$ select public.suscribir_push('https://push.example.test/abc',
  repeat('A', 87), repeat('B', 22), 'Zapopan', null) $$,
  'P0001', 'suscripcion_en_uso', 'otro usuario no secuestra endpoint');
select is(public.baja_push('https://push.example.test/abc'), false,
  'otro usuario no puede darla de baja');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000010a","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select is(public.baja_push('https://push.example.test/abc'), true,
  'dueño puede borrar su suscripción');
reset role;
select is((select count(*) from public.suscripciones_push)::int, 0,
  'baja elimina endpoint y claves');

select * from finish();
rollback;
