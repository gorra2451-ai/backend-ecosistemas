-- =============================================================================
-- Auditoría F5-T2 (advisors de Supabase sobre la nube, 2026-10-23).
-- param, dentro_de_zmg y nivel_para solo leen tablas públicas (parametros, limites_zmg):
-- no necesitan correr con permisos del dueño. es_admin se queda como definer porque
-- administradores no tiene grants. Las RPC del contrato siguen como definer a propósito.
-- =============================================================================
alter function public.param(text) security invoker;
alter function public.dentro_de_zmg(double precision, double precision) security invoker;
alter function public.nivel_para(integer, boolean) security invoker;

-- FK sin índice: borrar un usuario de auth recorre acciones_admin completa.
create index acciones_admin_admin_idx on public.acciones_admin (admin_id);
