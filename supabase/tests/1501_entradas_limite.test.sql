-- El límite de entradas por perfil debe tomar su valor de parametros.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);
insert into auth.users (id,aud,role) values
 ('00000000-0000-0000-0000-00000000015f','authenticated','authenticated'),
 ('00000000-0000-0000-0000-000000000150','authenticated','authenticated');
insert into public.parametros (clave,valor,descripcion)
 values ('max_entradas_por_hora',2,'Límite local de prueba')
 on conflict (clave) do update set valor=excluded.valor;
select set_config('request.jwt.claims',
 '{"sub":"00000000-0000-0000-0000-00000000015f","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.registrar_entrada('auto')$$,'primera entrada permitida');
select lives_ok($$select public.registrar_entrada('peaton')$$,'segunda entrada permitida');
select throws_ok($$select public.registrar_entrada('bici')$$,
 'P0001','limite_entradas','tercera entrada se rechaza con límite configurable');
select is((select count(*) from public.entradas)::int,2,
 'rechazo no escribe una entrada adicional');
reset role;
select set_config('request.jwt.claims',
 '{"sub":"00000000-0000-0000-0000-000000000150","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.registrar_entrada('bici')$$,
 'el límite es por perfil y no afecta otro usuario');
reset role;
select * from finish();
rollback;
