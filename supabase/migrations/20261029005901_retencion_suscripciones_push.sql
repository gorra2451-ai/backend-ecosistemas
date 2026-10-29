-- P-26: conservar la última entrega aunque el historial de avisos se borre a los 7 días.
insert into public.parametros (clave, valor, descripcion) values
  ('dias_retencion_suscripcion', 30,
   'Días sin renovación ni aviso entregado antes de borrar la suscripción (P-26)');

update public.parametros set descripcion = 'Máximo de 20 entradas por perfil en una hora (P-25 aprobado)' where clave = 'max_entradas_por_hora';

alter table public.suscripciones_push
  add column ultimo_aviso_entregado_en timestamptz;

create or replace function private.registrar_uso_suscripcion_por_aviso() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.suscripciones_push
    set ultimo_aviso_entregado_en = greatest(
      coalesce(ultimo_aviso_entregado_en, '-infinity'::timestamptz),
      new.enviado_en)
    where id = new.suscripcion_id;
  return new;
end $$;
revoke execute on function private.registrar_uso_suscripcion_por_aviso()
  from public, anon, authenticated;
create trigger aviso_entregado_renueva_suscripcion
  after update of estado, enviado_en on public.avisos_push
  for each row
  when (new.estado = 'enviado' and old.estado is distinct from new.estado
    and new.enviado_en is not null)
  execute function private.registrar_uso_suscripcion_por_aviso();

create or replace function private.limpiar_suscripciones_inactivas() returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_borradas integer;
begin
  delete from public.suscripciones_push
    where greatest(actualizado_en,
      coalesce(ultimo_aviso_entregado_en, '-infinity'::timestamptz))
      < now() - public.param('dias_retencion_suscripcion') * interval '1 day';
  get diagnostics v_borradas = row_count;
  return v_borradas;
end $$;
revoke execute on function private.limpiar_suscripciones_inactivas()
  from public, anon, authenticated;
select cron.schedule('limpiar-suscripciones-inactivas', '29 3 * * *',
  'select private.limpiar_suscripciones_inactivas()');
