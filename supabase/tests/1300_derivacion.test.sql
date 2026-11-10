-- F4-T4: solo contactos verificados del caso/municipio y refugios cercanos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);
select has_table('public', 'instituciones', 'catálogo de instituciones');
select has_view('public', 'instituciones_publicas', 'vista pública');
select has_function('public', 'derivar',
  array['public.tipo_caso','text','double precision','double precision'], 'RPC de orientación');
select ok((select relrowsecurity from pg_class where oid='public.instituciones'::regclass),
  'instituciones tiene RLS');
select ok((select 'security_invoker=true' = any(reloptions) from pg_class
  where oid='public.instituciones_publicas'::regclass), 'vista respeta RLS');

insert into public.instituciones
  (id, nombre, tipos_caso, telefono, municipio, fuente, verificado_en) values
  ('40000000-0000-4000-8000-00000000013a', 'Institución simulada apta',
   array['casa','otro']::public.tipo_caso[], '12345678', 'Guadalajara',
   'Fuente simulada en prueba', now()),
  ('40000000-0000-4000-8000-00000000013b', 'Institución simulada oculta',
   array['casa']::public.tipo_caso[], '12345678', 'Guadalajara',
   'Fuente simulada en prueba', null),
  ('40000000-0000-4000-8000-00000000013c', 'Institución simulada otro caso',
   array['coche']::public.tipo_caso[], '12345678', 'Guadalajara',
   'Fuente simulada en prueba', now()),
  ('40000000-0000-4000-8000-00000000013d', 'Institución simulada otro municipio',
   array['casa']::public.tipo_caso[], '12345678', 'Zapopan',
   'Fuente simulada en prueba', now());
insert into public.refugios
  (id, nombre, ubicacion, direccion, municipio, fuente, verificado_en) values
  ('50000000-0000-4000-8000-00000000013a', 'Refugio cercano simulado',
   public.punto(20.66,-103.35), 'Dirección simulada', 'Guadalajara',
   'Fuente simulada', now()),
  ('50000000-0000-4000-8000-00000000013b', 'Refugio sin verificar simulado',
   public.punto(20.661,-103.351), 'Dirección simulada', 'Guadalajara',
   'Fuente simulada', null),
  ('50000000-0000-4000-8000-00000000013c', 'Refugio lejano simulado',
   public.punto(21.6,-104.0), 'Dirección simulada', 'Otro',
   'Fuente simulada', now());

set local role anon;
select is((select count(*) from public.instituciones_publicas)::int, 3,
  'la vista excluye no verificados');
select is((select count(*) from public.instituciones)::int, 3,
  'RLS excluye no verificados en tabla');
select throws_ok($$ insert into public.instituciones
  (nombre, tipos_caso, telefono, municipio, fuente)
  values ('No autorizado', array['casa']::public.tipo_caso[], '12345678',
    'Guadalajara', 'Fuente simulada') $$, '42501', null,
  'anon no puede publicar contactos');
select is(jsonb_array_length((public.derivar('casa','GUADALAJARA',
  20.6597,-103.3496)->'instituciones'))::int, 1,
  'derivación filtra caso y municipio sin distinguir mayúsculas');
select is(public.derivar('casa','Guadalajara',20.6597,-103.3496)
  #>> '{instituciones,0,nombre}', 'Institución simulada apta',
  'devuelve contacto verificado correcto');
select is(jsonb_array_length(public.derivar('casa','Guadalajara',
  20.6597,-103.3496)->'refugios')::int, 1,
  'solo refugio cercano verificado');
select is(public.derivar('casa','Guadalajara',20.6597,-103.3496)
  #>> '{refugios,0,nombre}', 'Refugio cercano simulado', 'refugio correcto');
select is(jsonb_array_length(public.derivar('persona_herida','Guadalajara',
  20.6597,-103.3496)->'instituciones')::int, 0,
  'sin coincidencia devuelve lista vacía');
select ok(jsonb_array_length(public.derivar('persona_herida','Guadalajara',
  20.6597,-103.3496)->'pasos') > 0, 'devuelve orientación general');
select throws_ok($$ select public.derivar('casa','',20.65,-103.35) $$,
  'P0001', 'parametros_invalidos', 'municipio vacío se rechaza');
select throws_ok($$ select public.derivar('casa','Guadalajara',99,-103.35) $$,
  'P0001', 'parametros_invalidos', 'latitud inválida se rechaza');
reset role;

select throws_ok($$ insert into public.instituciones
  (nombre, tipos_caso, municipio, fuente)
  values ('Sin contacto', array['casa']::public.tipo_caso[], 'Guadalajara',
    'Fuente simulada') $$, '23514', null, 'debe tener contacto');
select throws_ok($$ insert into public.instituciones
  (nombre, tipos_caso, url, municipio, fuente)
  values ('URL insegura', array['casa']::public.tipo_caso[], 'http://example.org',
    'Guadalajara', 'Fuente simulada') $$, '23514', null, 'URL de contacto exige HTTPS');
select is((select count(*) from public.instituciones)::int, 4,
  'las pruebas no alteraron catálogo fuera de la transacción');
select * from finish();
rollback;
