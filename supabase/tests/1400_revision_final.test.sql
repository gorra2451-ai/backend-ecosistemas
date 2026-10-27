begin;
create extension if not exists pgtap with schema extensions;
select plan(19);
insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-00000000014a', 'authenticated','authenticated');
insert into public.suscripciones_push (id,perfil_id,endpoint,p256dh,auth,celda) values
  ('20000000-0000-4000-8000-00000000014a','00000000-0000-0000-0000-00000000014a',
   'https://fcm.googleapis.com/fcm/send/14a',repeat('A',87),repeat('B',22),
   public.celda_mapa(public.punto(20.96,-103.7)));
insert into public.reportes (id,perfil_id,tipo,pasan_carros,ubicacion,estado) values
  ('10000000-0000-4000-8000-00000000014a','00000000-0000-0000-0000-00000000014a',
   'calle',true,public.punto(20.96,-103.7),'activo');
update public.reportes set estado='resuelto' where id='10000000-0000-4000-8000-00000000014a';
select is((select count(*) from public.tomar_avisos_push(5))::int,0,
  'activación obsoleta no se envía después de resolver');
select is((select estado::text from public.avisos_push),'fallido','aviso obsoleto queda terminal');
delete from public.avisos_push;
update public.reportes set estado='activo' where id='10000000-0000-4000-8000-00000000014a';
update public.suscripciones_push set celda='9999_9999' where id='20000000-0000-4000-8000-00000000014a';
select is((select count(*) from public.tomar_avisos_push(5))::int,0,
  'cambiar interés cancela avisos de celda anterior');
delete from public.avisos_push;
update public.suscripciones_push set celda=null,municipio='guadalajara';
insert into public.alertas_clima (id,fuente,fuente_url,nivel,titulo,descripcion,municipio,
  vigente_desde,vigente_hasta,verificado_en) values
  ('30000000-0000-4000-8000-00000000014a','Fuente simulada','https://example.org/14',
   'alto','Aviso simulado','Aviso solo de prueba','Guadalajara',now()-interval '9 days',
   now()+interval '1 day',now());
select is(private.encolar_alertas_clima_vigentes(),1,'alerta vigente crea entrega');
update public.avisos_push set creado_en=now()-interval '8 days';
select private.limpiar_avisos_push();
select is((select count(*) from public.avisos_push)::int,1,'limpieza conserva deduplicación de alerta vigente');
select is(private.encolar_alertas_clima_vigentes(),0,'alerta larga no se vuelve a enviar tras retención');
update public.alertas_clima set verificado_en=null;
select is((select count(*) from public.tomar_avisos_push(5))::int,0,'alerta retirada no se envía');
delete from public.avisos_push;
update public.alertas_clima set verificado_en=now(),vigente_hasta=now()-interval '1 hour';
insert into public.avisos_push (suscripcion_id,municipio,alerta_clima_id,tipo,titulo,mensaje)
  values ('20000000-0000-4000-8000-00000000014a','guadalajara',
   '30000000-0000-4000-8000-00000000014a','clima','Prueba','Prueba');
select is((select count(*) from public.tomar_avisos_push(5))::int,0,'alerta vencida no se envía');
delete from public.avisos_push;
update public.alertas_clima set vigente_hasta=now()+interval '1 hour';
select private.encolar_alertas_clima_vigentes();
create temp table reclamo as select * from public.tomar_avisos_push(5);
select is(public.finalizar_aviso_push((select id from reclamo),
  (select token_reclamo from reclamo),false,true),true,'proveedor caducado cierra entrega');
select is((select estado::text from public.avisos_push),'fallido','descarte no se registra como enviado');
select ok((select enviado_en is null from public.avisos_push),'descarte no inventa fecha de envío');
set local role anon;
select throws_ok($$select public.puede_borrar_evidencia('x')$$,'42501',null,
  'helper de borrado no se abre a público');
reset role;
insert into public.reportes(id,perfil_id,tipo,pasan_carros,ubicacion,estado) values
  ('10000000-0000-4000-8000-00000000014b','00000000-0000-0000-0000-00000000014a',
   'calle',true,public.punto(20.96,-103.69),'pendiente');
insert into storage.objects(bucket_id,name,owner_id,metadata) values ('evidencias',
  '10000000-0000-4000-8000-00000000014b/40000000-0000-4000-8000-00000000014b.png',
  '00000000-0000-0000-0000-00000000014a','{"mimetype":"image/png","size":1000}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000014a","role":"authenticated"}',true);
set local role authenticated;
select ok(public.puede_borrar_evidencia(
  '10000000-0000-4000-8000-00000000014b/40000000-0000-4000-8000-00000000014b.png'),
  'autor puede borrar objeto sin registrar');
select public.agregar_evidencia('10000000-0000-4000-8000-00000000014b',
  '10000000-0000-4000-8000-00000000014b/40000000-0000-4000-8000-00000000014b.png','foto');
select ok(not public.puede_borrar_evidencia(
  '10000000-0000-4000-8000-00000000014b/40000000-0000-4000-8000-00000000014b.png'),
  'autor no puede borrar objeto registrado');
select ok(not public.puede_borrar_evidencia(
  '10000000-0000-4000-8000-00000000014a/40000000-0000-4000-8000-00000000014c.png'),
  'no bloquea ni inspecciona objetos ausentes o de otro dueño');
select throws_ok($$select public.baja_push_caducada(
  '20000000-0000-4000-8000-00000000014a','x','x','x')$$,'42501',null,
  'cliente no puede dar de baja dispositivos por RPC interna');
reset role;
select is(public.baja_push_caducada('20000000-0000-4000-8000-00000000014a',
  'https://fcm.googleapis.com/fcm/send/14a',repeat('Z',87),repeat('B',22)),false,
  'respuesta caducada no borra claves renovadas');
select is((select count(*) from public.suscripciones_push)::int,1,'renovación conserva dispositivo');
select is(public.baja_push_caducada('20000000-0000-4000-8000-00000000014a',
  'https://fcm.googleapis.com/fcm/send/14a',repeat('A',87),repeat('B',22)),true,
  'servicio elimina solo versión caducada correcta');
select * from finish();
rollback;
