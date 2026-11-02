-- F3-T4: los refugios sin fuente verificable no aparecen en el mapa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

select has_table('public', 'refugios', 'existe tabla de refugios');
select has_view('public', 'refugios_publicos', 'existe vista pública');
select ok((select relrowsecurity from pg_class where oid = 'public.refugios'::regclass),
  'refugios tiene RLS');
select ok((select 'security_invoker=true' = any(reloptions) from pg_class
  where oid = 'public.refugios_publicos'::regclass), 'vista respeta RLS del lector');

insert into public.refugios (id, nombre, ubicacion, direccion, municipio, capacidad, fuente, verificado_en)
values
  ('10000000-0000-4000-8000-00000000009a', 'Refugio de prueba verificado',
   public.punto(20.6597, -103.3496), 'Dirección de prueba', 'Guadalajara', 20,
   'Fuente de prueba', now()),
  ('10000000-0000-4000-8000-00000000009b', 'Refugio de prueba sin verificar',
   public.punto(20.6600, -103.3500), 'Otra dirección de prueba', 'Guadalajara', null,
   'Fuente pendiente', null);

set local role anon;
select is((select count(*) from public.refugios_publicos)::int, 1,
  'el público solo ve refugios verificados');
select is((select nombre from public.refugios_publicos), 'Refugio de prueba verificado',
  'la vista contiene el refugio correcto');
select ok((select abs(lat - 20.6597) < 0.00001 from public.refugios_publicos),
  'lat se expone en WGS84');
select ok((select abs(lng - (-103.3496)) < 0.00001 from public.refugios_publicos),
  'lng se expone en WGS84');
select is((select count(*) from public.refugios)::int, 1,
  'la tabla también filtra un refugio sin verificar');
select throws_ok($$ insert into public.refugios
  (nombre, ubicacion, direccion, municipio, fuente)
  values ('Inventado', public.punto(20.65, -103.34), 'X', 'Guadalajara', 'X') $$,
  '42501', null, 'anon no puede publicar refugios');
reset role;

insert into auth.users (id, aud, role)
  values ('00000000-0000-0000-0000-00000000009a', 'authenticated', 'authenticated');
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000009a","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select is((select count(*) from public.refugios_publicos)::int, 1,
  'una sesión anónima solo ve la misma lista verificada');
select throws_ok($$ update public.refugios set verificado_en = now() $$,
  '42501', null, 'cliente no puede verificar refugios');
reset role;

select throws_ok($$ insert into public.refugios
  (nombre, ubicacion, direccion, municipio, capacidad, fuente, verificado_en)
  values ('Negativo', public.punto(20.65, -103.34), 'X', 'Guadalajara', -1, 'X', now()) $$,
  '23514', null, 'capacidad negativa se rechaza');
select throws_ok($$ insert into public.refugios
  (nombre, ubicacion, direccion, municipio, fuente, verificado_en)
  values ('Sin fuente', public.punto(20.65, -103.34), 'X', 'Guadalajara', ' ', now()) $$,
  '23514', null, 'fuente vacía se rechaza');
select is((select count(*) from public.refugios)::int, 2,
  'la base conserva el registro no verificado para revisión');

select * from finish();
rollback;
