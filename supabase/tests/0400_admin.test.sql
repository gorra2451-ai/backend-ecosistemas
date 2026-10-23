-- Admin (F5-T1): ocultar_reporte, restaurar_reporte, reportes_en_revision y bitácora.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Aislar de seed.sql: se borra dentro de la transacción y el rollback lo restaura.
delete from public.reportes;
delete from public.administradores;
delete from public.acciones_admin;

-- Usuarios: A normal, B admin, C y D normales (votan)
insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated');
insert into public.administradores (perfil_id) values ('00000000-0000-0000-0000-00000000000b');

-- R1 activo, R2 en_revision (3 falsos), R3 resuelto, R4 oculto (1 falso, 1 "sí"), R5 pendiente
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, estado, activado_en, ultima_confirmacion, resuelto_en) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'calle', true,
   public.punto(20.6597, -103.3496), 'activo', now(), now(), null),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'casa', false,
   public.punto(20.6700, -103.3600), 'en_revision', now() - interval '20 minutes', now() - interval '20 minutes', null),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'calle', true,
   public.punto(20.6800, -103.3700), 'resuelto', now() - interval '2 hours', now() - interval '2 hours', now() - interval '1 hour'),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000c', 'coche', true,
   public.punto(20.6900, -103.3800), 'oculto', now() - interval '10 minutes', now() - interval '10 minutes', null),
  ('40000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000c', 'calle', true,
   public.punto(20.7000, -103.3900), 'pendiente', null, null, null);
insert into public.confirmaciones (reporte_id, perfil_id, sigue, falso) values
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', false, true),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', false, true),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', false, true),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000a', false, true),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000d', true, false);

-- ---------------------------------------------------------------------------
-- Usuario normal A: no autorizado en las 3, sin bitácora
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.ocultar_reporte('40000000-0000-0000-0000-000000000001', 'spam') $$,
  'P0001', 'no_autorizado', 'normal: ocultar_reporte -> no_autorizado');
select throws_ok($$ select public.restaurar_reporte('40000000-0000-0000-0000-000000000002', 'ok') $$,
  'P0001', 'no_autorizado', 'normal: restaurar_reporte -> no_autorizado');
select throws_ok($$ select * from public.reportes_en_revision() $$,
  'P0001', 'no_autorizado', 'normal: reportes_en_revision -> no_autorizado');
reset role;
select is((select count(*) from public.acciones_admin)::int, 0, 'sin filas en bitácora tras intentos de normal');
select is((select estado from public.reportes where id = '40000000-0000-0000-0000-000000000001'),
  'activo'::public.estado_reporte, 'el intento de normal no cambia el reporte');

-- ---------------------------------------------------------------------------
-- Admin B
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select is(public.ocultar_reporte('40000000-0000-0000-0000-000000000001', 'contenido ofensivo'),
  '{"reporte_id":"40000000-0000-0000-0000-000000000001","estado":"oculto"}'::jsonb,
  'admin oculta: devuelve {reporte_id, estado: oculto}');
reset role;
select is((select estado from public.reportes where id = '40000000-0000-0000-0000-000000000001'),
  'oculto'::public.estado_reporte, 'reporte queda oculto');
select results_eq(
  $$ select admin_id, accion, objetivo_tabla, objetivo_id, motivo from public.acciones_admin $$,
  $$ values ('00000000-0000-0000-0000-00000000000b'::uuid, 'ocultar_reporte', 'reportes',
             '40000000-0000-0000-0000-000000000001', 'contenido ofensivo') $$,
  'ocultar deja 1 fila en acciones_admin con admin, objetivo y motivo');

set local role authenticated;
select throws_ok($$ select public.ocultar_reporte('40000000-0000-0000-0000-000000000005', '') $$,
  'P0001', 'motivo_requerido', 'motivo vacío -> motivo_requerido');
select throws_ok($$ select public.ocultar_reporte('40000000-0000-0000-0000-000000000005', '   ') $$,
  'P0001', 'motivo_requerido', 'motivo con solo espacios -> motivo_requerido');
select throws_ok($$ select public.restaurar_reporte('40000000-0000-0000-0000-000000000002', null) $$,
  'P0001', 'motivo_requerido', 'motivo nulo -> motivo_requerido');
select throws_ok($$ select public.ocultar_reporte('40000000-0000-0000-0000-0000000000ff', 'x') $$,
  'P0001', 'reporte_no_existe', 'ocultar inexistente -> reporte_no_existe');
select throws_ok($$ select public.restaurar_reporte('40000000-0000-0000-0000-0000000000ff', 'x') $$,
  'P0001', 'reporte_no_existe', 'restaurar inexistente -> reporte_no_existe');

-- reportes_en_revision: solo en_revision|oculto (R1 ya oculto, R2, R4)
select results_eq(
  $$ select id::text, estado::text from public.reportes_en_revision() order by id $$,
  $$ values ('40000000-0000-0000-0000-000000000001', 'oculto'),
            ('40000000-0000-0000-0000-000000000002', 'en_revision'),
            ('40000000-0000-0000-0000-000000000004', 'oculto') $$,
  'reportes_en_revision lista solo en_revision y oculto');
select results_eq(
  $$ select total_falsos, total_confirmaciones from public.reportes_en_revision() order by id $$,
  $$ values (0, 0), (3, 0), (1, 1) $$,
  'total_falsos y total_confirmaciones correctos');
select ok((select abs(lat - 20.67) < 1e-9 and abs(lng - (-103.36)) < 1e-9
           from public.reportes_en_revision() where id = '40000000-0000-0000-0000-000000000002'),
  'reportes_en_revision devuelve lat/lng correctos');
select ok((select not ('perfil_id' = any(proargnames)) from pg_proc
           where oid = 'public.reportes_en_revision()'::regprocedure),
  'reportes_en_revision no expone perfil_id');

-- Restaurar
select is(public.restaurar_reporte('40000000-0000-0000-0000-000000000002', 'revisado: es real'),
  '{"reporte_id":"40000000-0000-0000-0000-000000000002","estado":"activo"}'::jsonb,
  'restaurar en_revision -> activo');
select is(public.restaurar_reporte('40000000-0000-0000-0000-000000000004', 'se ocultó por error') ->> 'estado',
  'activo', 'restaurar oculto -> activo');
select throws_ok($$ select public.restaurar_reporte('40000000-0000-0000-0000-000000000003', 'x') $$,
  'P0001', 'estado_invalido', 'restaurar resuelto -> estado_invalido');
select throws_ok($$ select perfil_id from public.reportes $$, '42501', null, 'admin tampoco lee perfil_id');
reset role;
select ok((select ultima_confirmacion >= now() from public.reportes where id = '40000000-0000-0000-0000-000000000002'),
  'restaurar reinicia ultima_confirmacion (hora real, no anterior al inicio)');
select is((select count(*) from public.acciones_admin)::int, 3,
  'solo las acciones exitosas quedan en bitácora (1 ocultar + 2 restaurar)');

-- anon no ejecuta
set local role anon;
select throws_ok($$ select * from public.reportes_en_revision() $$, '42501', null, 'anon no ejecuta funciones de admin');
reset role;

select * from finish();
rollback;
