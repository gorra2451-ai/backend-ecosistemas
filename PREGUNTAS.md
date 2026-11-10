# PREGUNTAS ABIERTAS
> Una fila por duda. Al resolverla, mueve la respuesta a DECISIONES.md y marca ✔.

| # | Pregunta | Bloquea | Dueño | Preguntar a | Estado |
|---|---|---|---|---|---|
| P-01 | ¿Cuántos reportes activan una alerta? (en otro grupo usaron 5) | Fase 2 | Diego | Equipo Confirmación + profesora | Abierta |
| P-02 | ¿Cuántos minutos sin confirmación apagan un reporte? (propuesta 30) | Fase 2 | Diego | Equipo Confirmación | Abierta |
| P-03 | ¿Ubicación exacta = punto en calle o zona? ¿Qué radio agrupa reportes? | Fase 2 | Diego | Equipo Reporte | Abierta |
| P-04 | ¿Qué librería de mapa usará el front? (Leaflet/OSM, Google, link a Waze) | Fase 3 | LeoFigo74z | Equipo Mapa / Leo | Abierta |
| P-05 | ¿Qué institución atiende cada tipo de caso en la ZMG? (teléfonos verificados) | Fase 4 | LeoFigo74z | Equipo Notif.+Derivación | Abierta |
| P-06 | ¿De dónde salen las alertas de clima? (fuente oficial y si tiene API) | Fase 4 | LeoFigo74z | Equipo Notif.+Derivación | Abierta |
| P-07 | ¿Dónde hay refugios oficiales, en qué municipio y quién verifica/publica cada ficha? El catálogo existe pero queda vacío hasta recibir fuentes | Carga de F3-T4 y derivación F4-T4 | LeoFigo74z | Equipo Notif.+Derivación | Abierta |
| P-08 | ¿Web o app? (afecta notificaciones push en iPhone) | Fase 4 | Ambos | Testeo del grupo | Abierta |
| P-09 | Fechas de mid-fi y high-fi | Plan | Diego | Profesora | Abierta |
| P-10 | Nombre y usuario de GitHub del compañero | Fase 0 | Diego | LeoFigo74z | ✔ LeoFigo74z (invitado 2026-10-23) |
| P-11 | ¿Quién es administrador y qué puede hacer? | Fase 5 | Ambos | Grupo | Abierta |
| P-12 | ¿Repo público para forzar la protección de `main` (D-011)? | Fase 0 | Diego | Diego + LeoFigo74z | ✔ D-012 |
| P-13 | Polígono oficial de la ZMG (fuente: IMEPLAN/INEGI). Hoy hay un rectángulo provisional | Fase 2 | Diego | Profesora / IMEPLAN | Abierta |
| P-14 | ¿El límite de `max_reportes_por_hora` cuenta reportes ocultados por moderación? (hoy: cuenta todos) | Fase 2 | Diego | Equipo Reporte | Abierta |
| P-15 | ¿Un reporte nuevo junto a uno `activo` nace activo sin importar tipo ni antigüedad del activo? (hoy: sí) | Fase 2 | Diego | Equipo Confirmación | Abierta |
| P-16 | NO activar Auth anónima en la nube hasta definir captcha y límites de altas. Anti-spam: ¿captcha y límite de sesiones anónimas en Supabase Auth? ¿`persona_en_riesgo` con 1 reporte y "nace activo junto a activo" sin confirmaciones son aceptables? | Antes de testeo público | Diego | Grupo + profesora | Abierta |
| P-17 | ¿Qué preferencias de accesibilidad, además de `daltonismo`, debe guardar el backend? Hoy v1 solo admite esa clave booleana | Integración Equipo Registro | LeoFigo74z | Diego + Equipo Registro | Abierta |
| P-18 | ¿Sirven 10 MiB por archivo y 3 evidencias por reporte? ¿Qué duración máxima de video aceptará el front? Son valores provisionales de `parametros` | F2-T4 antes de uso público | LeoFigo74z | Diego + Equipo Reporte | Abierta |
| P-19 | ¿Quién elimina EXIF de fotos antes de subirlas y cómo se verificará? Storage comprueba MIME/tamaño, pero no elimina metadatos de ubicación | F2-T4 antes de uso público | LeoFigo74z | Diego + Equipo Reporte | Abierta |
| P-20 | Web Push: ¿5 dispositivos por usuario, qué proveedores aceptamos y qué contacto/clave VAPID de producción administrará Diego? El envío local usa una lista provisional de FCM, Mozilla, Apple y WNS | F4-T1 antes de despliegue | LeoFigo74z | Diego + Equipo Notif. | Abierta |
| P-21 | ¿Qué polígonos municipales oficiales se usarán para asociar reportes a suscripciones por municipio? Hasta entonces los avisos de reportes solo llegan a suscripciones por celda | F4-T2 integración | LeoFigo74z | Diego + Equipo Mapa | Abierta |
| P-22 | ¿Aceptamos máximo 3 intentos de push, reintento a 5 min, reclamo a 2 min y retención de 7 días? Valores provisionales en `parametros` | F4-T2 despliegue | LeoFigo74z | Diego + Equipo Notif. | Abierta |
| P-23 | ¿Qué significa cada nivel climático `bajo`, `medio`, `alto` y qué autoridad puede verificar una alerta? Hoy son etiquetas de carga manual, sin umbrales inventados | F4-T3 antes de uso público | LeoFigo74z | Diego + Equipo Notif. | Abierta |
| P-24 | ¿Sirven 20 km y máximo 5 refugios en `derivar`? Son límites provisionales en `parametros`; ¿qué pasos de orientación aprueba el equipo? | F4-T4 antes de uso público | LeoFigo74z | Diego + Equipo Derivación | Abierta |
| P-25 | ¿Aprobamos 20 entradas por perfil en una hora como límite provisional de `registrar_entrada`? Configurable en `parametros`; confirmar antes del merge | Revisión de F1-T2 | LeoFigo74z | Diego + Equipo Registro | ✔ Resuelta (D-017) |
| P-26 | Privacidad: una suscripción por celda (~300 m) vinculada a `perfil_id` es ubicación aproximada. ¿La aceptamos y cuál será su retención? | Antes de uso público | LeoFigo74z | Diego + equipo | ✔ Resuelta (D-017) |
