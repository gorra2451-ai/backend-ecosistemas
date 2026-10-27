# HANDOFF — Estado actual
> Foto corta para retomar en una sesión nueva. Máx. ~60 líneas. Se reescribe al cerrar cada sesión.

**Última actualización:** 2026-10-26 · LeoFigo74z (con Codex)
**Fase actual:** ocho tareas de Leo implementadas y revisadas localmente; integración pendiente
**Rama activa:** `codex/revision-final-local` (incluye las ramas apiladas; solo local)
**Repo:** https://github.com/gorra2451-ai/backend-ecosistemas (público, `main` protegida: D-012)

## Dónde quedamos
- **Todas las tareas D de `docs/PLAN.md` están hechas** (50% de Diego): base, reportes,
  confirmación/activación/expiración (pg_cron cada 5 min), zonas de calor, admin y seed.
- Base de Diego: 7 migraciones y 152 pruebas. Entrega de Leo: 11 migraciones adicionales;
  **333 pgTAP en 15 suites + 10 Deno** pasan. Reset, arnés y smokes locales completos.
- Asesores sin warn/error; lint: 5 advertencias previas texto/enum en funciones base,
  sin avisos nuevos en nuestras funciones. Revisión corrigió caducidad y concurrencia.
- Sesión anónima real probada por HTTP local: perfil automático, entrada y accesibilidad.
- Evidencias: bucket privado, autoría de subida y registro por RPC. Prueba HTTP local con
  dos usuarios: tercero no sube ni lee pendiente; evidencia activa pública.
- Broadcast por WebSocket real: canales `reportes`/`zonas` reciben eventos sin autor ni
  fila completa. Test SQL comprueba 14 casos de activación, confirmación y resolución.
- Refugios: tabla y vista públicas solo para entradas verificadas; catálogo vacío hasta P-07.
- Push: suscripciones privadas y Edge Function interna probadas en runtime local; cifrado
  VAPID preparado. Falta envío a navegador real y credenciales de producción.
- Avisos por celda: trigger, cola privada, trabajador interno y reintentos probados de
  extremo a extremo local. Municipio pendiente P-21; cron requiere Vault en despliegue.
- Clima: vista solo verificada/vigente y encolado municipal programado; sin fuente
  oficial acordada, el catálogo queda vacío (P-06/P-23).
- Derivación: catálogo de instituciones verificadas y RPC con contactos por caso/municipio,
  refugios cercanos y pasos. Catálogos vacíos hasta verificar fuentes (P-05/P-07/P-24).
- Informe actual para Diego: `docs/INFORME_PARA_DIEGO_2026-10-26.md`; el anterior es histórico.
- Diagnóstico completo del arnés: 55 pruebas, 0 fallas, 0 problemas (corregido grep de CRLF en Windows).
- Revisión independiente de seguridad hecha y sus hallazgos corregidos (PR #6). Lo de diseño quedó
  en P-16 (anti-spam con sesiones anónimas).
- **Nube (D-014):** proyecto `hdaolwqvxofmvqahzjvp` (us-west-1) con las 7 migraciones, sin seed.
  Verificado por REST con la llave publicable: lecturas públicas OK, `crear_reporte` sin sesión
  → 42501, `perfil_id` oculto, cron `expirar-reportes` activo. Se pausó `encuesta-zmg-equipo2`.
- `docs/API.md` **v1 congelada** (✅ disponible / ⏳ pendiente por módulo).

## Siguiente paso (en este orden)
1. Revisión local terminada. Leo enviará informe y bundle local a Diego para revisión;
   fuentes, push real, integración/PR y publicación siguen pendientes de acuerdo del equipo.
2. F1-T2 quedó en commits locales `e0997af`, `6d419af`, `f24ec25`; F2-T4 está en
   la rama apilada. Al cierre, Diego revisa ramas/commits y autoriza PR/nube.
3. Diego habilita sesiones anónimas en Auth remoto; `config.toml` solo habilita local.
4. Acordar P-16 a P-20 antes de testeo público/integración.
5. F1-T6: Diego comparte API v1 + URL + llave publicable con los equipos; la escritura remota
   requiere que F1-T2 llegue a la nube y Auth anónima esté habilitada allí.
6. Nuevas migraciones a la nube: `supabase db push` solo desde `main` (password en `.env`).

## Bloqueos
- Ninguno local. Revisión/PR y habilitación remota pendientes.

## No olvidar
- Cada sesión: `bash scripts/sync.sh`; git solo con `scripts/`. BD local: `supabase db start`
  (puertos 554xx; no chocar con `consultorio-britanico`). Pruebas rápidas: `bash scripts/probar-db.sh`.
- Las funciones nuevas nacen sin EXECUTE: cada RPC lleva su `grant` explícito.
- Plan de este bloque: `docs/planes/2026-10-23-construccion-diego.md`.
- Opcional: `actions/checkout@v4` → v5 (aviso Node 20 en CI).
