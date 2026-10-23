-- Endurecimiento tras la revisión independiente de los módulos de Diego (2026-10-23).
-- Cada bloque fija un hallazgo: #1 restaurar limpia banderas, #2 confirmaciones sin rastro,
-- #6/#7 entradas inválidas con error del contrato, #8 no revivir resueltos, #9 duplicado en revisión.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

delete from public.reportes;
delete from public.administradores;
insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000ad', 'authenticated', 'authenticated');
insert into public.administradores (perfil_id) values ('00000000-0000-0000-0000-0000000000ad');

create function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.como(text) to authenticated;

-- Reporte activo de A en el centro de GDL
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, estado, activado_en, ultima_confirmacion)
values ('20000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-00000000000a', 'calle', true,
        public.punto(20.6597, -103.3496), 'activo', now(), now());

-- #1: B, C y D lo marcan falso -> en_revision; admin restaura; B vuelve a marcar -> sigue activo
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
select public.marcar_falso('20000000-0000-4000-8000-000000000001');
select pg_temp.como('00000000-0000-0000-0000-00000000000c');
select public.marcar_falso('20000000-0000-4000-8000-000000000001');
select pg_temp.como('00000000-0000-0000-0000-00000000000d');
select is(public.marcar_falso('20000000-0000-4000-8000-000000000001')->>'estado', 'en_revision', '#1 tres falsos -> en_revision');
select pg_temp.como('00000000-0000-0000-0000-0000000000ad');
select is(public.restaurar_reporte('20000000-0000-4000-8000-000000000001', 'era real')->>'estado', 'activo', '#1 admin restaura');
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
select is(public.marcar_falso('20000000-0000-4000-8000-000000000001')->>'estado', 'activo', '#1 un falso tras restaurar no lo regresa a revisión');
reset role;
select is((select count(*) from public.confirmaciones where reporte_id = '20000000-0000-4000-8000-000000000001' and falso)::int,
          1, '#1 restaurar limpió las banderas anteriores');

-- #2: confirmaciones sin id ni horas para clientes (evita reconstruir trayectos)
set local role anon;
select throws_ok($$ select id from public.confirmaciones $$, '42501', null, '#2 anon no lee id de confirmaciones');
select throws_ok($$ select creado_en from public.confirmaciones $$, '42501', null, '#2 anon no lee creado_en de confirmaciones');
select throws_ok($$ select actualizado_en from public.confirmaciones $$, '42501', null, '#2 anon no lee actualizado_en de confirmaciones');
select lives_ok($$ select reporte_id, sigue, falso from public.confirmaciones $$, '#2 anon sí lee reporte_id, sigue, falso');
reset role;

-- #7: entradas nulas o inválidas -> parametros_invalidos (no errores crudos de Postgres)
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-00000000000c');
select throws_ok($$ select public.crear_reporte(null, 'calle', true, 20.70, -103.40) $$,
  'P0001', 'parametros_invalidos', '#7 crear_reporte sin id');
select throws_ok($$ select public.crear_reporte(gen_random_uuid(), 'calle', null, 20.70, -103.40) $$,
  'P0001', 'parametros_invalidos', '#7 crear_reporte sin pasan_carros');
select throws_ok($$ select public.crear_reporte(gen_random_uuid(), 'calle', true, 20.70, -103.40, -5) $$,
  'P0001', 'parametros_invalidos', '#7 crear_reporte con precisión negativa');
select throws_ok($$ select public.confirmar_reporte('20000000-0000-4000-8000-000000000001', null) $$,
  'P0001', 'parametros_invalidos', '#7 confirmar_reporte sin p_sigue');

-- #6: rectángulo inválido o del tamaño del mundo
select throws_ok($$ select * from public.reportes_activos_en_area(20.7, -103.3, 20.6, -103.4) $$,
  'P0001', 'parametros_invalidos', '#6 min mayor que max');
select throws_ok($$ select * from public.reportes_activos_en_area(-90, -180, 90, 180) $$,
  'P0001', 'area_demasiado_grande', '#6 el mundo entero da area_demasiado_grande, no error de PostGIS');
reset role;

-- #9: un reporte propio en revisión cuenta como vivo para duplicados
update public.reportes set estado = 'en_revision' where id = '20000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.crear_reporte(gen_random_uuid(), 'calle', true, 20.6598, -103.3496) $$,
  'P0001', 'duplicado_cercano', '#9 duplicado junto a un reporte propio en revisión');
reset role;

-- #8: no se revive un reporte que ya estaba resuelto antes de ocultarlo
update public.reportes set estado = 'oculto', resuelto_en = now() - interval '2 hours'
 where id = '20000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000ad');
select throws_ok($$ select public.restaurar_reporte('20000000-0000-4000-8000-000000000001', 'error') $$,
  'P0001', 'estado_invalido', '#8 restaurar un oculto que ya estaba resuelto');
reset role;

select * from finish();
rollback;
