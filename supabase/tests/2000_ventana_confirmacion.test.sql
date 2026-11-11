-- PR #14 (revisión, bug A): un pendiente fuera de ventana_activacion_min no se publica aunque
-- el cron de expiración todavía no lo haya pasado a resuelto.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- Dueño (…a0) y 5 personas (…b1..…b5). La ventana se lee del parámetro (no se supone).
insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-0000000020a0', 'authenticated', 'authenticated');
insert into auth.users (id, aud, role)
select ('00000000-0000-0000-0000-0000000020b' || g)::uuid, 'authenticated', 'authenticated'
from generate_series(1, 5) g;

create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.como(uuid) to authenticated;

-- …01: creado hace ventana + 1 min (vencido, el cron aún no corre). …02: ventana − 1 min.
-- …03: vencido, para marcar_falso.
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, estado, creado_en) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000020a0', 'calle', false,
   public.punto(20.6600, -103.3500), 'pendiente',
   now() - make_interval(mins => public.param('ventana_activacion_min')::int + 1)),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-0000000020a0', 'calle', false,
   public.punto(20.7000, -103.3500), 'pendiente',
   now() - make_interval(mins => public.param('ventana_activacion_min')::int - 1)),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-0000000020a0', 'calle', false,
   public.punto(20.7400, -103.3500), 'pendiente',
   now() - make_interval(mins => public.param('ventana_activacion_min')::int + 1));

-- 4 "sí" de otras personas en …01 y …02 (falta uno para publicar).
insert into public.confirmaciones (reporte_id, perfil_id, sigue)
select r, ('00000000-0000-0000-0000-0000000020b' || g)::uuid, true
from unnest(array['20000000-0000-4000-8000-000000000001',
                  '20000000-0000-4000-8000-000000000002']::uuid[]) r,
     generate_series(1, 4) g;

select is(public.param('confirmaciones_para_publicar'), 5::numeric,
  'se publica con 5 confirmaciones (premisa de la prueba)');

select pg_temp.como('00000000-0000-0000-0000-0000000020b5');
set local role authenticated;

-- Fuera de ventana: el 5.º "sí" se rechaza y no publica.
select throws_ok($$ select public.confirmar_reporte('20000000-0000-4000-8000-000000000001', true) $$,
  'P0001', 'reporte_no_activo', 'el 5.º "sí" a un pendiente fuera de ventana se rechaza');
reset role;
select is((select estado::text from public.reportes where id = '20000000-0000-4000-8000-000000000001'),
  'pendiente', 'el pendiente vencido NO queda activo (sigue pendiente hasta el cron)');
select is((select count(*)::int from public.confirmaciones
           where reporte_id = '20000000-0000-4000-8000-000000000001'), 4,
  'el voto rechazado no se registra');
select is((select activado_en from public.reportes where id = '20000000-0000-4000-8000-000000000001'),
  null, 'el pendiente vencido no tiene activado_en');

-- marcar_falso usa la misma validación.
select pg_temp.como('00000000-0000-0000-0000-0000000020b5');
set local role authenticated;
select throws_ok($$ select public.marcar_falso('20000000-0000-4000-8000-000000000003') $$,
  'P0001', 'reporte_no_activo', 'marcar falso un pendiente fuera de ventana se rechaza');

-- Dentro de ventana: el 5.º "sí" publica.
select is(public.confirmar_reporte('20000000-0000-4000-8000-000000000002', true) ->> 'estado', 'activo',
  'el 5.º "sí" a un pendiente dentro de ventana lo publica');
reset role;
select is((select estado::text from public.reportes where id = '20000000-0000-4000-8000-000000000002'),
  'activo', 'el pendiente dentro de ventana queda activo');

-- El cron cierra el vencido como resuelto (con resuelto_en).
select ok(public.expirar_reportes() >= 1, 'expirar_reportes cierra los vencidos');
select is((select estado::text || ':' || (resuelto_en is not null)::text from public.reportes
           where id = '20000000-0000-4000-8000-000000000001'),
  'resuelto:true', 'el pendiente vencido queda resuelto con resuelto_en tras el cron');

select * from finish();
rollback;
