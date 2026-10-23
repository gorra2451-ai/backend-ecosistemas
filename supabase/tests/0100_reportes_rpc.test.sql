-- M1 Reportes (F2-T1, F3-T2): crear_reporte y reportes_activos_en_area.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- Aislar de seed.sql: se borra dentro de la transacción y el rollback lo restaura.
delete from public.reportes;

-- Usuarios de prueba (A y B normales)
insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated');

-- -----------------------------------------------------------------------------
-- crear_reporte
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select is(
  public.crear_reporte('20000000-0000-0000-0000-000000000001', 'calle', false, 20.6597, -103.3496, 15),
  '{"id":"20000000-0000-0000-0000-000000000001","estado":"pendiente"}'::jsonb,
  'crea reporte pendiente y devuelve solo {id, estado}');

select is(
  public.crear_reporte('20000000-0000-0000-0000-000000000001', 'calle', false, 20.6597, -103.3496, 15),
  '{"id":"20000000-0000-0000-0000-000000000001","estado":"pendiente"}'::jsonb,
  'reintento con el mismo id devuelve el existente');

select throws_ok(
  $$ select public.crear_reporte('20000000-0000-0000-0000-000000000009', 'calle', true, 19.4326, -99.1332) $$,
  'P0001', 'fuera_de_zmg', 'CDMX -> fuera_de_zmg');

select throws_ok(
  $$ select public.crear_reporte('20000000-0000-0000-0000-000000000009', 'calle', true, -103.3496, 20.6597) $$,
  'P0001', 'fuera_de_zmg', 'lat/lng invertidos -> fuera_de_zmg');

select throws_ok(
  $$ select public.crear_reporte('20000000-0000-0000-0000-000000000009', 'casa', true, 20.6602, -103.3496) $$,
  'P0001', 'duplicado_cercano', 'reporte propio vivo a ~50 m -> duplicado_cercano');
reset role;

-- Inspección como postgres
select is((select count(*) from public.reportes where id = '20000000-0000-0000-0000-000000000001')::int, 1,
  'el reintento no duplica la fila');
select is((select perfil_id from public.reportes where id = '20000000-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-00000000000a'::uuid, 'perfil_id es el usuario de la sesión');
select is((select creado_en from public.reportes where id = '20000000-0000-0000-0000-000000000001'),
  now(), 'creado_en lo pone el servidor');
select is((select count(*) from public.reportes)::int, 1, 'los intentos fallidos no insertan nada');

-- Usuario B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.crear_reporte('20000000-0000-0000-0000-000000000001', 'calle', false, 20.70, -103.40) $$,
  'P0001', 'id_en_uso', 'id de otro usuario -> id_en_uso');
select is(
  public.crear_reporte('20000000-0000-0000-0000-0000000000b1', 'casa', true, 20.6602, -103.3496)->>'estado',
  'pendiente', 'a ~50 m del reporte de otro usuario sí se permite');
reset role;

-- Sin sesión (rol authenticated sin sub)
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.crear_reporte('20000000-0000-0000-0000-000000000009', 'calle', true, 20.6597, -103.3496) $$,
  'P0001', 'sin_sesion', 'sin sesión -> sin_sesion');
reset role;

-- Reporte propio resuelto cercano no bloquea
update public.reportes set estado = 'resuelto', resuelto_en = now()
  where id = '20000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select is(
  public.crear_reporte('20000000-0000-0000-0000-000000000002', 'casa', true, 20.6602, -103.3496)->>'estado',
  'pendiente', 'reporte propio resuelto cercano no bloquea');

-- Límite por hora: A ya lleva 2; tres más a > radio entre sí llegan a 5; el 6.º falla
select lives_ok($$
  select public.crear_reporte('20000000-0000-0000-0000-000000000003', 'calle', true, 20.67, -103.3496);
  select public.crear_reporte('20000000-0000-0000-0000-000000000004', 'calle', true, 20.68, -103.3496);
  select public.crear_reporte('20000000-0000-0000-0000-000000000005', 'calle', true, 20.69, -103.3496);
$$, 'reportes 3.º a 5.º en la hora se permiten');
select throws_ok(
  $$ select public.crear_reporte('20000000-0000-0000-0000-000000000006', 'calle', true, 20.70, -103.3496) $$,
  'P0001', 'limite_por_hora', '6.º reporte en la hora -> limite_por_hora');
reset role;

-- Reportes viejos (> 1 h) ya no cuentan para el límite
update public.reportes set creado_en = now() - interval '61 minutes'
  where perfil_id = '00000000-0000-0000-0000-00000000000a';
set local role authenticated;
select is(
  public.crear_reporte('20000000-0000-0000-0000-000000000006', 'calle', true, 20.70, -103.3496)->>'estado',
  'pendiente', 'reportes de hace más de 1 h no cuentan para el límite');
reset role;

-- -----------------------------------------------------------------------------
-- reportes_activos_en_area
-- -----------------------------------------------------------------------------
delete from public.reportes;
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, estado, creado_en) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'calle', true,
   public.punto(20.6597, -103.3496), 'activo', now() - interval '30 minutes'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'casa', false,
   public.punto(20.6650, -103.3500), 'activo', now() - interval '10 minutes'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b', 'persona_en_riesgo', false,
   public.punto(20.6700, -103.3400), 'activo', now() - interval '50 minutes'),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000b', 'calle', true,
   public.punto(20.6600, -103.3450), 'pendiente', now()),
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000b', 'calle', true,
   public.punto(20.8000, -103.3450), 'activo', now());

set local role anon;
select results_eq(
  $$ select id from public.reportes_activos_en_area(20.60, -103.40, 20.75, -103.30) $$,
  $$ values ('30000000-0000-0000-0000-000000000003'::uuid),
            ('30000000-0000-0000-0000-000000000002'::uuid),
            ('30000000-0000-0000-0000-000000000001'::uuid) $$,
  'solo activos dentro del área; persona_en_riesgo primero, luego creado_en desc');
select results_eq(
  $$ select lat, lng from public.reportes_activos_en_area(20.60, -103.40, 20.75, -103.30)
     where id = '30000000-0000-0000-0000-000000000001' $$,
  $$ values (20.6597::float8, -103.3496::float8) $$,
  'devuelve lat/lng correctos');
select throws_ok(
  $$ select * from public.reportes_activos_en_area(19.0, -105.0, 22.0, -101.0) $$,
  'P0001', 'area_demasiado_grande', 'área enorme -> area_demasiado_grande');
select lives_ok(
  $$ select * from public.reportes_activos_en_area(20.60, -103.40, 20.75, -103.30) $$,
  'anon puede llamar reportes_activos_en_area');
select throws_ok(
  $$ select public.crear_reporte('20000000-0000-0000-0000-000000000009', 'calle', true, 20.6597, -103.3496) $$,
  '42501', null, 'anon no puede llamar crear_reporte');
reset role;

-- Autenticado también puede consultar el área; la salida no expone perfil_id
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.reportes_activos_en_area(20.60, -103.40, 20.75, -103.30))::int, 3,
  'authenticated puede llamar reportes_activos_en_area');
reset role;
select ok(
  not exists (
    select 1 from pg_proc p, unnest(p.proargnames) as a(nombre)
    where p.oid = 'public.reportes_activos_en_area(float8, float8, float8, float8)'::regprocedure
      and a.nombre = 'perfil_id'),
  'reportes_activos_en_area no devuelve perfil_id');

select * from finish();
rollback;
