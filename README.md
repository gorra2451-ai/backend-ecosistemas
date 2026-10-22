# Backend Ecosistemas · Plataforma de inundaciones ZMG

Backend de la plataforma para reportar, confirmar y consultar inundaciones en la Zona
Metropolitana de Guadalajara. Proyecto de la materia Ecosistemas de Negocios, Innovación
Abierta y Plataformas (ITESO, Otoño 2026).

## Empezar
Sigue `docs/ONBOARDING.md`. Resumen:
1. Lee `AGENTS.md` (reglas) y `HANDOFF.md` (dónde vamos).
2. `bash scripts/instalar.sh` (hooks y `.env`) y `bash scripts/diagnostico.sh` (0 problemas).
3. Ciclo: `sync.sh` → `nueva-tarea.sh` → `guardar.sh` → `cerrar-tarea.sh` (todo en `scripts/`).

## Mapa del repo
| Ruta | Qué hay |
|---|---|
| `AGENTS.md` | Reglas para humanos y cualquier IA |
| `HANDOFF.md` | Foto corta del estado actual (para sesiones nuevas) |
| `PROGRESO.md` | Bitácora de lo hecho, lo más nuevo arriba |
| `DECISIONES.md` | Decisiones tomadas y por qué |
| `PREGUNTAS.md` | Dudas abiertas, dueño y a quién preguntar |
| `docs/` | Contexto, arquitectura, modelo de datos, reglas, API y plan |
| `prompts/` | Prompts para abrir, cerrar y revisar sesiones con cualquier IA |
| `supabase/` | Migraciones, Edge Functions y pruebas |
| `scripts/` | Automatización de git y del arnés (`test-arnes.sh` lo prueba) |
| `.githooks/` | Bloqueos locales: llaves, `.env`, commits a `main`, formato de mensaje |
