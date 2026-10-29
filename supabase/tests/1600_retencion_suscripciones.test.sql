-- P-26: una suscripción caduca por la última renovación o entrega exitosa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select is((select valor from public.parametros where clave='max_entradas_por_hora'),
  20::numeric, 'P-25 conserva el límite aprobado');
select has_column('public','suscripciones_push','ultimo_aviso_entregado_en',
  'la última entrega persiste aunque se limpie el historial');
select is((select valor from public.parametros
  where clave='dias_retencion_suscripcion'),30::numeric,
  'retención de 30 días configurable en parametros');
select ok(to_regprocedure('private.limpiar_suscripciones_inactivas()') is not null,
  'existe limpieza privada de suscripciones');
select ok(exists(select 1 from cron.job
  where jobname='limpiar-suscripciones-inactivas'
    and command='select private.limpiar_suscripciones_inactivas()'),
  'pg_cron ejecuta la limpieza periódica');
select ok(exists(select 1 from pg_trigger
  where tgrelid='public.avisos_push'::regclass
    and tgname='aviso_entregado_renueva_suscripcion' and not tgisinternal),
  'la entrega exitosa renueva la suscripción');

insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-00000000016a','authenticated','authenticated'),
  ('00000000-0000-0000-0000-00000000016b','authenticated','authenticated'),
  ('00000000-0000-0000-0000-00000000016c','authenticated','authenticated'),
  ('00000000-0000-0000-0000-00000000016d','authenticated','authenticated'),
  ('00000000-0000-0000-0000-00000000016e','authenticated','authenticated');
insert into public.suscripciones_push
  (id, perfil_id, endpoint, p256dh, auth, celda, creado_en, actualizado_en)
values
  ('20000000-0000-4000-8000-00000000016a','00000000-0000-0000-0000-00000000016a',
   'https://fcm.googleapis.com/16a',repeat('A',87),repeat('B',22),'1_1',
   now()-interval '40 days',now()-interval '40 days'),
  ('20000000-0000-4000-8000-00000000016b','00000000-0000-0000-0000-00000000016b',
   'https://fcm.googleapis.com/16b',repeat('A',87),repeat('B',22),'1_1',
   now()-interval '40 days',now()-interval '40 days'),
  ('20000000-0000-4000-8000-00000000016c','00000000-0000-0000-0000-00000000016c',
   'https://fcm.googleapis.com/16c',repeat('A',87),repeat('B',22),'1_1',
   now()-interval '40 days',now()-interval '40 days'),
  ('20000000-0000-4000-8000-00000000016d','00000000-0000-0000-0000-00000000016d',
   'https://fcm.googleapis.com/16d',repeat('A',87),repeat('B',22),'1_1',
   now()-interval '40 days',now()-interval '40 days'),
  ('20000000-0000-4000-8000-00000000016e','00000000-0000-0000-0000-00000000016e',
   'https://fcm.googleapis.com/16e',repeat('A',87),repeat('B',22),'1_1',
   now()-interval '10 days',now()-interval '10 days');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000016b","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.suscribir_push('https://fcm.googleapis.com/16b',
  repeat('A',87),repeat('B',22),null,'1_1')$$,
  'renovar el mismo endpoint cuenta como uso');
reset role;
select ok((select actualizado_en > now()-interval '1 minute'
  from public.suscripciones_push where id='20000000-0000-4000-8000-00000000016b'),
  'renovación actualiza la fecha de uso');

insert into public.avisos_push
  (id,suscripcion_id,celda,tipo,titulo,mensaje,estado)
values
  ('30000000-0000-4000-8000-00000000016c','20000000-0000-4000-8000-00000000016c',
   '1_1','zona_activada','Alerta','Alerta','en_proceso'),
  ('30000000-0000-4000-8000-00000000016d','20000000-0000-4000-8000-00000000016d',
   '1_1','zona_activada','Alerta','Alerta','en_proceso');
update public.avisos_push set estado='enviado', enviado_en=now()
  where id='30000000-0000-4000-8000-00000000016c';
update public.avisos_push set estado='fallido'
  where id='30000000-0000-4000-8000-00000000016d';
select ok((select ultimo_aviso_entregado_en > now()-interval '1 minute'
  from public.suscripciones_push where id='20000000-0000-4000-8000-00000000016c'),
  'solo aviso entregado registra uso');
select ok((select ultimo_aviso_entregado_en is null
  from public.suscripciones_push where id='20000000-0000-4000-8000-00000000016d'),
  'un fallo de entrega no registra uso');
delete from public.avisos_push
  where id='30000000-0000-4000-8000-00000000016c';
select ok((select ultimo_aviso_entregado_en is not null
  from public.suscripciones_push where id='20000000-0000-4000-8000-00000000016c'),
  'limpiar historial no pierde la fecha de entrega');
select is(private.limpiar_suscripciones_inactivas(),2,
  'se borran suscripciones antiguas sin uso y con fallo');
select ok(not exists(select 1 from public.suscripciones_push
  where id in ('20000000-0000-4000-8000-00000000016a',
    '20000000-0000-4000-8000-00000000016d')),
  'desaparecen las inactivas');
select ok(not exists(select 1 from public.avisos_push
  where suscripcion_id='20000000-0000-4000-8000-00000000016d'),
  'al caducar se borran sus avisos por cascada');
select ok(exists(select 1 from public.suscripciones_push
  where id='20000000-0000-4000-8000-00000000016b'),
  'renovación conserva la suscripción');
select ok(exists(select 1 from public.suscripciones_push
  where id='20000000-0000-4000-8000-00000000016c'),
  'entrega conserva la suscripción sin historial');

update public.parametros set valor=5 where clave='dias_retencion_suscripcion';
select is(private.limpiar_suscripciones_inactivas(),1,
  'el plazo se lee de parametros');
select ok(not exists(select 1 from public.suscripciones_push
  where id='20000000-0000-4000-8000-00000000016e'),
  'al reducir el plazo se elimina la suscripción correspondiente');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000016b","role":"authenticated"}',true);
set local role authenticated;
select is(public.baja_push('https://fcm.googleapis.com/16b'),true,
  'baja explícita elimina de inmediato');
select throws_ok($$select private.limpiar_suscripciones_inactivas()$$,
  '42501',null,'cliente no puede ejecutar el job privado');
reset role;
select * from finish();
rollback;
