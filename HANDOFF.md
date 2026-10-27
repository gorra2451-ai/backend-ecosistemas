# HANDOFF — Estado actual
> Foto corta para retomar en una sesión nueva. Máx. ~60 líneas. Se reescribe al cerrar cada sesión.

**Última actualización:** 2026-10-23 · Diego (con Claude Code)
**Fase actual:** módulos de Diego terminados y en la nube; LeoFigo74z arrancando (F1-T2)
**Rama activa:** ninguna de Diego; PRs #10 y #11 esperan aprobación de LeoFigo74z
**Repo:** https://github.com/gorra2451-ai/backend-ecosistemas (público, `main` protegida, 1 revisión)

## Dónde quedamos
- **Todas las tareas D de `docs/PLAN.md` están hechas** (50% de Diego): base, reportes,
  confirmación/activación/expiración (pg_cron cada 5 min), zonas de calor, admin y seed.
- 8 migraciones, 7 suites pgTAP: **161 pruebas** en verde (local y CI).
- **Nube (D-014):** proyecto `hdaolwqvxofmvqahzjvp` (us-west-1), sin seed. Se pausó
  `encuesta-zmg-equipo2` para liberar cupo. Endurecida (D-016): HS256 revocada, SSL obligatorio,
  contraseñas 12+. `bash scripts/probar-nube.sh` → 12/12.
- `docs/API.md` **v1 congelada** (✅ disponible / ⏳ pendiente por módulo).
- **LeoFigo74z** aceptó la invitación. Trabaja en modo solo local (D-015, AGENTS §3.13): no sube
  nada sin autorización de Diego; al terminar cada tarea le manda un resumen por WhatsApp.

## Siguiente paso (en este orden)
1. LeoFigo74z aprueba PR #10 (auditoría: utilidades invoker + índice) y PR #11 (seguridad nube).
2. Tras mergear #10: `supabase db push` desde `main` y `bash scripts/probar-nube.sh`.
3. LeoFigo74z construye F1-T2 (sesión anónima + captcha P-16). Cuando Diego autorice el push,
   revisar su PR con `prompts/revision_pr.md` antes de aprobar.
4. Diego comparte `docs/API.md` v1 + URL + llave publicable con los 5 equipos (F1-T6).
5. Próxima clase: P-01 (umbral), P-13 (polígono ZMG), P-16 (anti-spam); luego P-02/03/14/15
   con Reporte y Confirmación; P-04..07 con Mapa y Notificaciones.

## Bloqueos
- Escritura desde el front: requiere F1-T2 (LeoFigo74z).
- Merges de Diego: requieren la aprobación de LeoFigo74z.

## No olvidar
- Cada sesión: `bash scripts/sync.sh`; git solo con `scripts/`. BD local: `supabase db start`
  (puertos 554xx; no chocar con `consultorio-britanico`). Pruebas rápidas: `bash scripts/probar-db.sh`.
  Tras cada `supabase db push`: `bash scripts/probar-nube.sh` (seguridad de la nube desde fuera).
- Las funciones nuevas nacen sin EXECUTE: cada RPC lleva su `grant` explícito.
- Contraseña de Postgres de la nube y llaves: solo en `.env` de Diego.
