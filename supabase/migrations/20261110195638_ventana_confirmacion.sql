-- =============================================================================
-- PR #14 (revisión, bug A): el 5.º "sí" publicó un pendiente de 24 h 1 min porque el cron de
-- expiración (cada 5 min) aún no lo pasaba a resuelto. validar_confirmable (la usan
-- confirmar_reporte y marcar_falso, con el reporte bloqueado FOR UPDATE) ahora también rechaza
-- un pendiente fuera de ventana_activacion_min con reporte_no_activo.
--
-- Decisión: solo se rechaza; NO se marca resuelto aquí. La RPC corre en una sola transacción
-- (PostgREST), así que un UPDATE a resuelto seguido de la excepción se revertiría siempre, no
-- solo en pgTAP. El estado resuelto/resuelto_en lo sigue poniendo expirar_reportes (cron).
-- Lo que importa es que el reporte vencido no se publique ni acumule votos.
-- Grants sin cambios: create or replace conserva los revoke de 20261023000200.
-- =============================================================================
create or replace function public.validar_confirmable(p_reporte_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.reportes%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'sin_sesion';
  end if;
  select * into r from public.reportes where id = p_reporte_id for update;
  if not found then
    raise exception 'reporte_no_existe';
  end if;
  if r.perfil_id = (select auth.uid()) then
    raise exception 'propio_reporte';
  end if;
  if r.estado not in ('pendiente', 'activo') then
    raise exception 'reporte_no_activo';
  end if;
  -- Pendiente vencido que el cron todavía no cierra: se trata como no activo.
  if r.estado = 'pendiente'
     and r.creado_en < now() - make_interval(mins => public.param('ventana_activacion_min')::int) then
    raise exception 'reporte_no_activo';
  end if;
end $$;
