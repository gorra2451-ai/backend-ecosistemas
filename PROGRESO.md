# PROGRESO — Bitácora
> Lo más nuevo arriba. Una entrada por sesión. Formato:
> `## AAAA-MM-DD · Persona · Herramienta` → Hecho / Decidido / Pendiente

## 2026-11-10 (seguridad) · Diego · Claude Code + auditoría Claude Fable 5.2
**Hecho**
- E2E de API en local, 27/27 (reportar → 5 "sí" → activo → Realtime → zona; privacidad; evidencias; derivación).
- Auditoría independiente (solo lectura; ataques reales solo en local): sin críticos. RLS, grants, 46 funciones con
  `search_path=''`, Storage, Edge Functions y front, sin hallazgos. Riesgos: 3 sesiones tumbaban cualquier reporte
  (A1), persona en riesgo con 1 sesión (A2, ya aceptado en P-16), Realtime público inyectable (M2), sin cabeceras (M3).
- D-024: `banderas_para_revision` 3 → 6 (migración + `2200_banderas_midfi`; 0200 y 0500 fijan 3 en su transacción);
  `agruparRafaga` en el mapa (máx. 1 recarga/3 s, `rafaga.test.js`); cabeceras + CSP en `netlify.toml`, probadas en
  un deploy de prueba (mapa, fuentes, Nominatim, Realtime, sin violaciones; `example.com` bloqueado).
- pgTAP 486/486 · vitest 214/214 · build OK. Historial de git y bundle sin secretos. Nube: 0 administradores.
**Pendiente:** ver D-024 (tope por identidad en marcar_falso, captcha, canales privados, apagar registro por correo).

## 2026-11-10 (deploy del mid-fi) · Diego · Claude Code
**Hecho**
- LeoFigo74z aprobó el PR #14 en `862e43c`; auto-merge → `main` en `7374f02`.
- `supabase db push` desde main: 7 migraciones (v2 `20261110000000..000300`, D-022 `192439`, D-023 `195638` y `195640`).
  Nube con `radio_cercanos_max_m` 40000, `ventana_activacion_min` 1440, `minutos_expiracion` 180, 5 confirmaciones.
- `probar-nube.sh` 12/12. Registro anónimo en la nube OK (`is_anonymous: true`) y `reportes_cercanos` responde 200.
- Front: vitest 209/209, build OK → Netlify prod (deploy `6af3d80a59211a95f0f981fc`). Humo de solo lectura en Chrome
  con `?prueba=1`: registro completo, mapa, "Cerca de ti" con aviso de modo prueba, sin errores de consola.
  No se crearon reportes en la nube a propósito (con la ventana de 24 h los testers los verían y confirmarían).
**Pendiente:** humo en 2 celulares (reportar/confirmar, voz con micrófono real, Safari iPhone, Realtime) y luego
borrar lo creado en el humo antes de las 12:00.

## 2026-11-10 (2.ª revisión de Leo) · Diego · Claude Code
**Hecho**
- Voz sin GPS real: no hay avisos automáticos y "Escuchar" pide la ubicación (habla dentro del toque para Safari iOS);
  sin GPS dice "Activa tu ubicación…". Nunca describe el punto de ejemplo como si fuera tuyo.
- Nominatim: `crearLimitador` = fila única para toda la app (antes 2 llamadas concurrentes salían con 0 ms).
- Aviso de privacidad antes de la primera escucha (Reportar y Confirmar; el navegador puede enviar la voz a su
  proveedor); el modo vehículo solo escucha si ya se aceptó. Verificado en Chrome con voz/GPS simulados.
- pgTAP 481/481 · vitest 209/209 · build OK.

## 2026-11-10 (cierre) · Diego · Claude Code (revisión de Leo + voz)
**Hecho**
- Revisión de LeoFigo74z al PR #14 atendida (D-023): `validar_confirmable` rechaza pendientes con la ventana vencida
  bajo `FOR UPDATE` (prueba 2000, 10 casos); bucket solo imágenes y `agregar_evidencia` lanza `video_deshabilitado`
  (prueba 2100, 6 casos; además `.mp4` nunca se podía registrar por la regex `[a-z]+`); el front no manda coordenadas
  del dispositivo a Nominatim y busca solo con el botón "Buscar" (verificado en Chrome: 0 llamadas al teclear, 1 al buscar).
- Voz integrada al PR #14: "Modo voz" (zonas nuevas o que suben ≤ 400 m, sondeo 60 s) + "Escuchar"; "Reportar con voz"
  (tipo y gravedad, envío manual). Verificado en Chrome con reconocedor/síntesis simulados.
- Auth anónima en la nube encendida (`anonymous_users: true`). Bucket `evidencias` en la nube vacío (sin videos).
- pgTAP 481/481 · vitest 194/194 · build OK.
**Pendiente:** nueva aprobación de Leo → merge → `db push` → probar-nube → deploy; probar voz con micrófono real.

## 2026-11-10 (noche) · Diego · Claude Code (recorrido local del mid-fi + modo prueba)
**Hecho**
- Recorrido local en Chrome (escritorio y móvil 390 px, claro/oscuro/contraste): registro → reportar → 5 confirmaciones
  (sesiones anónimas por API) → zona activa en el mapa vía Realtime. Fixes: etiquetas de zona 12×12 y encimadas,
  stepper de Reportar anulado por CSS huérfano (+ prueba que parsea todos los CSS), GPS colgado si se ignora el
  permiso (límite propio de 12 s), botón Reportar fuera de pantalla en escritorio, mapa que no centraba al llegar el GPS,
  ruta alterna que apuntaba a la inundación, "De dónde quiero avisos", moto, `--mu2` en contraste, Confirmar trabado en
  "Enviando…", nota al publicar, insignia "0 personas", videos > 10 MB, conteo de confirmaciones (403), doble envío.
- Modo prueba `?prueba=1` (D-022): "Cerca de ti" lista toda la ZMG y se puede confirmar sin estar cerca.
- Migración `20261110192439_parametros_midfi` (D-022, TEMPORAL): radio 40000, ventana 1440, expiración 180.
  vitest 143/143 · `db reset` + `test db` 465/465.
**Aviso de contrato (regla 10):** `radio_cercanos_max_m`, `ventana_activacion_min` y `minutos_expiracion` cambian en la
nube al hacer `db push` (ver `docs/API.md`, `docs/MODELO_DATOS.md`). LeoFigo74z: revisar en el PR #14.
**Decidido:** D-022. `confirmaciones_para_publicar` se queda en 5.
**Pendiente:** revertir D-022 al cerrar el testeo; que el front lea `parametros` (umbrales 5/10/15/20 y `MIN_ATENUAR`
fijos); nivel de zona por confirmaciones vs. gravedad reportada (confunde); "Mis avisos" por municipio promete más de
lo que entrega; municipio "detectado" nunca se detecta.

## 2026-11-10 · Diego · Claude Code (front unificado + backend v2 validado)
**Hecho**
- Front unificado en `web/` (D-018) en 3 rondas: canvas de Diego → material de los equipos → "manda lo validado"
  (D-021). Registro (4 pasos + moto), Reporte (gravedad, evidencia antes de enviar, enviado, Mis reportes, barra
  Mapa·Reportes·Ayuda), Mapa (buscar con Nominatim, capas y leyenda, crítico, Más), Confirmación (Ya no → secó /
  nunca hubo agua, voz, alerta a 400 m) y Avisos/derivación (6 casos, ¿Puedo pasar?, preferencias). 115/115 vitest.
- Backend v2 (D-021): 4 migraciones `20261110000000..000300` (enums, publicación y niveles por confirmaciones,
  gravedad, `mis_reportes`, derivar + `.mov` + moto, preferencias push). Local: `db reset` + `test db` 461/461.
  Smoke REST local: `crear_reporte` con gravedad, `mis_reportes`, `registrar_entrada('moto')` OK.
- PR #14 abierto (front + v2). Liga: https://aguas-zmg.netlify.app (aún con la versión de la ronda 1).
- Material de los equipos en `../06_Prototipos_Equipos/` (incluye `admin.html` del panel de administración).

**Pendiente (en orden)**
- LeoFigo74z aprueba PR #14 → merge → `supabase db push` desde `main` (4 migraciones) → `probar-nube.sh`.
- Encender Auth anónima remota (D-019) y desplegar el front (`netlify deploy`).
- Panel de administración (`admin.html`) con datos reales; sin métricas inventadas.
- Limpiar duplicados (ver HANDOFF) y revisión visual completa en móvil/escritorio y temas.
- Registrar D-020 (Nominatim) en DECISIONES.

## 2026-11-10 · Diego · Claude Code (nube con PR #12 e integración de PR #13)
**Hecho**
- PR #12 (LeoFigo74z) revisado, aprobado y fusionado en `main` (ec02c63). Local: `supabase db reset`
  + `supabase test db` → 380/380 en 20 archivos.
- `supabase db push` a la nube desde `main`: 14 migraciones aplicadas sin error
  (20261026203605_perfiles_entradas_anonimos, 20261026215220_evidencias, 20261026220233_realtime_mapa,
  20261026220654_refugios_publicos, 20261026221116_suscripciones_push, 20261026222822_avisos_push_por_zona,
  20261026224459_tipo_aviso_clima, 20261026224500_alertas_clima_manuales, 20261026230000_instituciones_derivar,
  20261027045344_endurecer_entrega_local, 20261027051745_baja_push_condicional,
  20261027171925_corregir_avisos_y_limites, 20261029005901_retencion_suscripciones_push,
  20261102204519_parametros_entrega_push). Nube: 22 migraciones.
- `bash scripts/probar-nube.sh` tras el push: 12 pasan, 0 fallan.
- PR #13: conflictos con `main` resueltos. Se conservan P-16 a P-26 de `main`; las siete preguntas de la clase
  5-nov pasan a P-27 a P-33. P-01 separa el hallazgo del testeo (confirmaciones) de la regla actual (reportes cercanos).

**No hecho en la nube (pendiente)**
- Auth anónima remota sigue apagada (P-16). Edge Functions sin desplegar; secretos VAPID y de Vault sin configurar
  (sin ellos el cron de avisos no envía nada). No se corrió `supabase config push`.

**Seguimientos de la revisión del PR #12 (no bloqueantes)**
- Realtime público: cualquiera con la llave publicable puede emitir `cambio` (canales privados + política).
- `zona_resuelta` se envía también al pasar a `oculto`/`en_revision`.
- Helpers `es_autor_reporte`, `puede_subir_evidencia`, `puede_borrar_evidencia` expuestos a `authenticated`.
- `docs/API.md` dice que el payload de `zonas` trae `id`; el trigger solo manda `celda`.

## 2026-11-05 · gorra2451-ai · cierre F1-T6
**Hecho**
- PR: https://github.com/gorra2451-ai/backend-ecosistemas/pull/13
- docs(repo): clase 5-nov (¡Aguas!, P-17 a P-23; renumeradas P-27 a P-33 al integrar main) y handoff al día

## 2026-11-05 · Diego · Claude Code
**Hecho**
- Verificado: nube al día con `main` (8 migraciones), `probar-nube.sh` 12/12, 161 pruebas locales en verde.
- Clase 5-nov registrada en `PREGUNTAS.md` (P-01 actualizada; preguntas de clase hoy P-27 a P-33).

**Decidido en clase (5-nov)**
- La app se llama **¡Aguas!** (con signos de exclamación).
- Se usa la paleta, tipografía y componentes del design system de Diego; un solo prototipo unificado.
- Los equipos entregan lo testeado a Diego y LeoFigo74z para integrarlo. Segundo testeo: 5 cosas con 10 personas, ya en digital.
- Testeo: con 5 confirmaciones la gente confía en un reporte (ojo: `umbral_activacion` = 5 cuenta reportes cercanos, no confirmaciones; ver P-01).

**Pendiente**
- Mandar API v1 a los equipos (F1-T6). (Al 2026-11-10: F1-T2 ya fusionada en PR #12.)

## 2026-11-02 · LeoFigo74z · Codex (ajustes solicitados en PR #12)
**Hecho**
- Migración nueva: `lote_procesar_avisos=20` y `ttl_enviar_push_seg=3600`
  en `parametros`; ambos handlers leen el valor vigente y rechazan
  configuraciones inválidas antes de procesar o enviar.
- Comentario junto a `enable_anonymous_sign_ins = true` en `config.toml`:
  NO hacer `supabase config push` ni activar Auth anónima remota antes de P-16.
- Modelo de datos y reglas de notificaciones actualizados. Se conservan los
  informes históricos opcionales de `docs/`.
- Pruebas antes del arreglo: Edge detectó lote 5 y TTL 60; pgTAP detectó
  ausencia de ambos parámetros. Después: reset local limpio, 380/380 pgTAP
  en 20 archivos, arnés SQL 20/20, Edge 13/13, lectura REST local,
  smoke de concurrencia y lint sin errores.

**Pendiente**
- Revisión y merge del PR #12; la nube no se modificó.

## 2026-10-28 · LeoFigo74z · cierre feat/c-mitad-leo
**Hecho**
- PR: https://github.com/gorra2451-ai/backend-ecosistemas/pull/12
- feat(push): cerrar retencion y decisiones P-25 P-26
- docs(entrega): registrar correcciones y relevo para Diego
- test(push): cubrir proveedores validos y dominios falsos
- fix(avisos): corregir activacion, cierre y limites de entrada
- docs(entrega): aclarar revision local y permisos para publicar
- fix(entrega): corregir concurrencia y avisos obsoletos antes de revisión
- feat(derivacion): orientar con instituciones verificadas y cerrar entrega local
- feat(clima): registrar alertas verificadas y avisar por municipio
- feat(avisos): encolar y procesar cambios de zona con límite de frecuencia
- feat(push): registrar dispositivos y preparar envio web
- feat(refugios): publicar solo fichas verificadas
- feat(mapa): emitir cambios publicos por broadcast
- feat(evidencias): registrar archivos propios en storage privado
- docs(handoff): registrar cierre local de perfiles
- fix(perfiles): reaplicar trigger en pruebas locales
- feat(perfiles): sesiones anonimas y entradas seguras

**Pendiente**
- Revisión del PR por la otra persona.

## 2026-10-28 · LeoFigo74z · Codex (integración y P-25/P-26)
**Hecho**
- PR #10 y #11 de Diego fusionados en `main` (088907f); integrado a
  `feat/c-mitad-leo` con commit de merge local 7a36974.
- P-25 aprobado: 20 entradas por perfil por hora en `parametros`.
  P-26 aprobado: celda de ~300 m ligada al perfil, baja inmediata o 30 días
  sin renovación ni aviso entregado; D-017 registrada.
- Nueva migración de retención: parámetro, fecha de última entrega exitosa,
  trigger y job diario de `pg_cron`. La prueba pgTAP falló antes (4/4) y
  pasó tras el arreglo (20/20).
- Validación local integrada: reset limpio; 378 pgTAP en 19 archivos;
  arnés SQL 19/19 archivos; Edge 10/10; concurrencia HTTP correcta;
  diagnóstico 56/0; lint local sin errores.
- Arquitectura §Privacidad, modelo de datos, API y preguntas al día.
  Ocho tareas de Leo implementadas y verificadas localmente.

**Decidido**
- Auth anónima en la nube sigue apagada hasta captcha y límites (P-16).
  No se tocó Supabase remoto.

**Pendiente**
- PR autorizado de `feat/c-mitad-leo`; revisión y merge de Diego.
  Después Diego decide aplicar migraciones en la nube y valida con
  `scripts/probar-nube.sh`. Siguen pendientes datos oficiales, EXIF,
  pruebas push reales y acuerdos de integración frontend.
## 2026-10-27 · LeoFigo74z · Codex (correcciones de revisión de Diego)
**Hecho**
- Primero se añadieron pruebas que reprodujeron la activación sin push, fin de zona
  suprimido, proveedor no permitido y entradas ilimitadas. Cinco de seis y dos de
  cinco casos fallaron antes del arreglo.
- Una migración nueva corrigió trigger por statement, cierre de zona, lista de
  proveedores y límite de entradas. No se editaron migraciones anteriores.
- `supabase db reset` y **349 pgTAP en 17 archivos** pasan en la rama de Leo;
  arnés SQL, 10 Deno, smoke de concurrencia y diagnóstico 55/0 también pasan.
- PR #10 y #11 de Diego revisados y aprobados. Integración temporal de ambas
  ramas con la nuestra: **358 pgTAP en 18 archivos**, reset limpio.
- `docs/API.md`, `docs/ARQUITECTURA.md` y `PREGUNTAS.md` actualizados.
  Diego es la persona a quien Leo llamó Ángel; informes renombrados.

**Decidido provisionalmente**
- `max_entradas_por_hora=20` en `parametros`, pendiente aprobación de Diego (P-25).
- La privacidad de la suscripción por celda (~300 m) queda pendiente (P-26).
  Auth anónima remota no se activa sin resolver captcha P-16.

**Pendiente**
- Diego fusiona #10/#11; entonces se integra `main`, se repite toda la
  validación y se abre el PR autorizado de `feat/c-mitad-leo`. Sin cambios
  en Supabase remoto ni secretos.

## 2026-10-26 · LeoFigo74z · Codex (revisión final Sol 6.1)
**Hecho**
- Revisión de las ocho tareas locales. Corregidos avisos obsoletos, resolución concurrente,
  límite concurrente de evidencias, coordinación de borrado/registro y deduplicación de
  alertas largas. Manejo de JSON inválido, red, caducidad y renovación de push; compatibilidad legacy.
- Dos migraciones nuevas, 19 regresiones SQL y 9 tests nuevos de funciones. Total:
  **333 pgTAP + 10 Deno**. Pruebas de concurrencia con transacciones reales y APIs locales.
- Informe actualizado para Diego: `docs/INFORME_PARA_DIEGO_2026-10-26.md`.
  Entrega sigue local; no hubo push, PR ni cambios remotos.

**Pendiente**
- Fuentes oficiales, EXIF en frontend, push real, decisiones P-16 a P-24 e integración.
- El lint por esquema muestra cinco advertencias previas texto/enum en funciones del módulo base;
  sin avisos nuevos en nuestras funciones. No se ocultan como resultado limpio global.

## 2026-10-26 · LeoFigo74z · Codex (F4-T4, trabajo local)
**Hecho**
- Catálogo privado de instituciones con contacto, fuente, casos y verificación; vista
  pública solo de fichas verificadas. `derivar` filtra caso/municipio, ordena refugios
  cercanos y devuelve orientación sin guardar la posición.
- 19 pruebas pgTAP nuevas: **314 en total** tras `supabase db reset` y `supabase test db`.
  `scripts/probar-db.sh` pasó las 14 suites y el lint de `public,private` no reportó errores.
  HTTP local confirmó respuesta con listas vacías y pasos cuando no hay fuentes oficiales.

**Pendiente**
- Catálogo oficial P-05/P-07 y reglas P-24; revisión/PR/nube con Diego.

## 2026-10-26 · LeoFigo74z · Codex (F4-T3, trabajo local)
**Hecho**
- Catálogo de alertas meteorológicas de carga manual, fuente HTTPS, municipio, nivel,
  vigencia y verificación obligatoria para lectura pública. Sin datos inventados.
- Escáner programado que encola una entrega por dispositivo municipal, idempotente y
  sujeto al intervalo anti-spam. 16 pgTAP nuevas; **295 pruebas locales en verde**.

**Pendiente**
- Fuente oficial P-06, escala y verificador P-23, revisión/PR/nube con Diego.

## 2026-10-26 · LeoFigo74z · Codex (F4-T2, trabajo local)
**Hecho**
- Cola privada por celda, trigger de activación/resolución, límite anti-spam y trabajador
  con reclamo exclusivo, token y reintentos. Cron queda sin envío hasta configurar Vault.
- 20 pgTAP nuevas: 279 totales en verde tras reconstruir la base. Prueba HTTP completa
  de Auth → suscripción → reporte → cola → Edge Function → reintento, sin envío externo.

**Pendiente**
- P-21/P-22, configurar secretos de servidor en despliegue, revisión/PR/nube con Diego.

## 2026-10-26 · LeoFigo74z · Codex (F4-T1, trabajo local)
**Hecho**
- `suscripciones_push` privada, RPC de alta/baja, ámbito por municipio o celda y límite
  provisional de 5 dispositivos. 20 pruebas pgTAP nuevas; 259 en total pasan tras
  `supabase db reset`, `supabase test db` y `scripts/probar-db.sh`.
- Edge Function `enviar-push` validada con Deno y runtime local de Supabase: 401 sin clave,
  400 por solicitud inválida, 404 sin suscripción y 422 para proveedor ajeno.
- Cifrado y firma VAPID comprobados sin envío externo. Pruebas HTTP de alta/baja y privacidad;
  asesores locales de seguridad y rendimiento sin hallazgos.

**Pendiente**
- Envío real a un navegador suscrito, claves VAPID de producción y acuerdo P-08/P-20.
- F4-T2 conectará cambios de estado con envíos y límite anti-spam; revisión/PR/nube con Diego.

## 2026-10-26 · LeoFigo74z · Codex (F3-T4, trabajo local)
**Hecho**
- Tabla `refugios` con ubicación PostGIS, fuente, municipio y fecha de verificación;
  vista `refugios_publicos` con RLS de solo lectura verificada.
- 15 pruebas pgTAP nuevas; 239 en total tras `supabase db reset`, `supabase test db`
  y `scripts/probar-db.sh`. Asesores de seguridad y rendimiento sin hallazgos.
- Sin filas inventadas en seed ni en la nube.

**Pendiente**
- P-07: recibir y comprobar lista de refugios oficiales; revisión/PR/nube con Diego.

## 2026-10-26 · LeoFigo74z · Codex (F3-T3, trabajo local)
**Hecho**
- Broadcast público de invalidaciones `reportes`/`zonas` desde triggers, sin replicar
  reportes ni confirmaciones completos; payload sin autor ni ubicación privada.
- 14 pruebas pgTAP nuevas; `supabase db reset` y `supabase test db` con 224 pruebas en verde.
- Prueba WebSocket real con dos canales y un reporte activo: ambos eventos recibidos.

**Pendiente**
- Revisión de Diego/Claude y autorización antes de `push`/PR/nube.

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
## 2026-10-23 · Diego · Claude Code (cierre de sesión)
**Hecho**
- Proyecto en la nube creado y con las 7 migraciones (D-014); `docs/API.md` v1 congelada (PR #8).
- LeoFigo74z invitado y aceptó; prompt único de arranque y modo solo local en el arnés (PR #9, D-015).
- Auditoría F5-T2 de módulos D con advisors: utilidades invoker + índice (PR #10, por aprobar).
- Endurecimiento de la nube: HS256 revocada, SSL, contraseñas 12+, `probar-nube.sh` (PR #11, D-016).

**Decidido**
- D-014, D-015, D-016. LeoFigo74z sube cambios solo con autorización de Diego.

**Pendiente**
- Aprobación de #10 y #11 por LeoFigo74z; `db push` de #10; F1-T2; compartir API v1; preguntas de clase.

## 2026-10-23 · gorra2451-ai · cierre F5-T2
**Hecho**
- PR: https://github.com/gorra2451-ai/backend-ecosistemas/pull/11
- chore(seguridad): endurecimiento de la nube y probar-nube.sh (D-016)

**Pendiente**
- Revisión del PR por la otra persona.

## 2026-10-23 · gorra2451-ai · cierre F5-T2
**Hecho**
- PR: https://github.com/gorra2451-ai/backend-ecosistemas/pull/10
- docs(plan): F5-T2 avance de auditoría en módulos de Diego
- fix(base): utilidades como security invoker e índice de acciones_admin (auditoría F5-T2)

**Pendiente**
- Revisión del PR por la otra persona.

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

### 2026-11-11 · Mapa con menos ruido (D-026)
- Hoja inferior arrastrable; hoja mínima sin la fila de 3 botones; leyenda dentro de "Leyenda y filtros" con
  daltonismo arriba; accesibilidad como paso 2 del onboarding; crédito OSM compacto; interruptores con estado visible.
- vitest 219/219, build OK. Probado en Chrome a 390 px (arrastrar arriba/abajo, daltonismo en vivo, paso 2/4).

### 2026-11-11 · Gestos, vibración, voz de muestra y simulaciones (D-027)
- Atrás/deslizar se queda dentro de la app; vibración al tocar (se apaga, se guarda en el perfil); voz de muestra;
  simulaciones locales en Más (modo prueba). Migración `20261111151345_accesibilidad_vibracion` + pgTAP 2300.
- pgTAP 493/493, vitest 234/234, build OK. Probado en Chrome a 390 px (atrás desde Más → mapa, simulación medio).

### 2026-11-11 · Pines, niveles objetivos, hoja v2, escenario y semilla (D-028)
- Pines por reporte en el mapa; zonas como halo; "¿Cuánta agua hay?" con dibujo banqueta/llanta; hoja mínima con
  resumen por nivel; botón Accesibilidad móvil; tic háptico iPhone; escenario local de 8 reportes; viñetas del inicio
  alineadas. Semilla `5eed` (9 reportes) en la nube para el testeo — borrar al terminar.

### 2026-11-11 · Auditoría UX (D-029)
- Escala única por altura del agua; distancia real en "Tu zona"; persona en riesgo sin nivel; barra superior compacta;
  detalle con acciones arriba y datos plegados; onboarding sin pantalla final. vitest 244/244, build OK.

### 2026-11-11 · Color por tipo, barra píldora, 911 completo y voz iOS (D-030)
- Pines y tarjetas con color por tipo + chapita de nivel; naranja de "medio" más claro; barra inferior con "+" y gota
  líquida; persona en riesgo → pantalla 911 completa; arreglo de voz en Safari iOS. vitest 244/244, build OK.
