# HANDOFF — Estado actual
> Foto corta para retomar en una sesión nueva. Máx. ~60 líneas. Se reescribe al cerrar cada sesión.

**Última actualización:** 2026-11-05 · Diego (con Claude Code)
**Fase actual:** módulos de Diego terminados y en la nube; LeoFigo74z sin arrancar F1-T2
**Rama activa:** `docs/f1-t6-clase-5-nov-y-handoff` (clase 5-nov + este handoff)
**Repo:** https://github.com/gorra2451-ai/backend-ecosistemas (público, `main` protegida, 1 revisión)

## Dónde quedamos
- **Todas las tareas D de `docs/PLAN.md` están hechas** (50% de Diego).
- PR #10 y #11 mergeados. Nube al día con `main` (8 migraciones), `probar-nube.sh` 12/12,
  161 pruebas pgTAP en verde (verificado 2026-11-05).
- `docs/API.md` **v1 congelada**; falta mandarla a los equipos (F1-T6).
- **Clase 5-nov:** la app se llama **¡Aguas!**; se usa el design system de Diego en un solo
  prototipo; los equipos entregan lo testeado a Diego y LeoFigo74z. Preguntas nuevas P-17 a P-23.
- **LeoFigo74z** en modo solo local (D-015); no ha entregado F1-T2.

## Siguiente paso (en este orden)
1. Diego manda a los equipos la API v1 + URL + llave publicable (F1-T6; mensaje redactado en la sesión).
2. LeoFigo74z construye F1-T2 (sesión anónima). Sin eso ningún front puede escribir.
   Considerar P-18 (`moto`) antes de cerrar el enum `medio_transporte`.
3. Resolver con el grupo P-17 (sin "Es falso" no hay moderación) y P-20 (testimonio) antes del
   segundo testeo digital: cambian el contrato.
4. Formalizar P-01 como D-XXX con LeoFigo74z (valor 5 ya aplicado; solo falta el registro).
5. Pendientes de clase: P-02, P-13 (polígono ZMG), P-16 (anti-spam), P-21/22/23.

## Bloqueos
- Escritura desde el front: requiere F1-T2 (LeoFigo74z).
- Merges de Diego: requieren la aprobación de LeoFigo74z.

## No olvidar
- Cada sesión: `bash scripts/sync.sh`; git solo con `scripts/`. BD local: `supabase db start`
  (puertos 554xx; no chocar con `consultorio-britanico`). Pruebas rápidas: `bash scripts/probar-db.sh`.
  Tras cada `supabase db push`: `bash scripts/probar-nube.sh` (seguridad de la nube desde fuera).
- Las funciones nuevas nacen sin EXECUTE: cada RPC lleva su `grant` explícito.
- Contraseña de Postgres de la nube y llaves: solo en `.env` de Diego.
