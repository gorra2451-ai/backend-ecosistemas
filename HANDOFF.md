# HANDOFF — Estado actual
> Foto corta para retomar en una sesión nueva. Máx. ~60 líneas. Se reescribe al cerrar cada sesión.

**Última actualización:** 2026-10-26 · LeoFigo74z (con Codex)
**Fase actual:** módulos de Diego en la nube; F1-T2 de Leo implementada y probada localmente
**Rama activa:** `feat/f1-t2-perfiles-y-sesiones-anonimas` (solo local)
**Repo:** https://github.com/gorra2451-ai/backend-ecosistemas (público, `main` protegida: D-012)

## Dónde quedamos
- **Todas las tareas D de `docs/PLAN.md` están hechas** (50% de Diego): base, reportes,
  confirmación/activación/expiración (pg_cron cada 5 min), zonas de calor, admin y seed.
- Base de Diego: 7 migraciones y 152 pruebas. F1-T2 añade una migración y 30 pruebas:
  **182 pruebas locales en verde** tras `supabase db reset`, `supabase test db` y
  `scripts/probar-db.sh`; asesores locales sin hallazgos.
- Sesión anónima real probada por HTTP local: perfil automático, entrada y accesibilidad.
- Diagnóstico completo del arnés: 55 pruebas, 0 fallas, 0 problemas (corregido grep de CRLF en Windows).
- Revisión independiente de seguridad hecha y sus hallazgos corregidos (PR #6). Lo de diseño quedó
  en P-16 (anti-spam con sesiones anónimas).
- **Nube (D-014):** proyecto `hdaolwqvxofmvqahzjvp` (us-west-1) con las 7 migraciones, sin seed.
  Verificado por REST con la llave publicable: lecturas públicas OK, `crear_reporte` sin sesión
  → 42501, `perfil_id` oculto, cron `expirar-reportes` activo. Se pausó `encuesta-zmg-equipo2`.
- `docs/API.md` **v1 congelada** (✅ disponible / ⏳ pendiente por módulo).

## Siguiente paso (en este orden)
1. F1-T2 ya está guardada en dos commits locales (`e0997af`, `6d419af`).
   Preparar revisión para Diego/Claude. No hacer `push` sin autorización de Diego.
2. Tras aprobación, abrir PR y revisar CI. Diego habilita sesiones anónimas en Auth remoto;
   `config.toml` solo habilita el entorno local.
3. Acordar P-16 (anti-spam) y P-17 (preferencias adicionales) antes de testeo/integración.
4. F1-T6: Diego comparte API v1 + URL + llave publicable con los equipos; la escritura remota
   requiere que F1-T2 llegue a la nube y Auth anónima esté habilitada allí.
5. Nuevas migraciones a la nube: `supabase db push` solo desde `main` (password en `.env`).

## Bloqueos
- Ninguno local. Revisión/PR y habilitación remota pendientes.

## No olvidar
- Cada sesión: `bash scripts/sync.sh`; git solo con `scripts/`. BD local: `supabase db start`
  (puertos 554xx; no chocar con `consultorio-britanico`). Pruebas rápidas: `bash scripts/probar-db.sh`.
- Las funciones nuevas nacen sin EXECUTE: cada RPC lleva su `grant` explícito.
- Plan de este bloque: `docs/planes/2026-10-23-construccion-diego.md`.
- Opcional: `actions/checkout@v4` → v5 (aviso Node 20 en CI).
