-- D-027: el perfil anónimo guarda vibración además de daltonismo; guardar una no borra la otra.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-0000000023a0', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000023b0', 'authenticated', 'authenticated');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000023a0","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;

select lives_ok($$ select public.guardar_accesibilidad('{"vibracion":false}'::jsonb) $$, 'guarda vibración apagada');
select lives_ok($$ select public.guardar_accesibilidad('{"daltonismo":true}'::jsonb) $$, 'guarda daltonismo después');
select is((select accesibilidad from public.perfiles), '{"daltonismo":true,"vibracion":false}'::jsonb,
  'guardar daltonismo no borra la vibración');
select throws_ok($$ select public.guardar_accesibilidad('{"vibracion":"no"}'::jsonb) $$, 'P0001', 'parametros_invalidos',
  'vibración que no es booleano se rechaza');
select throws_ok($$ select public.guardar_accesibilidad('{"vibracion":true,"correo":"x@y.test"}'::jsonb) $$,
  'P0001', 'parametros_invalidos', 'llaves fuera de la lista se rechazan (no se guardan datos personales)');
select throws_ok($$ update public.perfiles set accesibilidad = '{"vibracion":true}'::jsonb $$, '42501', null,
  'el cliente no edita el perfil directo');
reset role;

select is((select accesibilidad from public.perfiles where id = '00000000-0000-0000-0000-0000000023b0'),
  '{}'::jsonb, 'el perfil de otra persona no cambia');

select * from finish();
rollback;
