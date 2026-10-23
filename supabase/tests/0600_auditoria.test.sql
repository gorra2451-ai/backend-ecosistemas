-- Auditoría F5-T2 (advisors de Supabase sobre la nube, 2026-10-23).
-- Utilidades que solo leen datos públicos no necesitan security definer; es_admin sí (lee administradores).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select ok(not (select prosecdef from pg_proc where oid = 'public.param(text)'::regprocedure),
  'param es security invoker');
select ok(not (select prosecdef from pg_proc where oid = 'public.dentro_de_zmg(double precision, double precision)'::regprocedure),
  'dentro_de_zmg es security invoker');
select ok(not (select prosecdef from pg_proc where oid = 'public.nivel_para(integer, boolean)'::regprocedure),
  'nivel_para es security invoker');
select ok((select prosecdef from pg_proc where oid = 'public.es_admin()'::regprocedure),
  'es_admin sigue como security definer (lee administradores)');
select has_index('public', 'acciones_admin', 'acciones_admin_admin_idx', 'índice para la FK admin_id');

-- Siguen funcionando para quien consulta sin sesión
set local role anon;
select is(public.param('umbral_activacion'), 5::numeric, 'anon usa param');
select ok(public.dentro_de_zmg(20.6597, -103.3496), 'anon usa dentro_de_zmg');
select is(public.nivel_para(7, false), 'alto'::public.nivel_zona, 'anon usa nivel_para');
select lives_ok($$ select * from public.zonas_publicas $$, 'anon lee zonas_publicas');
reset role;

select * from finish();
rollback;
