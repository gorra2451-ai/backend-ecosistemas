-- F4-T3: solo alertas verificadas y vigentes; carga privada y avisos municipales.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);
select has_table('public', 'alertas_clima', 'existe catálogo climático');
select has_view('public', 'alertas_clima_vigentes', 'existe vista vigente');
select ok((select relrowsecurity from pg_class where oid = 'public.alertas_clima'::regclass),
  'RLS activo');
select ok((select 'security_invoker=true' = any(reloptions) from pg_class
  where oid = 'public.alertas_clima_vigentes'::regclass), 'vista respeta RLS');
select ok(exists(select 1 from cron.job where jobname = 'encolar-alertas-clima'),
  'carga de avisos programada');

insert into public.alertas_clima (id, fuente, fuente_url, nivel, titulo, descripcion,
  municipio, vigente_desde, vigente_hasta, verificado_en) values
  ('30000000-0000-4000-8000-00000000012a', 'Fuente de prueba',
   'https://example.org/alerta-1', 'alto', 'Aviso de prueba vigente',
   'Aviso simulado que solo vive en esta transacción', 'Guadalajara',
   now()-interval '1 hour', now()+interval '1 hour', now()),
  ('30000000-0000-4000-8000-00000000012b', 'Fuente de prueba',
   'https://example.org/alerta-2', 'bajo', 'Aviso sin verificar',
   'Aviso simulado que no debe publicarse', 'Guadalajara',
   now()-interval '1 hour', now()+interval '1 hour', null),
  ('30000000-0000-4000-8000-00000000012c', 'Fuente de prueba',
   'https://example.org/alerta-3', 'medio', 'Aviso expirado',
   'Aviso simulado que ya terminó', 'Guadalajara',
   now()-interval '2 hours', now()-interval '1 hour', now()),
  ('30000000-0000-4000-8000-00000000012d', 'Fuente de prueba',
   'https://example.org/alerta-4', 'medio', 'Aviso futuro',
   'Aviso simulado que todavía no empieza', 'Guadalajara',
   now()+interval '1 hour', now()+interval '2 hours', now());

set local role anon;
select is((select count(*) from public.alertas_clima_vigentes)::int, 1,
  'público ve solo verificada y vigente');
select is((select count(*) from public.alertas_clima)::int, 1,
  'lectura directa tiene el mismo filtro');
select throws_ok($$ insert into public.alertas_clima
  (fuente, fuente_url, nivel, titulo, descripcion, municipio, vigente_desde, vigente_hasta)
  values ('X', 'https://example.org/x', 'bajo', 'X', 'X', 'Guadalajara', now(), now()+interval '1 hour') $$,
  '42501', null, 'anon no puede cargar alertas');
reset role;
set local role authenticated;
select throws_ok($$ update public.alertas_clima set verificado_en = now() $$,
  '42501', null, 'cliente no puede verificar');
reset role;

select throws_ok($$ insert into public.alertas_clima
  (fuente, fuente_url, nivel, titulo, descripcion, municipio, vigente_desde, vigente_hasta)
  values ('Fuente', 'http://example.org/x', 'bajo', 'Titulo', 'Descripción',
    'Guadalajara', now(), now()+interval '1 hour') $$,
  '23514', null, 'fuente debe ser HTTPS');
select throws_ok($$ insert into public.alertas_clima
  (fuente, fuente_url, nivel, titulo, descripcion, municipio, vigente_desde, vigente_hasta)
  values ('Fuente', 'https://example.org/x', 'bajo', 'Titulo', 'Descripción',
    'Guadalajara', now(), now()-interval '1 hour') $$,
  '23514', null, 'vigencia debe tener fin posterior');

insert into auth.users (id, aud, role)
  values ('00000000-0000-0000-0000-00000000012a', 'authenticated', 'authenticated');
insert into public.suscripciones_push
  (id, perfil_id, endpoint, p256dh, auth, municipio) values
  ('20000000-0000-4000-8000-00000000012a',
   '00000000-0000-0000-0000-00000000012a', 'https://fcm.googleapis.com/fcm/send/12a',
   repeat('A',87), repeat('B',22), 'guadalajara');
select is(private.encolar_alertas_clima_vigentes(), 1, 'solo aviso vigente encola');
select is(private.encolar_alertas_clima_vigentes(), 0, 'escáner repetido es idempotente');
select is((select count(*) from public.avisos_push where tipo='clima')::int, 1,
  'una entrega climática');
select is((select municipio from public.avisos_push where tipo='clima'),
  'guadalajara', 'entrega queda ligada a municipio');
select is((select count(*) from public.avisos_push where celda is not null
  and tipo='clima')::int, 0, 'clima no inventa celda');
select * from finish();
rollback;
