-- M3 Zonas de calor (F3-T1): nivel_para y vista zonas_publicas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

delete from public.reportes;          -- aislar de seed.sql (el rollback lo restaura)
insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated');

-- Punto a partir de coordenadas UTM 13N (EPSG:32613), para controlar en qué celda cae.
-- Celda de 300 m: ix = floor(x/300), iy = floor(y/300). Todas en iy = 7617 (y 2285100..2285400).
create function pg_temp.utm(x float8, y float8) returns extensions.geography
language sql immutable as $$
  select extensions.st_transform(extensions.st_setsrid(extensions.st_makepoint(x, y), 32613), 4326)::extensions.geography
$$;

create function pg_temp.rep(x float8, y float8, est public.estado_reporte,
                            pasan boolean default true) returns uuid
language sql as $$
  insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, estado, activado_en)
  values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'calle', pasan,
          pg_temp.utm(x, y), est, case when est = 'activo' then now() - interval '10 minutes' end)
  returning id
$$;

-- Celda A (2240_7617): 2 activos + uno de cada estado no activo.
select pg_temp.rep(672100, 2285200, 'activo');
select pg_temp.rep(672200, 2285300, 'activo');
select pg_temp.rep(672150, 2285250, 'pendiente');
select pg_temp.rep(672150, 2285250, 'resuelto');
select pg_temp.rep(672150, 2285250, 'oculto');
select pg_temp.rep(672150, 2285250, 'en_revision');
-- Celda B (2250_7617): 3 activos.
select pg_temp.rep(675010, 2285110, 'activo');
select pg_temp.rep(675150, 2285250, 'activo');
select pg_temp.rep(675290, 2285390, 'activo');
-- Celda C (2260_7617, 3 km de B): 6 activos.
select pg_temp.rep(678000 + 40 * g, 2285250, 'activo') from generate_series(1, 6) g;
-- Celda D (2270_7617): 1 activo donde no pasan carros.
select pg_temp.rep(681150, 2285250, 'activo', false);
-- Frontera: 1 m a cada lado de x = 2280 * 300 = 684000.
select pg_temp.rep(683999, 2285250, 'activo');
select pg_temp.rep(684001, 2285250, 'activo');

-- Confirmaciones en un activo de la celda A: 2 "sí", 1 "no".
update public.reportes set ultima_confirmacion = now() - interval '1 minute'
  where ubicacion = pg_temp.utm(672100, 2285200);
insert into public.confirmaciones (reporte_id, perfil_id, sigue)
select r.id, u.id, u.sigue
from public.reportes r,
     (values ('00000000-0000-0000-0000-00000000000a'::uuid, true),
             ('00000000-0000-0000-0000-00000000000b'::uuid, true),
             ('00000000-0000-0000-0000-00000000000c'::uuid, false)) u(id, sigue)
where r.ubicacion = pg_temp.utm(672100, 2285200);

-- nivel_para (como postgres)
select is(public.nivel_para(1, false), 'bajo'::public.nivel_zona, 'nivel_para: 1 -> bajo');
select is(public.nivel_para(3, false), 'medio'::public.nivel_zona, 'nivel_para: 3 -> medio');
select is(public.nivel_para(6, false), 'alto'::public.nivel_zona, 'nivel_para: 6 -> alto');
select is(public.nivel_para(1, true), 'alto'::public.nivel_zona, 'nivel_para: no pasan carros -> alto');

-- Sin sesión (anon)
set local role anon;
select lives_ok($$ select * from public.zonas_publicas $$, 'anon lee zonas_publicas');
select is((select count(*) from public.zonas_publicas)::int, 6, 'una fila por celda con activos (6 celdas)');
select is((select total_reportes from public.zonas_publicas where celda = '2240_7617'), 2,
  'pendiente/resuelto/oculto/en_revision no cuentan: celda A total 2');
select is((select nivel from public.zonas_publicas where celda = '2240_7617'), 'bajo'::public.nivel_zona,
  '2 activos -> bajo');
select is((select nivel from public.zonas_publicas where celda = '2250_7617'), 'medio'::public.nivel_zona,
  '3 activos -> medio');
select is((select (total_reportes, nivel)::text from public.zonas_publicas where celda = '2260_7617'),
  '(6,alto)', '6 activos -> alto');
select is((select (alguno_no_pasan_carros, nivel)::text from public.zonas_publicas where celda = '2270_7617'),
  '(t,alto)', '1 activo sin paso de carros -> alto');
select is((select count(*) from public.zonas_publicas where celda in ('2250_7617', '2260_7617'))::int, 2,
  'reportes a > 1 km caen en celdas distintas');
select is((select string_agg(celda, ',' order by celda) from public.zonas_publicas
           where celda in ('2279_7617', '2280_7617')), '2279_7617,2280_7617',
  'reportes a 1 m de la frontera caen en celdas vecinas');
select is((select total_confirmaciones from public.zonas_publicas where celda = '2240_7617'), 2,
  'total_confirmaciones cuenta solo "sí"');
select is((select total_confirmaciones from public.zonas_publicas where celda = '2250_7617'), 0,
  'celda sin confirmaciones -> 0');
select ok((select abs(extract(epoch from (actualizado_en - (now() - interval '1 minute')))) < 1
           from public.zonas_publicas where celda = '2240_7617'),
  'actualizado_en = máx(coalesce(ultima_confirmacion, activado_en, creado_en))');
select ok((select bool_and(extensions.st_distance(
              public.punto(z.lat, z.lng),
              pg_temp.utm(672100, 2285200)) < 300 * sqrt(2))
           from public.zonas_publicas z where celda = '2240_7617'),
  'centro de celda a menos de tam*sqrt(2) del reporte');
select is((select concat(floor(extensions.st_x(p) / 300)::int, '_', floor(extensions.st_y(p) / 300)::int)
           from (select extensions.st_transform(public.punto(lat, lng)::extensions.geometry, 32613) p
                 from public.zonas_publicas where celda = '2240_7617') s),
  '2240_7617', 'centro de celda cae dentro de su celda');
reset role;

select hasnt_column('public', 'zonas_publicas', 'perfil_id', 'la vista no expone perfil_id');
select ok(public.dentro_de_zmg(
            (select lat from public.zonas_publicas where celda = '2240_7617'),
            (select lng from public.zonas_publicas where celda = '2240_7617')),
  'lat/lng no invertidos: el centro está en la ZMG');

-- Usuario con sesión
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.zonas_publicas)::int, 6, 'authenticated lee zonas_publicas');
select throws_ok($$ select perfil_id from public.zonas_publicas $$, '42703', null,
  'authenticated no puede pedir perfil_id a la vista');
reset role;

-- Los umbrales salen de parametros
update public.parametros set valor = 2 where clave = 'nivel_medio_min';
select is(public.nivel_para(2, false), 'medio'::public.nivel_zona, 'nivel_para respeta nivel_medio_min cambiado');
set local role anon;
select is((select nivel from public.zonas_publicas where celda = '2240_7617'), 'medio'::public.nivel_zona,
  'la vista respeta nivel_medio_min cambiado');
reset role;

select * from finish();
rollback;
