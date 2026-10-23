-- Base (F1-T1, F1-T3, F1-T4): extensiones, parámetros, ZMG, tablas de reportes, RLS y permisos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- Aislar de seed.sql: se borra dentro de la transacción y el rollback lo restaura.
delete from public.reportes;
delete from public.administradores;

-- Usuarios de prueba (A normal, B admin)
insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated');
insert into public.administradores (perfil_id) values ('00000000-0000-0000-0000-00000000000b');

-- Extensiones
select has_extension('postgis', 'postgis instalada');
select has_extension('pg_cron', 'pg_cron instalada');

-- Tablas con RLS
select ok((select relrowsecurity from pg_class where oid = 'public.parametros'::regclass), 'RLS en parametros');
select ok((select relrowsecurity from pg_class where oid = 'public.limites_zmg'::regclass), 'RLS en limites_zmg');
select ok((select relrowsecurity from pg_class where oid = 'public.administradores'::regclass), 'RLS en administradores');
select ok((select relrowsecurity from pg_class where oid = 'public.reportes'::regclass), 'RLS en reportes');
select ok((select relrowsecurity from pg_class where oid = 'public.confirmaciones'::regclass), 'RLS en confirmaciones');
select ok((select relrowsecurity from pg_class where oid = 'public.acciones_admin'::regclass), 'RLS en acciones_admin');

-- Parámetros
select is(public.param('umbral_activacion'), 5::numeric, 'umbral_activacion = 5 (clase)');
select is(public.param('minutos_expiracion'), 30::numeric, 'minutos_expiracion = 30 (clase)');
select throws_ok($$ select public.param('no_existe') $$, 'P0001', 'parametro_no_existe: no_existe', 'param() falla con clave desconocida');

-- ZMG
select ok(public.dentro_de_zmg(20.6597, -103.3496), 'centro de Guadalajara está en la ZMG');
select ok(not public.dentro_de_zmg(19.4326, -99.1332), 'CDMX no está en la ZMG');

-- Datos para permisos: un reporte activo y uno pendiente de A
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, estado) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'calle', true,
   extensions.st_setsrid(extensions.st_makepoint(-103.3496, 20.6597), 4326)::extensions.geography, 'activo'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'casa', false,
   extensions.st_setsrid(extensions.st_makepoint(-103.3500, 20.6600), 4326)::extensions.geography, 'pendiente');
insert into public.confirmaciones (reporte_id, perfil_id, sigue) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', true);

-- Sin sesión (anon)
set local role anon;
select isnt_empty($$ select clave from public.parametros $$, 'anon lee parametros');
select throws_ok($$ insert into public.parametros values ('x', 1, 'x') $$, '42501', null, 'anon no escribe parametros');
select is((select count(*) from public.reportes)::int, 1, 'anon solo ve reportes activos');
reset role;

-- Usuario normal A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select perfil_id from public.reportes $$, '42501', null, 'nadie lee perfil_id de reportes');
select throws_ok($$ select perfil_id from public.confirmaciones $$, '42501', null, 'nadie lee perfil_id de confirmaciones');
select lives_ok($$ select id, tipo, pasan_carros, ubicacion, estado, ultima_confirmacion, creado_en from public.reportes $$, 'columnas públicas de reportes se leen');
select is((select count(*) from public.confirmaciones)::int, 1, 'confirmaciones de reportes activos se leen (sin autor)');
select throws_ok($$ insert into public.reportes (id, tipo, pasan_carros, ubicacion)
  values (gen_random_uuid(), 'calle', true, 'POINT(-103.35 20.66)') $$, '42501', null, 'no se inserta directo en reportes');
select throws_ok($$ select * from public.administradores $$, '42501', null, 'administradores no se lee');
select ok(not public.es_admin(), 'A no es admin');
select is((select count(*) from public.acciones_admin)::int, 0, 'A no ve acciones_admin');
reset role;

-- Admin B
insert into public.acciones_admin (admin_id, accion, objetivo_tabla, objetivo_id, motivo)
  values ('00000000-0000-0000-0000-00000000000b', 'prueba', 'reportes', '1', 'prueba');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select ok(public.es_admin(), 'B es admin');
select is((select count(*) from public.acciones_admin)::int, 1, 'B ve acciones_admin');
reset role;

-- Funciones nuevas nacen cerradas (hueco detectado en M1: EXECUTE a PUBLIC por defecto)
create function public.funcion_nueva_de_prueba() returns int language sql as 'select 1';
set local role anon;
select throws_ok($$ select public.funcion_nueva_de_prueba() $$, '42501', null, 'anon no ejecuta funciones nuevas');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.funcion_nueva_de_prueba() $$, '42501', null, 'authenticated no ejecuta funciones nuevas');
reset role;

select * from finish();
rollback;
