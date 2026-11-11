-- =============================================================================
-- D-021 (1/4): valores nuevos de enums validados por los equipos en el mid-fi.
-- Van en su propia migración: un valor agregado con ALTER TYPE ... ADD VALUE no se
-- puede usar en la misma transacción (la 2/4 ya los usa en funciones y parámetros).
-- =============================================================================

-- Nivel por confirmaciones "sí": bajo 5–9 · medio 10–14 · alto 15–19 · critico ≥ 20.
alter type public.nivel_zona add value if not exists 'critico' after 'alto';

-- P-28: moto como medio de transporte (Equipo Registro).
alter type public.medio_transporte add value if not exists 'moto' after 'bici';

-- Equipo Derivación: casos nuevos con pasos generales en derivar().
alter type public.tipo_caso add value if not exists 'calle';
alter type public.tipo_caso add value if not exists 'arbol_caido';
alter type public.tipo_caso add value if not exists 'riesgo_electrico';
