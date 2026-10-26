# PROGRESO — Bitácora
> Lo más nuevo arriba. Una entrada por sesión. Formato:
> `## AAAA-MM-DD · Persona · Herramienta` → Hecho / Decidido / Pendiente

## 2026-10-26 · LeoFigo74z · Codex (F2-T4, trabajo local)
**Hecho**
- Bucket privado `evidencias`, tabla con RLS y RPC `agregar_evidencia` para archivos de reportes propios.
- 28 pruebas pgTAP nuevas. `supabase db reset`, `supabase test db` y `scripts/probar-db.sh`
  pasan con 210 pruebas en total (se repetirá al cerrar la rama).
- Prueba HTTP local: dos sesiones anónimas; el usuario ajeno no pudo subir, el autor subió
  una foto y la registró por RPC. Script `scripts/smoke-evidencias.ps1`.

**Pendiente**
- Revisión de Diego/Claude y autorización antes de `push`/PR/nube.
- P-18: límites provisionales; P-19: eliminación verificable de EXIF antes de uso público.

## 2026-10-26 · LeoFigo74z · Codex (F1-T2, trabajo local)
**Hecho**
- Configuración local de Auth anónima, perfil automático, `entradas` y preferencias v1.
- RPC `registrar_entrada` y `guardar_accesibilidad`; tablas con RLS y escritura solo por RPC.
- Migración nueva y 30 pruebas pgTAP nuevas. `supabase db reset`, `supabase test db` y
  `scripts/probar-db.sh` completos: 182 pruebas pasan, 0 fallan.
- Prueba HTTP local: sesión anónima, perfil, entrada y accesibilidad; asesores de seguridad y rendimiento sin hallazgos.
- Arnés Windows: `diagnostico.sh` detecta CRLF en modo binario; diagnóstico completo con 55 pruebas, 0 fallas y 0 problemas.

**Pendiente**
- Revisión de Diego y autorización antes de `push`/PR; después habilitar Auth anónima en el proyecto remoto.
- P-16 (captcha/límite anti-spam) y P-17 (otras preferencias de accesibilidad).

## 2026-10-23 · gorra2451-ai · cierre F0-T3
**Hecho**
- PR: https://github.com/gorra2451-ai/backend-ecosistemas/pull/9
- docs(repo): compañero LeoFigo74z invitado (P-10)

**Pendiente**
- Revisión del PR por la otra persona.

## 2026-10-23 · gorra2451-ai · cierre F1-T6
**Hecho**
- PR: https://github.com/gorra2451-ai/backend-ecosistemas/pull/8
- docs(api): v1 congelada y proyecto en la nube (D-014)

**Pendiente**
- Revisión del PR por la otra persona.

## 2026-10-22 · gorra2451-ai · cierre F2-T1
**Hecho**
- PR: https://github.com/gorra2451-ai/backend-ecosistemas/pull/7
- docs(repo): handoff y progreso del bloque de módulos de Diego

**Pendiente**
- Revisión del PR por la otra persona.

## 2026-10-22 · gorra2451-ai · cierre F2-T1
**Hecho**
- PR: https://github.com/gorra2451-ai/backend-ecosistemas/pull/6
- fix(reportes): endurecimiento tras revisión (banderas, rastro, entradas, locks por celda)
- docs(api): errores y formato de celda de los módulos de Diego; plan al día
- test(zonas): auxiliares con grant y pendiente que no dispara activación
- fix(confirmacion): lock de activación y prueba base sin pendiente junto a activo
- feat(confirmacion): activación, confirmación, falsos y expiración
- feat(admin): ocultar, restaurar y revisión; seed de prueba
- feat(reportes): crear_reporte y reportes_activos_en_area
- feat(zonas): vista zonas_publicas con niveles

**Pendiente**
- Revisión del PR por la otra persona.

## 2026-10-22 · gorra2451-ai · cierre F1-T1
**Hecho**
- PR: https://github.com/gorra2451-ai/backend-ecosistemas/pull/5
- fix(base): funciones nuevas sin EXECUTE para PUBLIC; probar-db.sh parte de cero

**Pendiente**
- Revisión del PR por la otra persona.

## 2026-10-22 · gorra2451-ai · cierre F1-T1
**Hecho**
- PR: https://github.com/gorra2451-ai/backend-ecosistemas/pull/4
- feat(base): extensiones, parámetros, ZMG provisional, reportes, confirmaciones y admin con RLS

**Pendiente**
- Revisión del PR por la otra persona.

## 2026-10-22 · gorra2451-ai · cierre F0-T5
**Hecho**
- PR: https://github.com/gorra2451-ai/backend-ecosistemas/pull/3
- docs(modelo): revisión v0 de modelo, reglas y API; puertos 554xx y probar-db.sh

**Pendiente**
- Revisión del PR por la otra persona.

## 2026-10-22 · gorra2451-ai · cierre F0-T2
**Hecho**
- PR: https://github.com/gorra2451-ai/backend-ecosistemas/pull/2
- docs(repo): repo público con main protegida (D-012) y contingencia (D-013)

**Pendiente**
- Revisión del PR por la otra persona.

## 2026-10-23 · Diego · Claude Code (bloque grande con 4 agentes en paralelo)
**Hecho**
- Repo público con `main` protegida (D-012); contingencia D-013.
- F0-T5: revisión del modelo (9 cambios: Realtime por Broadcast, permisos por columna, `administradores`, etc.).
- Base (F1-T1/T3/T4) + arreglo de permisos de funciones (EXECUTE a PUBLIC).
- Con 4 agentes en worktrees: M1 reportes (F2-T1, F3-T2), M2 confirmación/activación/expiración
  (F2-T2, F2-T3), M3 zonas (F3-T1), M4 admin + seed (F5-T1, F1-T5).
- Revisión independiente de seguridad: 1 alto, 4 medios, 7 bajos → corregidos los de código
  (banderas al restaurar, rastro en confirmaciones, locks por celda, entradas inválidas, etc.).
- `scripts/probar-db.sh`: pruebas en transacción que se deshace (varios agentes sin pisarse).
- 152 pruebas pgTAP en verde, local y CI. PRs #3–#6.

**Decidido**
- D-012 público · D-013 contingencia. Rol admin en tabla `administradores` (no `perfiles.rol`).
- Polígono ZMG provisional (rectángulo) hasta tener el oficial (P-13).

**Pendiente**
- Usuario de COMPANERO; P-13 a P-16; proyecto Supabase remoto (F0-T4); congelar API v1 (F1-T6).

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
