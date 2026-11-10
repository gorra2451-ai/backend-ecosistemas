-- F1-T2: sesión anónima, perfiles, entradas y aislamiento por usuario.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-00000000006a', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000006b', 'authenticated', 'authenticated');

select ok((select relrowsecurity from pg_class where oid = 'public.perfiles'::regclass), 'perfiles tiene RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.entradas'::regclass), 'entradas tiene RLS');
select is((select count(*) from public.perfiles where id in
  ('00000000-0000-0000-0000-00000000006a', '00000000-0000-0000-0000-00000000006b'))::int,
  2, 'el alta en Auth crea un perfil por usuario');
select is((select accesibilidad from public.perfiles where id = '00000000-0000-0000-0000-00000000006a'),
  '{}'::jsonb, 'el perfil inicia sin preferencias');

set local role anon;
select throws_ok($$ select * from public.perfiles $$, '42501', null, 'sin sesión no lee perfiles');
select throws_ok($$ select * from public.entradas $$, '42501', null, 'sin sesión no lee entradas');
select throws_ok($$ select public.registrar_entrada('auto') $$, '42501', null, 'sin sesión no ejecuta registrar_entrada');
select throws_ok($$ select public.guardar_accesibilidad('{}'::jsonb) $$, '42501', null,
  'sin sesión no ejecuta guardar_accesibilidad');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000006a","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select is((select count(*) from public.perfiles)::int, 1, 'usuario anónimo solo lee su perfil');
select lives_ok($$ select public.registrar_entrada('auto') $$, 'sesión anónima registra auto');
select lives_ok($$ select public.registrar_entrada('peaton') $$, 'cada visita registra su medio');
select is((select count(*) from public.entradas)::int, 2, 'usuario solo lee sus dos entradas');
select throws_ok($$ select public.registrar_entrada(null) $$, 'P0001', 'parametros_invalidos',
  'medio nulo se rechaza');
select throws_ok($$ select public.registrar_entrada('barco') $$, 'P0001', 'parametros_invalidos',
  'medio desconocido se rechaza');
select lives_ok($$ select public.guardar_accesibilidad('{"daltonismo":true}'::jsonb) $$,
  'guarda la preferencia documentada');
select is((select accesibilidad from public.perfiles), '{"daltonismo":true}'::jsonb,
  'la preferencia queda en el perfil propio');
select throws_ok($$ select public.guardar_accesibilidad('[]'::jsonb) $$,
  'P0001', 'parametros_invalidos', 'preferencias deben ser objeto');
select throws_ok($$ select public.guardar_accesibilidad('{"correo":"x@y.test"}'::jsonb) $$,
  'P0001', 'parametros_invalidos', 'preferencias no aceptan datos personales arbitrarios');
select throws_ok($$ select public.guardar_accesibilidad('{"daltonismo":"si"}'::jsonb) $$,
  'P0001', 'parametros_invalidos', 'preferencia debe ser booleana');
select throws_ok($$ insert into public.entradas (perfil_id, medio)
  values ('00000000-0000-0000-0000-00000000006a', 'auto') $$,
  '42501', null, 'cliente no inserta entradas directamente');
select throws_ok($$ update public.perfiles set accesibilidad = '{}'::jsonb $$,
  '42501', null, 'cliente no actualiza perfiles directamente');
select throws_ok($$ delete from public.entradas $$,
  '42501', null, 'cliente no borra entradas directamente');
reset role;

select is((select string_agg(medio::text, ',' order by creado_en, id) from public.entradas
  where perfil_id = '00000000-0000-0000-0000-00000000006a'), 'auto,peaton',
  'las entradas conservan el orden de las visitas');
select ok((select bool_and(creado_en <= now()) from public.entradas
  where perfil_id = '00000000-0000-0000-0000-00000000006a'),
  'la fecha de entrada la pone el servidor');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000006b","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select is((select count(*) from public.entradas)::int, 0, 'otro usuario no lee entradas ajenas');
select lives_ok($$ select public.guardar_accesibilidad('{"daltonismo":false}'::jsonb) $$,
  'otro usuario cambia su propia preferencia');
select is((select accesibilidad from public.perfiles), '{"daltonismo":false}'::jsonb,
  'otro usuario solo ve su propia preferencia');
reset role;

select is((select accesibilidad from public.perfiles where id = '00000000-0000-0000-0000-00000000006a'),
  '{"daltonismo":true}'::jsonb, 'la preferencia del primer usuario no cambió');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.registrar_entrada('auto') $$,
  'P0001', 'sin_sesion', 'rol autenticado sin usuario no registra entradas');
select throws_ok($$ select public.guardar_accesibilidad('{}'::jsonb) $$,
  'P0001', 'sin_sesion', 'rol autenticado sin usuario no guarda preferencias');
reset role;

select * from finish();
rollback;
