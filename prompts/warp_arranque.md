# Arranque en Warp: construir el arnés completo, sin código de negocio todavía

Estás en la carpeta del repo `backend-ecosistemas`. Antes de hacer cualquier cosa, lee `AGENTS.md`, `HANDOFF.md`, `DECISIONES.md` y `docs/PLAN.md`. Trabaja por bloques: al terminar cada bloque, muéstrame un resumen y espera mi OK antes de seguir.

## Contexto que ya está decidido
- El stack cuesta $0: Supabase Free (sin tarjeta), GitHub Free, GitHub Actions. No agregues ningún servicio de pago.
- El esquema se escribe 100% en SQL (migraciones), así se puede llevar a cualquier Postgres.
- Somos 2 y el reparto es 50/50. Diego trabaja con Claude/Warp; su compañero con ChatGPT. El nombre y el usuario de GitHub del compañero están POR CONFIRMAR: usa `COMPANERO` como marcador.
- Reparto:
  - Diego: base compartida (10%), reportes (15%), confirmación y expiración (15%), zonas de calor (5%), admin (5%).
  - Compañero: registro anónimo y perfiles (10%), fotos/videos (8%), refugios y realtime (10%), notificaciones y clima (12%), derivación (10%).
- Estrategia: núcleo estable construido completo; los números van en la tabla `parametros`; los datos por confirmar (teléfonos, fuente de clima) se cargan después.

## Bloque 1 · Verificar herramientas (no instales nada sin preguntarme)
Revisa e infórmame de: `git`, `gh` (y `gh auth status`), Docker Desktop, Supabase CLI y `node`. Dime qué falta y el comando para instalarlo (Homebrew).

## Bloque 2 · Actualizar la documentación
1. `AGENTS.md` §8: tabla de reparto con porcentajes; Persona B → `COMPANERO`.
2. `docs/PLAN.md`: reasigna las tareas según el reparto y agrega columna de %; el total de cada persona debe sumar 50%.
3. `DECISIONES.md`:
   - D-009 "Stack 100% gratuito", con límites del plan Free: 2 proyectos, 500 MB de base, 1 GB de archivos, pausa tras 7 días sin uso.
   - D-010 "Construir completo ahora; cambios por parámetros o migraciones nuevas".
4. `docs/CAMBIOS_DE_CLASE.md` (nuevo): cómo entra un cambio acordado en clase:
   clase → `PREGUNTAS.md` → `DECISIONES.md` → tarea en `PLAN.md` → PR.

## Bloque 3 · Automatización de git (scripts en `scripts/`, bash, con comentarios en español)
- `scripts/sync.sh`: trae `main` y lo integra en la rama actual (pull/rebase) y muestra el estado. Se corre al iniciar cada sesión.
- `scripts/nueva-tarea.sh F1-T3 descripcion`: parte de `main` actualizada y crea la rama `feat/f1-t3-descripcion`.
- `scripts/guardar.sh "tipo(modulo): mensaje"`: valida el formato del mensaje, hace add + commit + push de la rama actual. Nunca en `main`.
- `scripts/cerrar-tarea.sh`: hace push y abre el PR con `gh pr create` usando la plantilla. Agrega una entrada a `PROGRESO.md`.
- `scripts/estado.sh`: muestra ramas, PR abiertos, últimos commits de cada persona y la fase actual (lee `HANDOFF.md`). Es el panel de control de Diego.
- `scripts/invitar.sh <usuario_github>`: invita al compañero como colaborador con `gh api`.
- Hooks en `.githooks/` (activar con `git config core.hooksPath .githooks` dentro de `scripts/instalar.sh`):
  - pre-commit: bloquea `.env`, llaves (`service_role`, `sk_`, `eyJ` largos) y commits directos a `main`.
  - commit-msg: valida `tipo(modulo): mensaje`.
- `scripts/instalar.sh`: lo corre cada persona una vez después de clonar (hooks, permisos y `.env` desde `.env.example`).
- Sin trailers de co-autor en los commits.

## Bloque 4 · CI gratis con GitHub Actions
`.github/workflows/ci.yml`: en cada PR levanta Supabase CLI, corre `supabase db reset` y `supabase test db`. Si todavía no hay migraciones, que pase sin error.

## Bloque 5 · Onboarding del compañero
- `docs/ONBOARDING.md`: pasos para clonar, instalar herramientas, correr `scripts/instalar.sh` y trabajar con ChatGPT. Incluye las dos formas:
  - Con Codex o una IA con terminal, que corre los scripts sola.
  - Con ChatGPT web, donde él corre los scripts y pega `prompts/inicio_sesion.md`.
  - Si usa Windows, que trabaje con Git Bash.
- `prompts/mensaje_companero.md`: mensaje corto para WhatsApp con el link del repo y los primeros 3 pasos.

## Bloque 6 · Repo en GitHub (espera mi OK explícito antes de crearlo)
1. Pregúntame si el repo será **público o privado**. Avísame que en GitHub Free la protección de la rama `main` solo se puede forzar en repos públicos; en privado queda como regla del equipo.
2. `git init -b main`, primer commit `chore(repo): arnés inicial` y `gh repo create backend-ecosistemas` con push.
3. Si es público: protege `main` (PR obligatorio, 1 revisión, CI en verde).
4. NO invites a nadie todavía: falta el usuario del compañero.

## Al terminar
Actualiza `HANDOFF.md` y `PROGRESO.md` (corre `prompts/cierre_sesion.md`). Dame el árbol final y el link del repo.
