-- D-024 (auditoría de seguridad 2026-11-10, A1): en el mid-fi, tumbar un reporte (marcas de falso)
-- cuesta al menos lo mismo que publicarlo. 5 marcas no lo esconden; la 6.ª lo manda a en_revision.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-0000000022a0', 'authenticated', 'authenticated');
insert into auth.users (id, aud, role)
select ('00000000-0000-0000-0000-0000000022b' || g)::uuid, 'authenticated', 'authenticated'
from generate_series(1, 6) g;

create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.como(uuid) to authenticated;

-- Una persona en riesgo (nace activa: es el caso más dañino de esconder).
insert into public.reportes (id, perfil_id, tipo, pasan_carros, ubicacion, estado, activado_en) values
  ('22000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000022a0',
   'persona_en_riesgo', true, public.punto(20.6100, -103.3100), 'activo', now());

select is(public.param('banderas_para_revision'), 6::numeric,
  'mid-fi: 6 marcas de falso para mandar a revisión (D-024)');
select ok(public.param('banderas_para_revision') > public.param('confirmaciones_para_publicar'),
  'tumbar un reporte cuesta más identidades que los "sí" para publicarlo');

-- Personas 1..5 marcan falso.
do $$
begin
  for g in 1..5 loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', ('00000000-0000-0000-0000-0000000022b' || g)::uuid,
                        'role', 'authenticated')::text, true);
    perform public.marcar_falso('22000000-0000-4000-8000-000000000001');
  end loop;
end $$;
select is((select estado::text from public.reportes where id = '22000000-0000-4000-8000-000000000001'),
  'activo', 'con 5 marcas de falso sigue activo (antes bastaban 3)');

select pg_temp.como('00000000-0000-0000-0000-0000000022b6');
set local role authenticated;
select is(public.marcar_falso('22000000-0000-4000-8000-000000000001') ->> 'estado', 'en_revision',
  'la 6.ª marca lo manda a revisión');
reset role;
select is((select estado::text from public.reportes where id = '22000000-0000-4000-8000-000000000001'),
  'en_revision', 'queda en_revision');

select * from finish();
rollback;
