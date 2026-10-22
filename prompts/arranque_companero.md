# Prompt · Primer arranque de COMPANERO (pegar tal cual en la IA, una sola vez)

Vas a ayudarme en el backend `backend-ecosistemas` (plataforma de inundaciones de la ZMG,
Supabase + Postgres). Trabajo en equipo con Diego, que usa Claude. Las reglas obligatorias
están en `AGENTS.md`. Hoy **no vamos a escribir código**: tu primer trabajo es revisar que el
arnés del repo funcione bien contigo, con la herramienta que estoy usando.

## Paso 0 · Dime en qué modo estás
Contesta primero, en una línea, cuál de estos eres:
- **Modo terminal** (Codex u otra IA que puede leer archivos y correr comandos en mi repo).
- **Modo web** (ChatGPT en el navegador: no ves mi repo ni corres comandos).
Si no estás seguro, eres modo web.

## Paso 1 · Lee las reglas
- Modo terminal: lee `AGENTS.md`, `HANDOFF.md`, `docs/PLAN.md` y `docs/ONBOARDING.md`.
- Modo web: léelos de los archivos del proyecto. Si alguno no está, **pídemelo** y espera;
  nunca supongas su contenido.
Resume en 5 líneas: qué es el repo, fase actual, mis tareas y su % (las de dueño **C**),
cómo se cambia el esquema y qué está prohibido.

## Paso 2 · Revisa que el arnés funcione en mi compu
- Modo terminal: corre `bash scripts/diagnostico.sh` y `bash scripts/estado.sh`.
- Modo web: pídeme que corra esos dos comandos en Git Bash/terminal y que te pegue la salida.
Con la salida, dime:
1. Qué problemas hay (líneas con ✘) y el comando exacto para arreglar cada uno.
2. Si las pruebas del arnés pasan (línea "Resultado: N pasan, 0 fallan").
No sigas al paso 3 hasta que el diagnóstico diga **0 problema(s)**.

## Paso 3 · Revisa que el arnés se adapte a ti
Responde, según tu modo, sí/no con una línea de porqué:
1. ¿Puedes seguir `AGENTS.md` en cada sesión sin que te lo vuelva a pegar? (modo web: solo si
   está en los archivos del proyecto; si no, dime cómo dejarlo fijo).
2. ¿`prompts/inicio_sesion.md` y `prompts/cierre_sesion.md` te sirven tal cual, o qué les falta
   para tu modo?
3. ¿Hay algún paso del ciclo (`sync` → `nueva-tarea` → `guardar` → `cerrar-tarea`) que no
   puedas hacer o explicarme bien?
4. ¿Ves algún hueco donde yo podría saltarme una regla sin darme cuenta (subir una llave, editar
   una migración vieja, trabajar en `main`, inventar un dato)?

## Paso 4 · Propón mejoras, no las apliques
- Si algo del arnés no funciona contigo, propón el cambio concreto (archivo y texto).
- **No edites el arnés por tu cuenta**: los cambios a `AGENTS.md`, `scripts/`, `.githooks/` o
  `.github/` van en una rama `chore/...` con PR que revisa Diego.
- Termina con: (a) lista de problemas y su arreglo, (b) mejoras propuestas, (c) mi primera
  tarea sugerida de `docs/PLAN.md` y qué necesito leer para empezarla.

## Reglas que aplican desde ya
- Una tarea a la vez, rama por tarea, todo por `scripts/`; nunca `git` a mano en `main`.
- No inventes datos (teléfonos, instituciones, fuentes de clima): `POR CONFIRMAR` + `PREGUNTAS.md`.
- El esquema solo cambia por migración nueva; toda regla o política RLS lleva prueba.
- Nunca me pidas ni aceptes llaves de `.env` en el chat.
- Plan corto antes de código y espera mi OK antes de tocar esquema, RLS o borrar algo.
