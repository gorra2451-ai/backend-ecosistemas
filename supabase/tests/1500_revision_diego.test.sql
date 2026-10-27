-- Regresiones solicitadas por Diego: activar grupo, cerrar zona y proveedor push.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

create temp table prueba_usuarios (id uuid primary key);
insert into prueba_usuarios (id) values
 ('00000000-0000-0000-0000-00000000015a'),
 ('00000000-0000-0000-0000-00000000015b'),
 ('00000000-0000-0000-0000-00000000015c'),
 ('00000000-0000-0000-0000-00000000015d'),
 ('00000000-0000-0000-0000-00000000015e');
insert into auth.users (id,aud,role)
 select id,'authenticated','authenticated' from prueba_usuarios;
grant select on prueba_usuarios to authenticated;

insert into public.suscripciones_push (perfil_id,endpoint,p256dh,auth,celda)
values ('00000000-0000-0000-0000-00000000015a',
 'https://fcm.googleapis.com/fcm/send/15a',repeat('A',87),repeat('B',22),
 public.celda_mapa(public.punto(20.95,-103.70)));
set local role authenticated;
do $$
declare u record;
begin
  for u in select id from pg_temp.prueba_usuarios order by id loop
    perform set_config('request.jwt.claims',
      jsonb_build_object('sub',u.id,'role','authenticated','is_anonymous',true)::text, true);
    perform public.crear_reporte(gen_random_uuid(),'calle',true,20.95,-103.70);
  end loop;
end $$;
reset role;
select is((select count(*) from public.reportes where estado='activo'
 and public.celda_mapa(ubicacion)=public.celda_mapa(public.punto(20.95,-103.70)))::int,
 5,'cinco crear_reporte activan el grupo');
select is((select count(*) from public.avisos_push where tipo='zona_activada'
 and celda=public.celda_mapa(public.punto(20.95,-103.70)))::int,
 1,'activación de grupo produce exactamente un aviso');

insert into public.suscripciones_push (perfil_id,endpoint,p256dh,auth,celda)
values ('00000000-0000-0000-0000-00000000015a',
 'https://fcm.googleapis.com/fcm/send/15b',repeat('A',87),repeat('B',22),
 public.celda_mapa(public.punto(20.97,-103.71)));
insert into public.reportes (id,perfil_id,tipo,pasan_carros,ubicacion,estado)
values ('10000000-0000-4000-8000-00000000015b',
 '00000000-0000-0000-0000-00000000015a','calle',true,
 public.punto(20.97,-103.71),'activo');
update public.reportes set estado='resuelto' where id='10000000-0000-4000-8000-00000000015b';
select is((select count(*) from public.avisos_push where tipo='zona_resuelta'
 and celda=public.celda_mapa(public.punto(20.97,-103.71)))::int,
 1,'fin de zona se avisa aunque hubo activación hace menos de 30 minutos');

insert into public.suscripciones_push (perfil_id,endpoint,p256dh,auth,celda)
values ('00000000-0000-0000-0000-00000000015a',
 'https://fcm.googleapis.com/fcm/send/15c',repeat('A',87),repeat('B',22),
 public.celda_mapa(public.punto(20.98,-103.71)));
insert into public.reportes (id,perfil_id,tipo,pasan_carros,ubicacion,estado)
values ('10000000-0000-4000-8000-00000000015c',
 '00000000-0000-0000-0000-00000000015a','calle',true,
 public.punto(20.98,-103.71),'activo');
update public.reportes set estado='oculto' where id='10000000-0000-4000-8000-00000000015c';
select is((select count(*) from public.avisos_push where tipo='zona_resuelta'
 and celda=public.celda_mapa(public.punto(20.98,-103.71)))::int,
 1,'ocultar el último activo avisa fin de zona');

insert into public.suscripciones_push (perfil_id,endpoint,p256dh,auth,celda)
values ('00000000-0000-0000-0000-00000000015a',
 'https://fcm.googleapis.com/fcm/send/15d',repeat('A',87),repeat('B',22),
 public.celda_mapa(public.punto(20.99,-103.71)));
insert into public.reportes (id,perfil_id,tipo,pasan_carros,ubicacion,estado)
values ('10000000-0000-4000-8000-00000000015d',
 '00000000-0000-0000-0000-00000000015a','calle',true,
 public.punto(20.99,-103.71),'activo');
update public.reportes set estado='en_revision' where id='10000000-0000-4000-8000-00000000015d';
select is((select count(*) from public.avisos_push where tipo='zona_resuelta'
 and celda=public.celda_mapa(public.punto(20.99,-103.71)))::int,
 1,'pasar el último activo a revisión avisa fin de zona');

select set_config('request.jwt.claims',
 '{"sub":"00000000-0000-0000-0000-00000000015a","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select public.suscribir_push('https://push.invalido.test/nuevo',
 repeat('A',87),repeat('B',22),'Guadalajara',null) $$,
 'P0001','proveedor_push_no_permitido','proveedor ajeno se rechaza al registrar');
reset role;
select set_config('request.jwt.claims',
 '{"sub":"00000000-0000-0000-0000-00000000015e","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.suscribir_push('https://updates.push.services.mozilla.com/wpush/v2/prueba',
 repeat('A',87),repeat('B',22),'Guadalajara',null)$$,'Mozilla permitido');
select lives_ok($$select public.suscribir_push('https://web.push.apple.com/Q/prueba',
 repeat('A',87),repeat('B',22),'Guadalajara',null)$$,'Apple permitido');
select lives_ok($$select public.suscribir_push('https://foo.notify.windows.com/w/prueba',
 repeat('A',87),repeat('B',22),'Guadalajara',null)$$,'WNS permitido');
select throws_ok($$select public.suscribir_push('https://fcm.googleapis.com.evil.test/prueba',
 repeat('A',87),repeat('B',22),'Guadalajara',null)$$,
 'P0001','proveedor_push_no_permitido','sufijo falso de FCM rechazado');
select throws_ok($$select public.suscribir_push('https://fcm.googleapis.com:8443/prueba',
 repeat('A',87),repeat('B',22),'Guadalajara',null)$$,
 'P0001','proveedor_push_no_permitido','puerto alterno rechazado');
reset role;
select * from finish();
rollback;
