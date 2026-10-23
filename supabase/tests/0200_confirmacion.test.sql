-- M2 (F2-T2, F2-T3): activación, confirmación, falsos, reportes_cercanos y expiración.
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- Aislar de seed.sql: se borra dentro de la transacción y el rollback lo restaura.
delete from public.reportes;

-- Usuarios de prueba A..H
insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000e', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000f', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated');

-- Zonas separadas > 2 km para que no se mezclen:
--   Z1 activación + confirmación  lat 20.6597
--   Z2 persona_en_riesgo           lat 20.6797
--   Z4 reportes_cercanos           lat 20.7197
--   Z5 expiración                  lat 20.7600 .. 20.7900

-- -----------------------------------------------------------------------------
-- Activación (Z1)
-- -----------------------------------------------------------------------------
-- E: pendiente viejo (fuera de la ventana) dentro del radio. F: reciente fuera del radio (~333 m).
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, creado_en) values
  ('21000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000e', 'calle', true,
   public.punto(20.6597, -103.3496), now() - interval '61 minutes'),
  ('21000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000f', 'calle', true,
   public.punto(20.6627, -103.3496), now());

-- A, B, C, D: 4 reportes cercanos
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion) values
  ('21000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'calle', true, public.punto(20.6597, -103.3496));
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion) values
  ('21000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'casa', false, public.punto(20.6598, -103.3496));
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion) values
  ('21000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000c', 'calle', true, public.punto(20.6599, -103.3496));
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion) values
  ('21000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000d', 'coche', true, public.punto(20.6600, -103.3496));

select is((select count(*)::int from public.reportes where estado = 'activo'), 0,
  '4 reportes cercanos siguen pendiente (el viejo y el lejano no cuentan)');

-- G: el 5.º activa los 5
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion) values
  ('21000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000010', 'calle', true, public.punto(20.6597, -103.3497));

select is((select count(*)::int from public.reportes
           where id::text like '21000000-0000-0000-0000-00000000000%' and estado = 'activo'), 5,
  'el 5.º reporte activa los 5');
select ok((select bool_and(activado_en = now() and ultima_confirmacion = now()) from public.reportes
           where id::text like '21000000-0000-0000-0000-00000000000%'),
  'al activar se ponen activado_en y ultima_confirmacion');
select is((select array_agg(estado::text order by id) from public.reportes
           where id in ('21000000-0000-0000-0000-0000000000e1', '21000000-0000-0000-0000-0000000000f1')),
  array['pendiente', 'pendiente'], 'el viejo (fuera de ventana) y el lejano (fuera de radio) siguen pendiente');

-- H: nuevo junto a un activo nace activo
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion) values
  ('21000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000011', 'calle', true, public.punto(20.6601, -103.3496));
select is((select estado::text from public.reportes where id = '21000000-0000-0000-0000-000000000006'), 'activo',
  'nuevo junto a un activo nace activo');

-- Z2: persona_en_riesgo activa con 1; un "calle" aislado no
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion) values
  ('22000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'persona_en_riesgo', false, public.punto(20.6797, -103.3496));
select is((select estado::text from public.reportes where id = '22000000-0000-0000-0000-000000000001'), 'activo',
  'persona_en_riesgo se activa con umbral_persona_en_riesgo');
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion) values
  ('22000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'calle', true, public.punto(20.6997, -103.3496));
select is((select estado::text from public.reportes where id = '22000000-0000-0000-0000-000000000002'), 'pendiente',
  'un reporte normal aislado sigue pendiente');

-- -----------------------------------------------------------------------------
-- Confirmar (r1 de A, r2 de B, r3 de C, r4 de D; todos activos)
-- -----------------------------------------------------------------------------
update public.reportes set ultima_confirmacion = now() - interval '10 minutes'
  where id = '21000000-0000-0000-0000-000000000001';

-- Sin permiso para anon
set local role anon;
select throws_ok($$ select public.confirmar_reporte('21000000-0000-0000-0000-000000000001', true) $$,
  '42501', null, 'anon no puede confirmar');
reset role;

-- Sesión vacía
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;
select throws_ok($$ select public.confirmar_reporte('21000000-0000-0000-0000-000000000001', true) $$,
  'P0001', 'sin_sesion', 'sin sesión → sin_sesion');
reset role;

-- B confirma "sí" sobre r1
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select is(public.confirmar_reporte('21000000-0000-0000-0000-000000000001', true),
  '{"reporte_id": "21000000-0000-0000-0000-000000000001", "estado": "activo"}'::jsonb,
  'confirmar devuelve {reporte_id, estado}');
reset role;
select is((select ultima_confirmacion from public.reportes where id = '21000000-0000-0000-0000-000000000001'), now(),
  'confirmar "sí" actualiza ultima_confirmacion');

-- B: sí → no → sí deja una sola fila
set local role authenticated;
select lives_ok($$ select public.confirmar_reporte('21000000-0000-0000-0000-000000000001', false) $$, 'B cambia a "no"');
select lives_ok($$ select public.confirmar_reporte('21000000-0000-0000-0000-000000000001', true) $$, 'B regresa a "sí"');
reset role;
select is((select count(*)::int from public.confirmaciones
           where reporte_id = '21000000-0000-0000-0000-000000000001'
             and perfil_id = '00000000-0000-0000-0000-00000000000b'), 1, 'sí→no→sí deja 1 fila');
select is((select sigue from public.confirmaciones
           where reporte_id = '21000000-0000-0000-0000-000000000001'
             and perfil_id = '00000000-0000-0000-0000-00000000000b'), true, 'la fila queda en "sí"');

-- Errores
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.confirmar_reporte('21000000-0000-0000-0000-000000000001', true) $$,
  'P0001', 'propio_reporte', 'no se confirma el propio reporte');
select throws_ok($$ select public.confirmar_reporte('22000000-0000-0000-0000-000000000002', true) $$,
  'P0001', 'reporte_no_activo', 'no se confirma un reporte pendiente');
select throws_ok($$ select public.confirmar_reporte('99999999-0000-0000-0000-000000000000', true) $$,
  'P0001', 'reporte_no_existe', 'reporte inexistente → reporte_no_existe');
reset role;

-- 3 "no" resuelven r1 (el "sí" de B queda antes)
update public.reportes set ultima_confirmacion = now() - interval '5 minutes'
  where id = '21000000-0000-0000-0000-000000000001';
alter table public.confirmaciones disable trigger confirmaciones_actualizado_en;
update public.confirmaciones set actualizado_en = now() - interval '6 minutes'
  where reporte_id = '21000000-0000-0000-0000-000000000001';
alter table public.confirmaciones enable trigger confirmaciones_actualizado_en;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select public.confirmar_reporte('21000000-0000-0000-0000-000000000001', false);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
set local role authenticated;
select is(public.confirmar_reporte('21000000-0000-0000-0000-000000000001', false) ->> 'estado', 'activo',
  '2 "no" no alcanzan');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
set local role authenticated;
select is(public.confirmar_reporte('21000000-0000-0000-0000-000000000001', false) ->> 'estado', 'resuelto',
  '3 "no" resuelven');
reset role;
select ok((select resuelto_en = now() from public.reportes where id = '21000000-0000-0000-0000-000000000001'),
  'resuelto_en se pone al resolver');

-- "no" anteriores al último "sí" no cuentan (r2 de B)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select public.confirmar_reporte('21000000-0000-0000-0000-000000000002', false);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
set local role authenticated;
select public.confirmar_reporte('21000000-0000-0000-0000-000000000002', false);
reset role;
-- Simular: esos "no" fueron hace 20 min y alguien dijo "sí" hace 10 min
-- (el trigger de actualizado_en se apaga solo para fijar la hora; el rollback lo restaura)
alter table public.confirmaciones disable trigger confirmaciones_actualizado_en;
update public.confirmaciones set actualizado_en = now() - interval '20 minutes'
  where reporte_id = '21000000-0000-0000-0000-000000000002';
alter table public.confirmaciones enable trigger confirmaciones_actualizado_en;
update public.reportes set ultima_confirmacion = now() - interval '10 minutes'
  where id = '21000000-0000-0000-0000-000000000002';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
set local role authenticated;
select is(public.confirmar_reporte('21000000-0000-0000-0000-000000000002', false) ->> 'estado', 'activo',
  '"no" anteriores al último "sí" no cuentan');
reset role;

-- -----------------------------------------------------------------------------
-- Marcar falso (r3 de C)
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select is(public.marcar_falso('21000000-0000-0000-0000-000000000003'),
  '{"reporte_id": "21000000-0000-0000-0000-000000000003", "estado": "activo"}'::jsonb,
  'marcar_falso devuelve {reporte_id, estado}');
select throws_ok($$ select public.marcar_falso('21000000-0000-0000-0000-000000000001') $$,
  'P0001', 'propio_reporte', 'marcar_falso del propio → propio_reporte');
reset role;
select is((select array[sigue, falso] from public.confirmaciones
           where reporte_id = '21000000-0000-0000-0000-000000000003'
             and perfil_id = '00000000-0000-0000-0000-00000000000a'), array[false, true],
  'marcar_falso guarda sigue=false, falso=true');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select public.marcar_falso('21000000-0000-0000-0000-000000000003');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
set local role authenticated;
select is(public.marcar_falso('21000000-0000-0000-0000-000000000003') ->> 'estado', 'en_revision',
  '3 falsos → en_revision');
-- Un "sí" después de "falso" quita la bandera (r4 de D lo confirma A)
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select public.marcar_falso('21000000-0000-0000-0000-000000000004');
select public.confirmar_reporte('21000000-0000-0000-0000-000000000004', true);
reset role;
select is((select array[sigue, falso] from public.confirmaciones
           where reporte_id = '21000000-0000-0000-0000-000000000004'
             and perfil_id = '00000000-0000-0000-0000-00000000000a'), array[true, false],
  'pasar a "sí" quita falso');

-- -----------------------------------------------------------------------------
-- reportes_cercanos (Z4). Activos insertados directo; el pendiente entra como resuelto y se cambia
-- (si entrara pendiente, el trigger lo activaría por estar junto a un activo).
-- -----------------------------------------------------------------------------
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, estado, activado_en, ultima_confirmacion) values
  ('24000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000c', 'calle', true, public.punto(20.7247, -103.3496), 'activo', now(), now()),
  ('24000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'calle', true, public.punto(20.7199, -103.3496), 'activo', now(), now()),
  ('24000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'casa',  true, public.punto(20.7207, -103.3496), 'activo', now(), now()),
  ('24000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000d', 'calle', true, public.punto(20.7397, -103.3496), 'activo', now(), now()),
  ('24000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000e', 'calle', true, public.punto(20.7198, -103.3496), 'resuelto', null, null);
update public.reportes set estado = 'pendiente' where id = '24000000-0000-0000-0000-000000000005';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select is((select array_agg(id order by distancia_m) from public.reportes_cercanos(20.7197, -103.3496, 5000)),
  array['24000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000002',
        '24000000-0000-0000-0000-000000000003']::uuid[],
  'reportes_cercanos: solo activos, radio topado a radio_cercanos_max_m');
select is((select array_agg(id) from public.reportes_cercanos(20.7197, -103.3496, 5000)),
  array['24000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000002',
        '24000000-0000-0000-0000-000000000003']::uuid[],
  'reportes_cercanos ordena por distancia');
select is((select array_agg(es_propio) from public.reportes_cercanos(20.7197, -103.3496, 5000)),
  array[true, false, false], 'es_propio solo para el reporte del usuario actual');
select ok((select abs(distancia_m - 22.1) < 1 and abs(lat - 20.7199) < 1e-9 and abs(lng + 103.3496) < 1e-9
           from public.reportes_cercanos(20.7197, -103.3496, 5000) limit 1),
  'reportes_cercanos devuelve distancia_m y lat/lng');
select throws_ok($$ select public.expirar_reportes() $$, '42501', null, 'clientes no pueden llamar expirar_reportes');
reset role;

-- -----------------------------------------------------------------------------
-- Expiración (Z5)
-- -----------------------------------------------------------------------------
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, estado, activado_en, ultima_confirmacion, creado_en) values
  ('25000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'calle', true, public.punto(20.7600, -103.3496), 'activo',
   now() - interval '90 minutes', now() - interval '31 minutes', now() - interval '90 minutes'),
  ('25000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'calle', true, public.punto(20.7700, -103.3496), 'activo',
   now() - interval '31 minutes', null, now() - interval '40 minutes'),
  ('25000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'calle', true, public.punto(20.7800, -103.3496), 'activo',
   now() - interval '90 minutes', now() - interval '29 minutes', now() - interval '90 minutes');
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, creado_en) values
  ('25000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000a', 'calle', true, public.punto(20.7900, -103.3496), now() - interval '61 minutes');

-- Cambian: 25..01, 25..02, 25..04 y el viejo de Z1 (21..e1) = 4
select is(public.expirar_reportes(), 4, 'expirar_reportes devuelve filas cambiadas');
select is((select array_agg(estado::text order by id) from public.reportes
           where id in ('25000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000002',
                        '25000000-0000-0000-0000-000000000004', '21000000-0000-0000-0000-0000000000e1')),
  array['resuelto', 'resuelto', 'resuelto', 'resuelto'],
  'expira activos sin "sí" (con o sin ultima_confirmacion) y pendientes viejos');
select ok((select bool_and(resuelto_en = now()) from public.reportes
           where id in ('25000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000004')),
  'expirar pone resuelto_en');
select is((select array_agg(estado::text order by id) from public.reportes
           where id in ('25000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-0000000000f1')),
  array['pendiente', 'activo'], 'no toca activos ni pendientes recientes');

-- pg_cron
select is((select schedule from cron.job where jobname = 'expirar-reportes'), '*/5 * * * *',
  'job expirar-reportes programado cada 5 min');

select * from finish();
rollback;
