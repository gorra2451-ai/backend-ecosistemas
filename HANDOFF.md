# HANDOFF — Estado actual
> Foto corta para retomar en una sesión nueva. Máx. ~60 líneas. Se reescribe al cerrar cada sesión.

**Última actualización:** 2026-10-23 · Diego (con Claude Code)
**Fase actual:** módulos de Diego terminados (F1–F3, F5-T1); faltan los de COMPANERO
**Rama activa:** ninguna (`main` al día)
**Repo:** https://github.com/gorra2451-ai/backend-ecosistemas (público, `main` protegida: D-012)

## Dónde quedamos
- **Todas las tareas D de `docs/PLAN.md` están hechas** (50% de Diego): base, reportes,
  confirmación/activación/expiración (pg_cron cada 5 min), zonas de calor, admin y seed.
- 7 migraciones en `supabase/migrations/`, 6 suites pgTAP: **152 pruebas** en verde
  (`supabase db reset && supabase test db` local y en CI).
- Revisión independiente de seguridad hecha y sus hallazgos corregidos (PR #6). Lo de diseño quedó
  en P-16 (anti-spam con sesiones anónimas).
- `docs/API.md` v0 al día con todas las RPC, vistas y códigos de error de los módulos de Diego.

## Siguiente paso (en este orden)
1. Usuario de GitHub de COMPANERO → reemplazar `COMPANERO` en docs → `bash scripts/invitar.sh <usuario>`
   → subir revisiones requeridas a 1 (comando en D-012) → mandarle `prompts/mensaje_companero.md`.
2. Si para el 27-oct (inicio Fase 1) no entra: D-013, Diego toma F1-T2 (perfiles/entradas) y sigue
   con sus tareas C por fase.
3. F0-T4: crear proyecto Supabase remoto y `supabase db push` desde `main` (cuando haya que dar
   acceso a los equipos de front). Ojo: 2.º proyecto activo de la org (D-009).
4. F1-T6: congelar `docs/API.md` v1 y compartirlo con los 5 equipos.
5. Llevar a clase P-01, P-02, P-03, P-13 (polígono ZMG), P-14, P-15, P-16.

## Bloqueos
- Ninguno técnico.

## No olvidar
- Cada sesión: `bash scripts/sync.sh`; git solo con `scripts/`. BD local: `supabase db start`
  (puertos 554xx; no chocar con `consultorio-britanico`). Pruebas rápidas: `bash scripts/probar-db.sh`.
- Las funciones nuevas nacen sin EXECUTE: cada RPC lleva su `grant` explícito.
- Plan de este bloque: `docs/planes/2026-10-23-construccion-diego.md`.
- Opcional: `actions/checkout@v4` → v5 (aviso Node 20 en CI).
