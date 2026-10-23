# HANDOFF — Estado actual
> Foto corta para retomar en una sesión nueva. Máx. ~60 líneas. Se reescribe al cerrar cada sesión.

**Última actualización:** 2026-10-22 · Diego (con Claude Code)
**Fase actual:** 0 — Arnés y repositorio
**Rama activa:** ninguna (`main` al día)
**Repo:** https://github.com/gorra2451-ai/backend-ecosistemas (público, `main` protegida: D-012)

## Dónde quedamos
- Arnés completo y probado: scripts de git en `scripts/`, hooks en `.githooks/`, CI en
  `.github/workflows/ci.yml`. `bash scripts/test-arnes.sh` → 52 pasan, 0 fallan.
- Reparto 50/50 con % en `AGENTS.md` §8 y `docs/PLAN.md`.
- Onboarding y prompt de primer arranque para COMPANERO listos (`docs/ONBOARDING.md`,
  `prompts/arranque_companero.md`, `prompts/mensaje_companero.md`).
- Supabase CLI instalado en la Mac de Diego y `supabase/config.toml` creado. Sin proyecto remoto
  (se crea al tener migraciones; ver D-009).

## Siguiente paso (en este orden)
1. F0-T5: Diego revisa `docs/MODELO_DATOS.md` y `docs/API.md` v0 (COMPANERO sin acceso, D-013).
2. F1-T1: extensiones, enums y `parametros`.
3. Conseguir usuario de GitHub de COMPANERO → reemplazar `COMPANERO` en `AGENTS.md` §8,
   `docs/PLAN.md`, `PREGUNTAS.md`, prompts → `bash scripts/invitar.sh <usuario>` → subir
   revisiones requeridas a 1 (comando en D-012).
4. Mandarle `prompts/mensaje_companero.md`; él corre `prompts/arranque_companero.md`.
5. Si no entra al inicio de cada fase, Diego toma sus tareas (D-013).

## Bloqueos
- Ninguno técnico. Docker apagado en la Mac de Diego: hace falta desde F1-T1 para probar
  migraciones en local (el CI las prueba igual).

## No olvidar
- Cada sesión: `bash scripts/sync.sh` al empezar; git solo con `scripts/`.
- El front (5 equipos) entrega low-fi el 27-oct; no depende del backend todavía.
- Números de negocio (5 reportes, 30 min) son provisionales: viven en `parametros`.
- Opcional: subir `actions/checkout@v4` → v5 (aviso de Node 20 deprecado en CI).
