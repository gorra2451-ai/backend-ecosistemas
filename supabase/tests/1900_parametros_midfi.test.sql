-- Parámetros temporales del mid-fi (D-022): testers repartidos por la ZMG a distintas horas.
-- Se revierten con otra migración después del testeo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);
select is(public.param('radio_cercanos_max_m'), 40000::numeric, 'reportes_cercanos alcanza toda la ZMG (modo prueba)');
select is(public.param('ventana_activacion_min'), 1440::numeric, 'un pendiente tiene 24 h para juntar confirmaciones');
select is(public.param('minutos_expiracion'), 180::numeric, 'una zona activa dura 3 h sin confirmaciones nuevas');
select is(public.param('confirmaciones_para_publicar'), 5::numeric, 'se siguen pidiendo 5 confirmaciones (el copy del front dice 5)');
select * from finish();
rollback;
