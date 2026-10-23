-- =============================================================================
-- Arreglo de la base: las funciones nuevas nacen SIN permiso de ejecución.
-- `alter default privileges in schema public revoke ... from public` (base) no basta:
-- Postgres da EXECUTE a PUBLIC de forma global y un default por schema solo puede sumar.
-- Se revoca a nivel global para el rol que corre las migraciones (postgres).
-- Detectado por la prueba de M1 (anon podía llamar crear_reporte).
-- =============================================================================
alter default privileges for role postgres revoke execute on functions from public;

-- Funciones ya creadas en la base que no deben quedar abiertas a PUBLIC.
revoke execute on function public.tocar_actualizado_en() from public;
