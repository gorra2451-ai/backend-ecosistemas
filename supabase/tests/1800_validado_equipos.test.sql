-- D-021: contrato v2 validado por los equipos en el mid-fi (2026-11-10).
-- Gravedad, publicación por 5 confirmaciones, niveles por confirmaciones, mis_reportes,
-- moto, casos nuevos de derivación, video .mov y preferencias de avisos push.
begin;
create extension if not exists pgtap with schema extensions;
select plan(81);
-- D-022: el mid-fi sube estos parámetros por migración; esta prueba verifica la LÓGICA con los
-- valores normales, así que los fija dentro de su transacción (se revierte al final).
update public.parametros set valor = 1000 where clave = 'radio_cercanos_max_m';
update public.parametros set valor = 60   where clave = 'ventana_activacion_min';
update public.parametros set valor = 30   where clave = 'minutos_expiracion';

delete from public.reportes;          -- aislar de seed.sql (el rollback lo restaura)

-- Dueño (…a0), 25 personas más (…b01..…b25) para confirmar.
insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-0000000018a0', 'authenticated', 'authenticated');
insert into auth.users (id, aud, role)
select ('00000000-0000-0000-0000-000000018b' || lpad(g::text, 2, '0'))::uuid, 'authenticated', 'authenticated'
from generate_series(1, 25) g;

create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.u(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-000000018b' || lpad(n::text, 2, '0'))::uuid
$$;
grant execute on function pg_temp.como(uuid) to anon, authenticated;
grant execute on function pg_temp.u(integer) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Esquema y parámetros
-- -----------------------------------------------------------------------------
select enum_has_labels('public', 'gravedad_reporte', array['bloqueado', 'limitado', 'sin_riesgo'],
  'gravedad_reporte = bloqueado|limitado|sin_riesgo');
select col_is_null('public', 'reportes', 'gravedad', 'reportes.gravedad es opcional');
select enum_has_labels('public', 'nivel_zona', array['bajo', 'medio', 'alto', 'critico'],
  'nivel_zona suma critico (en orden)');
select enum_has_labels('public', 'medio_transporte',
  array['peaton', 'bici', 'moto', 'auto', 'transporte_publico'], 'medio_transporte suma moto');
select enum_has_labels('public', 'tipo_caso',
  array['casa', 'coche', 'persona_herida', 'tercero', 'otro', 'calle', 'arbol_caido', 'riesgo_electrico'],
  'tipo_caso suma calle, arbol_caido y riesgo_electrico');
select has_function('public', 'crear_reporte',
  array['uuid', 'public.tipo_reporte', 'boolean', 'double precision', 'double precision', 'integer',
        'public.gravedad_reporte'], 'crear_reporte acepta p_gravedad');
select hasnt_function('public', 'crear_reporte',
  array['uuid', 'public.tipo_reporte', 'boolean', 'double precision', 'double precision', 'integer'],
  'la firma vieja de crear_reporte ya no existe (sin ambigüedad)');
select is((select array_agg(valor order by clave) from public.parametros
           where clave in ('confirmaciones_para_publicar', 'nivel_bajo_min', 'nivel_medio_min',
                           'nivel_alto_min', 'nivel_critico_min')),
  array[5, 15, 5, 20, 10]::numeric[], 'parámetros de publicación y niveles (5/5/10/15/20)');
select ok((select bool_and(descripcion like 'OBSOLETO%') from public.parametros
           where clave = 'umbral_activacion'), 'umbral_activacion queda marcado obsoleto');

-- -----------------------------------------------------------------------------
-- crear_reporte con gravedad
-- -----------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000018a0');
set local role authenticated;
select is(public.crear_reporte('18000000-0000-4000-8000-000000000001', 'calle', null, 20.9000, -103.3000, 10, 'bloqueado'),
  '{"id": "18000000-0000-4000-8000-000000000001", "estado": "pendiente"}'::jsonb,
  'crear_reporte con gravedad y sin pasan_carros → pendiente');
select is(public.crear_reporte('18000000-0000-4000-8000-000000000001', 'calle', null, 20.9000, -103.3000, 10, 'bloqueado')
  ->> 'estado', 'pendiente', 'sigue idempotente por p_id');
select lives_ok($$ select public.crear_reporte('18000000-0000-4000-8000-000000000002', 'casa', null,
  20.9100, -103.3000, null, 'limitado') $$, 'limitado sin pasan_carros');
select lives_ok($$ select public.crear_reporte('18000000-0000-4000-8000-000000000003', 'calle', true,
  20.9200, -103.3000, null, 'bloqueado') $$, 'gravedad manda sobre pasan_carros');
select throws_ok($$ select public.crear_reporte(gen_random_uuid(), 'calle', null, 20.9300, -103.3000) $$,
  'P0001', 'parametros_invalidos', 'sin gravedad, pasan_carros sigue siendo obligatorio');
select lives_ok($$ select public.crear_reporte('18000000-0000-4000-8000-000000000004', 'coche', true,
  20.9300, -103.3000) $$, 'sin gravedad se comporta como v1');
select is(public.crear_reporte('18000000-0000-4000-8000-000000000005', 'persona_en_riesgo', null,
  20.9400, -103.3000, null, 'bloqueado') ->> 'estado', 'activo', 'persona_en_riesgo nace activo');
select throws_ok($$ select public.crear_reporte(gen_random_uuid(), 'calle', null, 25.0, -103.3, null, 'limitado') $$,
  'P0001', 'fuera_de_zmg', 'las validaciones de v1 se conservan');
reset role;
select is((select array_agg(row(pasan_carros, gravedad)::text order by id) from public.reportes
           where id in ('18000000-0000-4000-8000-000000000001', '18000000-0000-4000-8000-000000000002',
                        '18000000-0000-4000-8000-000000000003', '18000000-0000-4000-8000-000000000004')),
  array['(f,bloqueado)', '(t,limitado)', '(f,bloqueado)', '(t,)'],
  'pasan_carros se deduce de la gravedad (bloqueado → false; otros → true)');

-- -----------------------------------------------------------------------------
-- Regla vieja retirada: N reportes cercanos y "nace activo junto a activo" (P-01, P-15)
-- -----------------------------------------------------------------------------
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion)
select ('18100000-0000-4000-8000-0000000000' || lpad(g::text, 2, '0'))::uuid, pg_temp.u(g), 'calle', true,
       public.punto(20.8000 + g * 0.0001, -103.3000)
from generate_series(1, 6) g;
select is((select count(*)::int from public.reportes where id::text like '18100000-%' and estado = 'pendiente'), 6,
  '6 reportes cercanos de personas distintas ya NO activan (umbral_activacion obsoleto)');
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion) values
  ('18000000-0000-4000-8000-000000000006', pg_temp.u(7), 'calle', true, public.punto(20.94005, -103.3000));
select is((select estado::text from public.reportes where id = '18000000-0000-4000-8000-000000000006'), 'pendiente',
  'un reporte junto a un activo ya NO nace activo (P-15)');

-- -----------------------------------------------------------------------------
-- Publicación por confirmaciones (reporte …01, del dueño)
-- -----------------------------------------------------------------------------
select pg_temp.como(pg_temp.u(1));
set local role authenticated;
select is(public.confirmar_reporte('18000000-0000-4000-8000-000000000001', true) ->> 'estado', 'pendiente',
  'se puede confirmar un pendiente; 1 "sí" no lo publica');
reset role;
select pg_temp.como(pg_temp.u(2));
set local role authenticated;
select public.confirmar_reporte('18000000-0000-4000-8000-000000000001', true);
reset role;
select pg_temp.como(pg_temp.u(3));
set local role authenticated;
select public.confirmar_reporte('18000000-0000-4000-8000-000000000001', true);
reset role;
select pg_temp.como(pg_temp.u(4));
set local role authenticated;
select is(public.confirmar_reporte('18000000-0000-4000-8000-000000000001', false) ->> 'estado', 'pendiente',
  'un "no" no cuenta para publicar');
select is(public.confirmar_reporte('18000000-0000-4000-8000-000000000001', true) ->> 'estado', 'pendiente',
  '4 "sí" todavía no publican');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000018a0');
set local role authenticated;
select throws_ok($$ select public.confirmar_reporte('18000000-0000-4000-8000-000000000001', true) $$,
  'P0001', 'propio_reporte', 'el autor no confirma su pendiente');
reset role;
select pg_temp.como(pg_temp.u(5));
set local role authenticated;
select is(public.confirmar_reporte('18000000-0000-4000-8000-000000000001', true) ->> 'estado', 'activo',
  'el 5.º "sí" de otra persona lo publica');
reset role;
select ok((select activado_en is not null and ultima_confirmacion is not null from public.reportes
           where id = '18000000-0000-4000-8000-000000000001'), 'al publicarse se pone activado_en');
update public.reportes set estado = 'resuelto' where id = '18000000-0000-4000-8000-000000000004';
select pg_temp.como(pg_temp.u(1));
set local role authenticated;
select throws_ok($$ select public.confirmar_reporte('18000000-0000-4000-8000-000000000004', true) $$,
  'P0001', 'reporte_no_activo', 'un resuelto no se confirma');
reset role;

-- Pendiente sin 5 confirmaciones en ventana_activacion_min → resuelto.
update public.reportes set creado_en = now() - interval '61 minutes'
  where id = '18000000-0000-4000-8000-000000000002';
select public.expirar_reportes();
select is((select estado::text from public.reportes where id = '18000000-0000-4000-8000-000000000002'), 'resuelto',
  'pendiente que no junta confirmaciones en la ventana → resuelto');

-- -----------------------------------------------------------------------------
-- Niveles por confirmaciones "sí"
-- -----------------------------------------------------------------------------
select is(public.nivel_para(4, false), null::public.nivel_zona, 'nivel_para: <5 sin persona → sin nivel');
select is(public.nivel_para(5, false), 'bajo'::public.nivel_zona, 'nivel_para: 5 → bajo');
select is(public.nivel_para(9, false), 'bajo'::public.nivel_zona, 'nivel_para: 9 → bajo');
select is(public.nivel_para(10, false), 'medio'::public.nivel_zona, 'nivel_para: 10 → medio');
select is(public.nivel_para(15, false), 'alto'::public.nivel_zona, 'nivel_para: 15 → alto');
select is(public.nivel_para(20, false), 'critico'::public.nivel_zona, 'nivel_para: 20 → critico');
select is(public.nivel_para(0, true), 'alto'::public.nivel_zona, 'persona_en_riesgo con <5 → alto');
select is(public.nivel_para(25, true), 'critico'::public.nivel_zona, 'persona_en_riesgo con ≥20 → critico');

create temp table celdas_1800 as select
  public.celda_mapa(public.punto(20.9000, -103.3000)) as c01,
  public.celda_mapa(public.punto(20.9400, -103.3000)) as c05;
grant select on celdas_1800 to anon, authenticated;
-- Reporte …01 (activo, 5 sí): +5 sí → 10 → medio.
insert into public.confirmaciones (reporte_id, perfil_id, sigue)
select '18000000-0000-4000-8000-000000000001', pg_temp.u(g), true from generate_series(6, 10) g;
set local role anon;
select is((select (total_reportes, total_confirmaciones, nivel)::text from public.zonas_publicas
           where celda = (select c01 from celdas_1800)),
  '(1,10,medio)', 'zona: 10 "sí" en la celda → medio');
select is((select nivel from public.zonas_publicas
           where celda = (select c05 from celdas_1800)),
  'alto'::public.nivel_zona, 'zona con persona_en_riesgo sin confirmaciones → alto');
reset role;
-- +10 sí → 20 → critico.
insert into public.confirmaciones (reporte_id, perfil_id, sigue)
select '18000000-0000-4000-8000-000000000001', pg_temp.u(g), true from generate_series(11, 20) g;
set local role anon;
select is((select nivel from public.zonas_publicas
           where celda = (select c01 from celdas_1800)),
  'critico'::public.nivel_zona, 'zona: 20 "sí" → critico');
reset role;

-- -----------------------------------------------------------------------------
-- reportes_cercanos y reportes_activos_en_area
-- -----------------------------------------------------------------------------
select ok(pg_get_function_result('public.reportes_cercanos(double precision, double precision, integer)'::regprocedure)
  not like '%perfil_id%', 'reportes_cercanos no expone perfil_id');
select pg_temp.como(pg_temp.u(21));
set local role authenticated;
select is((select array_agg(estado::text order by distancia_m) from public.reportes_cercanos(20.8000, -103.3000, 1000)),
  array['pendiente', 'pendiente', 'pendiente', 'pendiente', 'pendiente', 'pendiente'],
  'reportes_cercanos incluye pendientes de otros para confirmarlos');
select is((select row(gravedad, confirmaciones_si, nivel, estado, es_propio, creado_en is not null)::text
           from public.reportes_cercanos(20.9000, -103.3000, 100)
           where id = '18000000-0000-4000-8000-000000000001'),
  '(bloqueado,20,critico,activo,f,t)', 'reportes_cercanos devuelve gravedad, confirmaciones_si, nivel, estado y creado_en');
select is((select row(confirmaciones_si, nivel)::text from public.reportes_cercanos(20.8000, -103.3000, 100)
           order by distancia_m limit 1),
  '(0,)', 'un pendiente no tiene nivel');
reset role;
set local role anon;
select is((select row(gravedad, confirmaciones_si, nivel)::text
           from public.reportes_activos_en_area(20.89, -103.31, 20.95, -103.29)
           where id = '18000000-0000-4000-8000-000000000001'),
  '(bloqueado,20,critico)', 'reportes_activos_en_area añade gravedad, confirmaciones_si y nivel');
select is((select count(*)::int from public.reportes_activos_en_area(20.79, -103.31, 20.81, -103.29)), 0,
  'reportes_activos_en_area sigue sin pendientes');
select is((select nivel from public.reportes_activos_en_area(20.89, -103.31, 20.95, -103.29)
           where id = '18000000-0000-4000-8000-000000000005'),
  'alto'::public.nivel_zona, 'persona_en_riesgo activa sin confirmaciones → nivel alto');
reset role;

-- -----------------------------------------------------------------------------
-- mis_reportes
-- -----------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.mis_reportes() $$, '42501', null, 'anon no ejecuta mis_reportes');
reset role;
select ok(pg_get_function_result('public.mis_reportes()'::regprocedure) not like '%perfil_id%',
  'mis_reportes no expone perfil_id');
select pg_temp.como('00000000-0000-0000-0000-0000000018a0');
set local role authenticated;
select is((select count(*)::int from public.mis_reportes()), 5, 'mis_reportes devuelve los del usuario');
select is((select row(gravedad, estado, confirmaciones_si, confirmaciones_no, marcas_falso, nivel)::text
           from public.mis_reportes() where id = '18000000-0000-4000-8000-000000000001'),
  '(bloqueado,activo,20,0,0,critico)', 'mis_reportes trae conteos y nivel');
reset role;
select pg_temp.como(pg_temp.u(21));
set local role authenticated;
select is((select count(*)::int from public.mis_reportes()), 0, 'otro usuario no ve reportes ajenos');
reset role;
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, estado, creado_en)
select gen_random_uuid(), '00000000-0000-0000-0000-0000000018a0', 'calle', true,
       public.punto(20.40 + g * 0.002, -103.60), 'resuelto', now() - make_interval(days => g)
from generate_series(1, 20) g;
select pg_temp.como('00000000-0000-0000-0000-0000000018a0');
set local role authenticated;
select is((select count(*)::int from public.mis_reportes()), 20, 'mis_reportes devuelve máximo 20');
select ok((select bool_and(creado_en > now() - interval '2 hours')
           from (select creado_en from public.mis_reportes() limit 5) s), 'mis_reportes: más recientes primero');
reset role;

-- -----------------------------------------------------------------------------
-- Registro: moto
-- -----------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000018a0');
set local role authenticated;
select lives_ok($$ select public.registrar_entrada('moto') $$, 'registrar_entrada acepta moto');
reset role;

-- -----------------------------------------------------------------------------
-- Derivación: casos nuevos
-- -----------------------------------------------------------------------------
set local role anon;
select ok((public.derivar('riesgo_electrico', 'Guadalajara', 20.6597, -103.3496) -> 'pasos')::text
  like '%CFE al 071%', 'riesgo_electrico: reporta a CFE al 071');
select ok((public.derivar('riesgo_electrico', 'Guadalajara', 20.6597, -103.3496) -> 'pasos')::text
  like '%10 m%', 'riesgo_electrico: alejarse 10 m de cables');
select ok((public.derivar('arbol_caido', 'Guadalajara', 20.6597, -103.3496) -> 'pasos')::text
  like '%911%', 'arbol_caido: Protección Civil por el 911');
select ok((public.derivar('calle', 'Guadalajara', 20.6597, -103.3496) -> 'pasos')::text
  like '%rodilla%', 'calle: no cruzar si pasa de la rodilla');
reset role;

-- -----------------------------------------------------------------------------
-- Evidencias: video .mov
-- -----------------------------------------------------------------------------
-- PR #14: video deshabilitado TEMPORALMENTE (20261110195640, ver 2100_evidencias_sin_video).
select ok(not (select 'video/quicktime' = any(allowed_mime_types) from storage.buckets where id = 'evidencias'),
  'el bucket ya no acepta video/quicktime (temporal, PR #14)');
insert into storage.objects (bucket_id, name, owner_id, metadata) values
  ('evidencias', '18000000-0000-4000-8000-000000000003/28000000-0000-4000-8000-000000000001.mov',
   '00000000-0000-0000-0000-0000000018a0', '{"mimetype":"video/quicktime","size":1000}'),
  ('evidencias', '18000000-0000-4000-8000-000000000003/28000000-0000-4000-8000-000000000002.mov',
   '00000000-0000-0000-0000-0000000018a0', '{"mimetype":"video/mp4","size":1000}');
select pg_temp.como('00000000-0000-0000-0000-0000000018a0');
set local role authenticated;
select ok(public.puede_subir_evidencia(
  '18000000-0000-4000-8000-000000000003/28000000-0000-4000-8000-000000000003.mov'), 'Storage permite subir .mov');
select throws_ok($$ select public.agregar_evidencia('18000000-0000-4000-8000-000000000003',
  '18000000-0000-4000-8000-000000000003/28000000-0000-4000-8000-000000000001.mov', 'video') $$,
  'P0001', 'video_deshabilitado', '.mov con video/quicktime se rechaza (temporal, PR #14)');
select throws_ok($$ select public.agregar_evidencia('18000000-0000-4000-8000-000000000003',
  '18000000-0000-4000-8000-000000000003/28000000-0000-4000-8000-000000000002.mov', 'video') $$,
  'P0001', 'tipo_archivo_invalido', '.mov con otro MIME se rechaza');
select throws_ok($$ select public.agregar_evidencia('18000000-0000-4000-8000-000000000003',
  '18000000-0000-4000-8000-000000000003/28000000-0000-4000-8000-000000000001.mov', 'foto') $$,
  'P0001', 'tipo_archivo_invalido', '.mov no se registra como foto');
reset role;

-- -----------------------------------------------------------------------------
-- Preferencias push
-- -----------------------------------------------------------------------------
select has_column('public', 'suscripciones_push', 'solo_cambios', 'suscripciones_push.solo_cambios');
select has_column('public', 'suscripciones_push', 'solo_fuertes', 'suscripciones_push.solo_fuertes');
select has_column('public', 'suscripciones_push', 'silenciado_hasta', 'suscripciones_push.silenciado_hasta');

-- Celdas de prueba (lejos del resto): C1 = 20.70,-103.60 · C2 = 20.72,-103.60 · C3 = 20.74,-103.60
insert into public.suscripciones_push (id, perfil_id, endpoint, p256dh, auth, celda, municipio) values
  ('28000000-0000-4000-8000-0000000000a1', pg_temp.u(21), 'https://fcm.googleapis.com/fcm/send/18a1',
   repeat('A', 87), repeat('B', 22), public.celda_mapa(public.punto(20.70, -103.60)), null),
  ('28000000-0000-4000-8000-0000000000a2', pg_temp.u(22), 'https://fcm.googleapis.com/fcm/send/18a2',
   repeat('A', 87), repeat('B', 22), public.celda_mapa(public.punto(20.70, -103.60)), null),
  ('28000000-0000-4000-8000-0000000000a3', pg_temp.u(23), 'https://fcm.googleapis.com/fcm/send/18a3',
   repeat('A', 87), repeat('B', 22), public.celda_mapa(public.punto(20.70, -103.60)), null),
  ('28000000-0000-4000-8000-0000000000a4', pg_temp.u(23), 'https://fcm.googleapis.com/fcm/send/18a4',
   repeat('A', 87), repeat('B', 22), public.celda_mapa(public.punto(20.72, -103.60)), null),
  ('28000000-0000-4000-8000-0000000000a5', pg_temp.u(24), 'https://fcm.googleapis.com/fcm/send/18a5',
   repeat('A', 87), repeat('B', 22), public.celda_mapa(public.punto(20.74, -103.60)), null),
  ('28000000-0000-4000-8000-0000000000a6', pg_temp.u(24), 'https://fcm.googleapis.com/fcm/send/18a6',
   repeat('A', 87), repeat('B', 22), null, 'zapopan'),
  ('28000000-0000-4000-8000-0000000000a7', pg_temp.u(25), 'https://fcm.googleapis.com/fcm/send/18a7',
   repeat('A', 87), repeat('B', 22), null, 'zapopan');

set local role anon;
select throws_ok($$ select public.preferencias_push('https://fcm.googleapis.com/fcm/send/18a1', true, false, 0) $$,
  '42501', null, 'anon no ejecuta preferencias_push');
reset role;
select pg_temp.como(pg_temp.u(22));
set local role authenticated;
select throws_ok($$ select public.preferencias_push('https://fcm.googleapis.com/fcm/send/18a1', true, true, 60) $$,
  'P0001', 'suscripcion_no_existe', 'no se cambian preferencias de una suscripción ajena');
select throws_ok($$ select public.preferencias_push('https://fcm.googleapis.com/fcm/send/18a2', true, true, -1) $$,
  'P0001', 'parametros_invalidos', 'silenciar con minutos negativos → parametros_invalidos');
select ok((select (r ->> 'solo_cambios')::boolean and not (r ->> 'solo_fuertes')::boolean
            and (r ->> 'silenciado_hasta')::timestamptz between now() + interval '59 minutes' and now() + interval '61 minutes'
           from (select public.preferencias_push('https://fcm.googleapis.com/fcm/send/18a2', true, false, 60) r) s),
  'preferencias_push devuelve {solo_cambios, solo_fuertes, silenciado_hasta}');
reset role;
select pg_temp.como(pg_temp.u(23));
set local role authenticated;
select is(public.preferencias_push('https://fcm.googleapis.com/fcm/send/18a3', false, true, 0) ->> 'silenciado_hasta',
  null, 'silenciar 0 min quita el silencio');
select lives_ok($$ select public.preferencias_push('https://fcm.googleapis.com/fcm/send/18a4', false, true, 0) $$,
  'el dueño cambia otra de sus suscripciones');
reset role;
select pg_temp.como(pg_temp.u(24));
set local role authenticated;
select lives_ok($$ select public.preferencias_push('https://fcm.googleapis.com/fcm/send/18a6', false, true, 0) $$,
  'solo_fuertes en suscripción por municipio');
reset role;

-- C1: zona se activa en nivel bajo (5 "sí"). a1 normal lo recibe; a2 silenciada y a3 solo_fuertes no.
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion) values
  ('18000000-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-0000000018a0', 'calle', true,
   public.punto(20.70, -103.60));
insert into public.confirmaciones (reporte_id, perfil_id, sigue)
select '18000000-0000-4000-8000-0000000000c1', pg_temp.u(g), true from generate_series(1, 4) g;
select pg_temp.como(pg_temp.u(5));
set local role authenticated;
select is(public.confirmar_reporte('18000000-0000-4000-8000-0000000000c1', true) ->> 'estado', 'activo',
  'la zona se activa por confirmaciones');
reset role;
select is((select array_agg(suscripcion_id::text order by suscripcion_id) from public.avisos_push
           where celda = public.celda_mapa(public.punto(20.70, -103.60))),
  array['28000000-0000-4000-8000-0000000000a1'],
  'zona_activada por confirmaciones encola; salta silenciada y solo_fuertes (zona bajo)');
-- C2: persona_en_riesgo (nivel alto) sí llega a solo_fuertes.
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion) values
  ('18000000-0000-4000-8000-0000000000c2', '00000000-0000-0000-0000-0000000018a0', 'persona_en_riesgo', false,
   public.punto(20.72, -103.60));
select is((select count(*)::int from public.avisos_push
           where suscripcion_id = '28000000-0000-4000-8000-0000000000a4' and tipo = 'zona_activada'), 1,
  'solo_fuertes recibe zona alto');
-- C3: aviso ya encolado, luego se silencia: el procesador no lo entrega.
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, estado, activado_en) values
  ('18000000-0000-4000-8000-0000000000c3', '00000000-0000-0000-0000-0000000018a0', 'calle', true,
   public.punto(20.74, -103.60), 'activo', now());
select is((select count(*)::int from public.avisos_push
           where suscripcion_id = '28000000-0000-4000-8000-0000000000a5'), 1, 'aviso encolado antes de silenciar');
update public.suscripciones_push set silenciado_hasta = now() + interval '1 hour'
  where id = '28000000-0000-4000-8000-0000000000a5';

-- Clima en Zapopan: medio no llega a solo_fuertes (a6); alto sí.
insert into public.alertas_clima (id, fuente, fuente_url, nivel, titulo, descripcion,
  municipio, vigente_desde, vigente_hasta, verificado_en) values
  ('38000000-0000-4000-8000-000000000001', 'Fuente de prueba', 'https://example.org/18-1', 'medio',
   'Aviso medio de prueba', 'Simulado', 'Zapopan', now() - interval '1 hour', now() + interval '1 hour', now());
select private.encolar_alertas_clima_vigentes();
select is((select array_agg(suscripcion_id::text order by suscripcion_id) from public.avisos_push
           where alerta_clima_id = '38000000-0000-4000-8000-000000000001'),
  array['28000000-0000-4000-8000-0000000000a7'], 'clima medio no se encola a solo_fuertes');
insert into public.alertas_clima (id, fuente, fuente_url, nivel, titulo, descripcion,
  municipio, vigente_desde, vigente_hasta, verificado_en) values
  ('38000000-0000-4000-8000-000000000002', 'Fuente de prueba', 'https://example.org/18-2', 'alto',
   'Aviso alto de prueba', 'Simulado', 'Zapopan', now() - interval '1 hour', now() + interval '1 hour', now());
select private.encolar_alertas_clima_vigentes();
select is((select count(*)::int from public.avisos_push
           where alerta_clima_id = '38000000-0000-4000-8000-000000000002'
             and suscripcion_id = '28000000-0000-4000-8000-0000000000a6'), 1, 'clima alto sí llega a solo_fuertes');

-- Un aviso débil que quedó en cola y luego la suscripción pasa a solo_fuertes: se descarta.
update public.suscripciones_push set solo_fuertes = true where id = '28000000-0000-4000-8000-0000000000a7';
set local role service_role;
create temp table tomados_1800 as select * from public.tomar_avisos_push(20);
reset role;
select is((select array_agg(t.suscripcion_id::text order by t.suscripcion_id) from tomados_1800 t
           join public.avisos_push a using (id)),
  array['28000000-0000-4000-8000-0000000000a1', '28000000-0000-4000-8000-0000000000a4',
        '28000000-0000-4000-8000-0000000000a6'],
  'tomar_avisos_push salta silenciadas y, con solo_fuertes, lo que no es alto/critico');
select is((select array_agg(estado::text order by suscripcion_id) from public.avisos_push
           where suscripcion_id in ('28000000-0000-4000-8000-0000000000a5', '28000000-0000-4000-8000-0000000000a7')),
  array['fallido', 'fallido'], 'los avisos saltados se descartan (no se entregan tarde)');

select * from finish();
rollback;
