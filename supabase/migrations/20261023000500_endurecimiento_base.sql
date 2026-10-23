-- =============================================================================
-- Endurecimiento de la base tras la revisión independiente (2026-10-23).
-- =============================================================================

-- #2 confirmaciones: los clientes ya no leen id (secuencial) ni horas. Con eso y la ubicación
-- de cada reporte se podía reconstruir el trayecto de un dispositivo (AGENTS.md §3.8, D-006).
revoke select on public.confirmaciones from anon, authenticated;
grant select (reporte_id, sigue, falso) on public.confirmaciones to anon, authenticated;

-- #5 actualizado_en con la hora real: now() es el inicio de la transacción, y un voto que esperó
-- un lock quedaría fechado antes de un "sí" que en realidad fue anterior.
create or replace function public.tocar_actualizado_en() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := clock_timestamp();
  return new;
end $$;
