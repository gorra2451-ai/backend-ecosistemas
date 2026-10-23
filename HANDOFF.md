# HANDOFF — Estado actual
> Foto corta para retomar en una sesión nueva. Máx. ~60 líneas. Se reescribe al cerrar cada sesión.

**Última actualización:** 2026-10-23 · Diego (con Claude Code)
**Fase actual:** módulos de Diego terminados y en la nube; faltan los de LeoFigo74z
**Rama activa:** ninguna (`main` al día)
**Repo:** https://github.com/gorra2451-ai/backend-ecosistemas (público, `main` protegida: D-012)

## Dónde quedamos
- **Todas las tareas D de `docs/PLAN.md` están hechas** (50% de Diego): base, reportes,
  confirmación/activación/expiración (pg_cron cada 5 min), zonas de calor, admin y seed.
- 7 migraciones en `supabase/migrations/`, 6 suites pgTAP: **152 pruebas** en verde
  (`supabase db reset && supabase test db` local y en CI).
- Revisión independiente de seguridad hecha y sus hallazgos corregidos (PR #6). Lo de diseño quedó
  en P-16 (anti-spam con sesiones anónimas).
- **Nube (D-014):** proyecto `hdaolwqvxofmvqahzjvp` (us-west-1) con las 7 migraciones, sin seed.
  Verificado por REST con la llave publicable: lecturas públicas OK, `crear_reporte` sin sesión
  → 42501, `perfil_id` oculto, cron `expirar-reportes` activo. Se pausó `encuesta-zmg-equipo2`.
- `docs/API.md` **v1 congelada** (✅ disponible / ⏳ pendiente por módulo).

## Siguiente paso (en este orden)
1. LeoFigo74z ya está invitado (2026-10-23) y `main` pide 1 revisión. Falta: que acepte la
   invitación, haga `docs/ONBOARDING.md` y pegue `prompts/arranque_companero.md` en su IA.
   Su primera tarea: F1-T2 (sesión anónima), la que destraba la escritura para los equipos.
2. Si para el 27-oct (inicio Fase 1) no entra: D-013, Diego toma F1-T2 y sigue con sus tareas C.
3. F1-T6: Diego comparte `docs/API.md` v1 + URL + llave publicable con los 5 equipos.
   Ojo: sin sesión anónima (F1-T2) los equipos solo pueden **leer**; escribir requiere F1-T2.
4. Nuevas migraciones a la nube: `supabase db push` solo desde `main` (password en `.env`).
5. Llevar a clase P-01, P-02, P-03, P-13 (polígono ZMG), P-14, P-15, P-16.

## Bloqueos
- Ninguno técnico.

## No olvidar
- Cada sesión: `bash scripts/sync.sh`; git solo con `scripts/`. BD local: `supabase db start`
  (puertos 554xx; no chocar con `consultorio-britanico`). Pruebas rápidas: `bash scripts/probar-db.sh`.
- Las funciones nuevas nacen sin EXECUTE: cada RPC lleva su `grant` explícito.
- Plan de este bloque: `docs/planes/2026-10-23-construccion-diego.md`.
- Opcional: `actions/checkout@v4` → v5 (aviso Node 20 en CI).
