-- La configuración del trabajador y Web Push vive en parametros.
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);
select is((select valor from public.parametros where clave='lote_procesar_avisos'),
  20::numeric, 'el trabajador reclama hasta 20 avisos por ejecución');
select is((select valor from public.parametros where clave='ttl_enviar_push_seg'),
  3600::numeric, 'el proveedor conserva el push durante una hora');
select * from finish();
rollback;
