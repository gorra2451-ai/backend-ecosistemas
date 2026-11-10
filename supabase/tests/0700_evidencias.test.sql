-- F2-T4: bucket privado, autoría del reporte, registro de archivos y RLS.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-00000000007a', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000007b', 'authenticated', 'authenticated');
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, estado) values
  ('10000000-0000-4000-8000-00000000007a', '00000000-0000-0000-0000-00000000007a',
   'calle', false, public.punto(20.6597, -103.3496), 'pendiente'),
  ('10000000-0000-4000-8000-00000000007b', '00000000-0000-0000-0000-00000000007b',
   'calle', false, public.punto(20.90, -103.10), 'activo');

select has_table('public', 'evidencias', 'existe la tabla evidencias');
select ok((select relrowsecurity from pg_class where oid = 'public.evidencias'::regclass), 'evidencias tiene RLS');
select is((select count(*) from storage.buckets where id = 'evidencias' and not public)::int,
  1, 'bucket privado creado');
select is((select file_size_limit from storage.buckets where id = 'evidencias')::bigint,
  10485760::bigint, 'bucket limita el tamaño por archivo');
select is((select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
  and policyname = 'evidencias_subir_autor')::int, 1, 'Storage solo abre inserción con política propia');
select is((select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
  and policyname = 'evidencias_leer_autorizados')::int, 1, 'Storage tiene política de lectura restringida');

set local role anon;
select throws_ok($$ select public.agregar_evidencia('10000000-0000-4000-8000-00000000007a',
  '10000000-0000-4000-8000-00000000007a/20000000-0000-4000-8000-00000000007a.png', 'foto') $$,
  '42501', null, 'sin sesión no ejecuta la RPC');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000007a","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select ok(public.es_autor_reporte('10000000-0000-4000-8000-00000000007a'), 'identifica reporte propio');
select ok(not public.es_autor_reporte('10000000-0000-4000-8000-00000000007b'), 'no identifica reporte ajeno');
select ok(public.puede_subir_evidencia(
  '10000000-0000-4000-8000-00000000007a/20000000-0000-4000-8000-00000000007a.png'),
  'permite ruta válida de reporte propio');
select ok(not public.puede_subir_evidencia('../otro.png'), 'rechaza ruta escapada');
select ok(not public.puede_subir_evidencia(
  '10000000-0000-4000-8000-00000000007b/20000000-0000-4000-8000-00000000007a.png'),
  'rechaza carpeta de reporte ajeno');
select throws_ok($$ select public.agregar_evidencia('10000000-0000-4000-8000-00000000007b',
  '10000000-0000-4000-8000-00000000007b/20000000-0000-4000-8000-00000000007a.png', 'foto') $$,
  'P0001', 'reporte_no_autorizado', 'no registra evidencia en reporte ajeno');
select throws_ok($$ select public.agregar_evidencia('10000000-0000-4000-8000-00000000007a',
  '../otro.png', 'foto') $$,
  'P0001', 'parametros_invalidos', 'rechaza ruta malformada');
select throws_ok($$ select public.agregar_evidencia('10000000-0000-4000-8000-00000000007a',
  '10000000-0000-4000-8000-00000000007a/20000000-0000-4000-8000-00000000007a.png', null) $$,
  'P0001', 'parametros_invalidos', 'rechaza tipo nulo');
select throws_ok($$ select public.agregar_evidencia('10000000-0000-4000-8000-00000000007a',
  '10000000-0000-4000-8000-00000000007a/20000000-0000-4000-8000-00000000007a.png', 'foto') $$,
  'P0001', 'archivo_no_existe', 'no registra archivo ausente');
select throws_ok($$ insert into public.evidencias (reporte_id, ruta_storage, tipo)
  values ('10000000-0000-4000-8000-00000000007a', 'x', 'foto') $$,
  '42501', null, 'cliente no inserta metadatos directamente');
reset role;

-- Solo metadatos de prueba, dentro de una transacción que se deshace al final.
insert into storage.objects (bucket_id, name, owner_id, metadata) values
  ('evidencias', '10000000-0000-4000-8000-00000000007a/20000000-0000-4000-8000-00000000007a.png',
   '00000000-0000-0000-0000-00000000007a', '{"mimetype":"image/png","size":1000}'),
  ('evidencias', '10000000-0000-4000-8000-00000000007a/20000000-0000-4000-8000-00000000007c.png',
   '00000000-0000-0000-0000-00000000007a', '{"mimetype":"image/png"}'),
  ('evidencias', '10000000-0000-4000-8000-00000000007a/20000000-0000-4000-8000-00000000007d.png',
   '00000000-0000-0000-0000-00000000007a', '{"mimetype":"application/pdf","size":1000}');

set local role authenticated;
select throws_ok($$ select public.agregar_evidencia('10000000-0000-4000-8000-00000000007a',
  '10000000-0000-4000-8000-00000000007a/20000000-0000-4000-8000-00000000007c.png', 'foto') $$,
  'P0001', 'archivo_invalido', 'rechaza metadatos sin tamaño');
select throws_ok($$ select public.agregar_evidencia('10000000-0000-4000-8000-00000000007a',
  '10000000-0000-4000-8000-00000000007a/20000000-0000-4000-8000-00000000007d.png', 'foto') $$,
  'P0001', 'tipo_archivo_invalido', 'rechaza MIME que no corresponde');
select throws_ok($$ select public.agregar_evidencia('10000000-0000-4000-8000-00000000007a',
  '10000000-0000-4000-8000-00000000007a/20000000-0000-4000-8000-00000000007a.png', 'video') $$,
  'P0001', 'tipo_archivo_invalido', 'no registra una foto como video');
select throws_ok($$ select public.agregar_evidencia('10000000-0000-4000-8000-00000000007a',
  '10000000-0000-4000-8000-00000000007b/20000000-0000-4000-8000-00000000007a.png', 'foto') $$,
  'P0001', 'parametros_invalidos', 'ruta debe pertenecer al reporte indicado');
select lives_ok($$ select public.agregar_evidencia('10000000-0000-4000-8000-00000000007a',
  '10000000-0000-4000-8000-00000000007a/20000000-0000-4000-8000-00000000007a.png', 'foto') $$,
  'autor registra archivo válido ya subido');
select is((select count(*) from public.evidencias)::int, 1, 'autor ve su evidencia pendiente');
select lives_ok($$ select public.agregar_evidencia('10000000-0000-4000-8000-00000000007a',
  '10000000-0000-4000-8000-00000000007a/20000000-0000-4000-8000-00000000007a.png', 'foto') $$,
  'reintento con mismo archivo es idempotente');
select is((select count(*) from public.evidencias)::int, 1, 'reintento no duplica');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000007b","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select is((select count(*) from public.evidencias)::int, 0, 'otro usuario no ve evidencia pendiente');
reset role;
set local role anon;
select is((select count(*) from public.evidencias)::int, 0, 'público no ve evidencia pendiente');
reset role;
update public.reportes set estado = 'activo' where id = '10000000-0000-4000-8000-00000000007a';
set local role anon;
select is((select count(*) from public.evidencias)::int, 1, 'público ve evidencia de reporte activo');
reset role;

select * from finish();
rollback;
