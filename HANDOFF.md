# HANDOFF — Estado actual
> Foto corta para retomar en una sesión nueva. Máx. ~60 líneas. Se reescribe al cerrar cada sesión.

**Última actualización:** 2026-11-10 · Diego (con Claude Code)
**Fase actual:** backend 100% en `main` y en la nube; integración del front unificado (F5-T3) para el mid-fi
**Ramas activas:** `docs/f1-t6-clase-5-nov-y-handoff` (PR #13) · `feat/f5-t3-front-midfi-web` (front en `web/`)
**Repo:** https://github.com/gorra2451-ai/backend-ecosistemas (público, `main` protegida, 1 revisión)

## Dónde quedamos
- **Las 8 tareas de LeoFigo74z (incl. F1-T2) y las de Diego están en `main`.** PR #12 fusionado (ec02c63).
- Nube: 22 migraciones, `probar-nube.sh` 12/12 (2026-11-10). Local: 380/380 pgTAP.
- **Clase 5-nov:** la app se llama **¡Aguas!**; un solo prototipo con el design system de Diego.
  Preguntas de clase renumeradas **P-27 a P-33** (P-17 a P-26 son de LeoFigo74z).
- **Mid-fi 2026-11-11 12:00:** front unificado en `web/` (Vite + React + Leaflet/OSM), publicado en
  https://aguas-zmg.netlify.app (D-018, en el PR del front). Flujo completo probado en local.

## Siguiente paso (en este orden)
1. Auth anónima remota: D-019 (propuesta de Diego para el mid-fi) vs. P-16 (LeoFigo74z: no activar sin
   captcha y límites). Decidir juntos antes de encenderla; sin ella la liga no puede reportar ni confirmar.
2. Revisar y fusionar el PR del front (D-018 reemplaza a D-002 y cambia AGENTS §7).
3. Ronda 2 del front con los HTML de los equipos (`../06_Prototipos_Equipos/`).
4. Nube: desplegar `enviar-push` y `procesar-avisos`, secretos VAPID y de Vault (ver PROGRESO 2026-11-10).
5. Seguimientos de la revisión del PR #12 (realtime privado, `zona_resuelta` por ocultos, helpers expuestos).
6. Decidir P-01 (testeo habla de confirmaciones; la regla cuenta reportes cercanos) y P-27 (sin "Es falso"
   no hay moderación) con el grupo.
7. Pendientes de clase: P-02, P-13 (polígono ZMG), P-28 (`moto`), P-30 (testimonio), P-31/32/33.

## Bloqueos
- Escritura desde la liga pública: requiere Auth anónima remota (punto 1).
- Merges: cada PR requiere la aprobación de la otra persona.

## No olvidar
- Cada sesión: `bash scripts/sync.sh`; git solo con `scripts/`. BD local: `supabase db start`
  (puertos 554xx; no chocar con `consultorio-britanico`). Pruebas: `supabase db reset && supabase test db`
  (`scripts/probar-db.sh` falla en `0800_realtime_mapa` por correr todo en una transacción; usar la oficial).
- Tras cada `supabase db push`: `bash scripts/probar-nube.sh`. **No** correr `supabase config push`.
- Las funciones nuevas nacen sin EXECUTE: cada RPC lleva su `grant` explícito.
- Contraseña de Postgres de la nube y llaves: solo en `.env` de Diego. Front: solo URL + llave publicable.
