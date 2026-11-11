-- PR #14 (revisión, bug B): TEMPORAL hasta limpiar metadatos (GPS) de los videos.
-- El bucket solo acepta imágenes y agregar_evidencia rechaza videos con video_deshabilitado.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-0000000021a0', 'authenticated', 'authenticated');
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, estado) values
  ('21000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000021a0',
   'calle', false, public.punto(20.6597, -103.3496), 'pendiente');
-- Objetos ya en Storage (subidos antes del cambio o con MIME de video).
insert into storage.objects (bucket_id, name, owner_id, metadata) values
  ('evidencias', '21000000-0000-4000-8000-000000000001/31000000-0000-4000-8000-000000000001.mov',
   '00000000-0000-0000-0000-0000000021a0', '{"mimetype":"video/quicktime","size":1000}'),
  ('evidencias', '21000000-0000-4000-8000-000000000001/31000000-0000-4000-8000-000000000002.mp4',
   '00000000-0000-0000-0000-0000000021a0', '{"mimetype":"video/mp4","size":1000}'),
  ('evidencias', '21000000-0000-4000-8000-000000000001/31000000-0000-4000-8000-000000000003.webm',
   '00000000-0000-0000-0000-0000000021a0', '{"mimetype":"video/webm","size":1000}'),
  ('evidencias', '21000000-0000-4000-8000-000000000001/31000000-0000-4000-8000-000000000004.jpg',
   '00000000-0000-0000-0000-0000000021a0', '{"mimetype":"image/jpeg","size":1000}');

select is((select allowed_mime_types from storage.buckets where id = 'evidencias'),
  array['image/jpeg', 'image/png', 'image/webp']::text[],
  'el bucket evidencias solo acepta imágenes (sin video/*)');

select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000021a0', 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok($$ select public.agregar_evidencia('21000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001/31000000-0000-4000-8000-000000000001.mov', 'video') $$,
  'P0001', 'video_deshabilitado', 'agregar_evidencia rechaza .mov');
select throws_ok($$ select public.agregar_evidencia('21000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001/31000000-0000-4000-8000-000000000002.mp4', 'video') $$,
  'P0001', 'video_deshabilitado', 'agregar_evidencia rechaza .mp4');
select throws_ok($$ select public.agregar_evidencia('21000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001/31000000-0000-4000-8000-000000000003.webm', 'video') $$,
  'P0001', 'video_deshabilitado', 'agregar_evidencia rechaza .webm');
select lives_ok($$ select public.agregar_evidencia('21000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001/31000000-0000-4000-8000-000000000004.jpg', 'foto') $$,
  'las fotos se siguen registrando');
reset role;
select is((select count(*)::int from public.evidencias
           where reporte_id = '21000000-0000-4000-8000-000000000001' and tipo = 'video'), 0,
  'no queda ningún video registrado');

select * from finish();
rollback;
