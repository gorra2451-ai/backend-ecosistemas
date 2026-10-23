# PROGRESO — Bitácora
> Lo más nuevo arriba. Una entrada por sesión. Formato:
> `## AAAA-MM-DD · Persona · Herramienta` → Hecho / Decidido / Pendiente

## 2026-10-22 · Diego · Claude Code (prompts/warp_arranque.md)
**Hecho**
- Supabase CLI 2.121.0 instalado y con sesión; `supabase init` (config.toml). Sin proyecto remoto.
- Docs: reparto 50/50 con % en `AGENTS.md` §8 y `docs/PLAN.md`; D-009, D-010, D-011;
  `docs/CAMBIOS_DE_CLASE.md`; `docs/ONBOARDING.md`; README.
- Scripts en `scripts/` (sync, nueva-tarea, guardar, cerrar-tarea, estado, invitar, instalar,
  diagnostico, ci-revisar) y hooks en `.githooks/` (pre-commit, commit-msg, pre-push).
- `scripts/test-arnes.sh`: 52 pruebas del arnés, en verde local y en CI.
- CI `.github/workflows/ci.yml`: arnés + revisión de commits + db reset/test db.
- Prompts para COMPANERO: `arranque_companero.md`, `mensaje_companero.md`; `inicio_sesion.md` ajustado.
- Repo privado creado: https://github.com/gorra2451-ai/backend-ecosistemas
- PR #1: arregla prueba que fallaba en CI (dependía de tener supabase instalado). CI en verde.

**Decidido**
- D-009 stack gratis · D-010 construir completo · D-011 repo privado, `main` por regla.
- `evidencias` pasa a F2-T4 (COMPANERO) y `seed.sql` a F1-T5 (Diego) para cuadrar el 50/50.
- `sync.sh` integra con merge (no rebase); el hook no bloquea la palabra `service_role` sola.

**Pendiente**
- P-12 público vs privado · merge del PR #1 · usuario de GitHub de COMPANERO (P-10).

## 2026-10-22 · gorra2451-ai · cierre F0-T2
**Hecho**
- PR: https://github.com/gorra2451-ai/backend-ecosistemas/pull/1
- fix(arnes): prueba de diagnóstico no depende de las herramientas instaladas

**Pendiente**
- Revisión del PR por la otra persona.

## 2026-10-20 · Diego · Claude
**Hecho**
- Carpeta y arnés del backend: AGENTS.md, CLAUDE.md, HANDOFF, PROGRESO, DECISIONES, PREGUNTAS.
- Documentación: contexto de producto (clase 20-oct), arquitectura, modelo de datos,
  reglas de negocio, contrato de API y plan por fases.
- Prompts de inicio, cierre y revisión de sesión; plantilla de PR.

**Decidido**
- Ver DECISIONES.md D-001 a D-008.

**Pendiente**
- Repo en GitHub (Warp), nombre de la Persona B, aprobar modelo de datos.
