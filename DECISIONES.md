# DECISIONES
> Una decisión por bloque. No se editan: si cambia algo, se agrega otra que la reemplaza.
> Estado: Propuesta · Aprobada · Reemplazada por D-XXX

## D-001 · Supabase como backend completo
**Estado:** Propuesta · 2026-10-20
**Decisión:** Postgres + Auth + Realtime + Storage + Edge Functions de Supabase.
**Por qué:** el grupo ya lo usó en la app de la encuesta; plan gratuito; cualquier front
(web hoy, app después) lo consume igual con `supabase-js`.
**Costo:** el plan gratuito pausa proyectos sin actividad (verificar límite vigente al crear).

## D-002 · Backend separado del front
**Estado:** Propuesta · 2026-10-20
**Decisión:** este repo no tiene front. Los equipos consumen el contrato de `docs/API.md`.
**Por qué:** hay 5 equipos de front trabajando en paralelo y la decisión web/app sigue abierta.

## D-003 · Registro anónimo
**Estado:** Aprobada en clase · 2026-10-20
**Decisión:** inicio de sesión anónimo de Supabase. Sin correo ni teléfono.
**Por qué:** quien va manejando no llena formularios; solo necesitamos contar usuarios y evitar spam.

## D-004 · Parámetros de negocio en tabla
**Estado:** Propuesta · 2026-10-20
**Decisión:** umbral de activación, minutos de expiración y radios viven en la tabla `parametros`.
**Por qué:** los valores (5 reportes, 30 min) siguen por confirmar y se ajustarán con testeo.

## D-005 · Ubicación con PostGIS
**Estado:** Propuesta · 2026-10-20
**Decisión:** columnas `geography(Point)` y consultas por distancia con PostGIS.
**Por qué:** "reportes a menos de X metros" y zonas de calor son el centro del producto.

## D-006 · Sin rastreo de usuarios
**Estado:** Propuesta · 2026-10-20
**Decisión:** el servidor no guarda la ubicación del usuario. El aviso "¿sigue inundado?"
se calcula en el teléfono comparando su ubicación con los reportes activos.
**Por qué:** privacidad y menos datos sensibles que proteger.

## D-007 · Sin texto libre en el reporte (por ahora)
**Estado:** Propuesta · 2026-10-20
**Decisión:** el reporte usa opciones cerradas + foto/video opcional. Sin comentarios escritos.
**Por qué:** evita moderar groserías y desinformación; reportar en 3 taps.

## D-008 · Arnés agnóstico de IA
**Estado:** Aprobada · 2026-10-20
**Decisión:** `AGENTS.md` es la fuente única de reglas; `CLAUDE.md` solo la importa.
**Por qué:** Diego usa Claude y la Persona B usa ChatGPT; ambos deben seguir las mismas reglas.

## D-009 · Stack 100% gratuito
**Estado:** Aprobada (Diego) · 2026-10-22 · COMPANERO la revisa al entrar
**Decisión:** Supabase Free (sin tarjeta), GitHub Free y GitHub Actions. Ningún servicio de pago.
**Límites del plan Free de Supabase** (verificar vigentes al crear el proyecto):
- 2 proyectos activos por organización.
- 500 MB de base de datos.
- 1 GB de archivos en Storage (fotos/videos de evidencias).
- El proyecto se pausa tras 7 días sin uso.
**Por qué:** materia escolar, sin presupuesto; el esquema en SQL puro permite migrar a otro Postgres.
**Consecuencias:** limitar tamaño y duración de videos en `parametros`; crear el proyecto remoto
cuando haya migraciones que subir, para que no se pause sin uso; la organización de Diego ya tiene
1 proyecto activo, así que este ocupa el segundo cupo.

## D-010 · Construir completo ahora; cambios por parámetros o migraciones nuevas
**Estado:** Aprobada (Diego) · 2026-10-22 · COMPANERO la revisa al entrar
**Decisión:** se construye el núcleo completo según `docs/PLAN.md` sin esperar a que se confirme
cada dato. Lo que siga abierto entra como valor en `parametros` o como `POR CONFIRMAR`; cuando
se confirme, se ajusta el parámetro o se agrega una migración nueva (nunca se edita una aplicada).
**Por qué:** las preguntas abiertas (P-01 a P-11) no deben frenar la construcción, y así un cambio
acordado en clase no obliga a rehacer código. Flujo en `docs/CAMBIOS_DE_CLASE.md`.

## D-011 · Repo privado; protección de `main` por regla de equipo
**Estado:** Reemplazada por D-012
**Decisión:** `gorra2451-ai/backend-ecosistemas` es privado. GitHub Free no permite proteger
ramas en repos privados (la API respondió `403 · Upgrade to GitHub Pro or make this repository
public`), así que "a `main` solo por PR con 1 revisión y CI en verde" es regla del equipo.
**Mitigación:** hooks locales (`pre-commit` bloquea commits a `main`, `pre-push` bloquea push a
`main`) y CI que revisa cada commit del PR (`scripts/ci-revisar.sh`). Ninguno impide apretar
"Merge" en GitHub con el CI en rojo: eso depende de los dos.
**Alternativa:** hacerlo público permite forzar PR + revisión + CI (no hay secretos en el repo).

## D-012 · Repo público con `main` protegida en GitHub
**Estado:** Aprobada (Diego) · 2026-10-22 · reemplaza a D-011
**Decisión:** el repo es público y `main` está protegida en GitHub: PR obligatorio, CI en verde
obligatorio (jobs "Arnés" y "Base de datos", rama al día con `main`), sin force-push ni borrado,
y **aplica también a admins**.
**Revisiones requeridas:** 0 mientras COMPANERO no tenga acceso (GitHub no deja aprobar el PR
propio). Al invitarlo se sube a 1:
`gh api -X PATCH repos/gorra2451-ai/backend-ecosistemas/branches/main/protection/required_pull_request_reviews -F required_approving_review_count=1`
**Por qué:** en privado GitHub Free no deja forzar la protección (D-011). No hay secretos en el repo.

## D-013 · Contingencia si COMPANERO no se integra
**Estado:** Propuesta (Diego) · 2026-10-22
**Decisión:** mientras no tenga acceso, Diego avanza con sus tareas (dueño D) y las D+C que no
requieren a los dos. Si al inicio de cada fase COMPANERO sigue sin acceso, Diego toma las tareas
C de esa fase, en el orden de `docs/PLAN.md`, y las marca en el plan como `C→D`.
**Por qué:** que el backend no se frene; los % del reparto quedan registrados para la evaluación.


## D-014 · Proyecto Supabase en la nube
**Estado:** Aceptada (Diego) · 2026-10-23
**Decisión:** proyecto `backend-ecosistemas` (ref `hdaolwqvxofmvqahzjvp`, región us-west-1) en la
org gratuita de gorra2451-ai. Para liberar el cupo de 2 proyectos activos se pausó
`encuesta-zmg-equipo2` (se reactiva desde el panel). Migraciones aplicadas con `supabase db push`
desde `main`; el seed **no** se sube (la nube arranca sin datos falsos).
**Por qué:** los equipos de front necesitan una URL real para conectarse (F1-T6).
La contraseña de Postgres vive solo en `.env` local de Diego (`SUPABASE_DB_PASSWORD`).

## D-015 · LeoFigo74z en modo solo local
**Estado:** Aceptada (Diego) · 2026-10-23
**Decisión:** LeoFigo74z construye y prueba en su compu y no sube nada sin autorización de Diego.
Lo hace cumplir el arnés: con `git config arnes.soloLocal true`, `pre-push` bloquea y
`guardar.sh` solo hace commit local; con autorización se sube con `PUSH_AUTORIZADO=1`.
Al terminar cada tarea de `docs/PLAN.md` le manda a Diego un resumen y espera; las dudas van a Diego.
**Por qué:** Diego integra y revisa todo el backend; así nada llega a GitHub sin pasar por él.

## D-016 · Endurecimiento del proyecto en la nube
**Estado:** Aceptada (Diego) · 2026-10-23
**Decisión:** llave HS256 heredada revocada (su secreto se expuso en una sesión local de la IA al
consultar la API de administración; las sesiones ya usaban ES256), SSL obligatorio en Postgres,
contraseñas de 12+ con mayúsculas, minúsculas y dígitos (también en `config.toml`), y
`scripts/probar-nube.sh` como revisión externa tras cada `supabase db push`.
**Por qué:** auditoría F5-T2. Lo que falta (captcha, alta por correo) queda en P-16.

## D-017 · Límite de entradas, privacidad y retención de push
**Estado:** Aceptada (Diego) · 2026-10-28
**Decisión:** P-25: máximo de 20 entradas por perfil en una hora, configurable en
`parametros.max_entradas_por_hora`. P-26: se permite guardar la celda aproximada
(~300 m) vinculada a `perfil_id` para avisos push. La suscripción se elimina
inmediatamente con `baja_push` o al borrar el perfil; además, `pg_cron` la elimina
tras 30 días sin renovar el endpoint ni recibir un aviso entregado con éxito. El plazo
vive en `parametros.dias_retencion_suscripcion`. El último envío exitoso se conserva
en la suscripción aunque se limpie el historial de avisos.
**Seguridad de despliegue:** Auth anónima permanece apagada en la nube hasta que
estén listos captcha y límites (P-16); en local puede estar encendida para pruebas.
**Por qué:** limitar el abuso y retener la ubicación aproximada y las claves push
solo mientras el dispositivo siga usando el servicio.

## D-018 · Front unificado ¡Aguas! dentro de este repo (reemplaza a D-002)
**Estado:** Aceptada (Diego) · 2026-11-10 · falta visto bueno de LeoFigo74z en el PR
**Decisión:** la clase acordó un solo prototipo con el design system de Diego (P-33). El front
vive en `web/` de este repo (Vite + React + `supabase-js` + Leaflet/OpenStreetMap) y se publica
en Netlify (plan gratuito, solo `web/`). `supabase/` no cambia de estructura ni de CI.
Los HTML de los 5 equipos son referencia de pantallas; el front final es uno.
**Por qué:** mid-fi el 2026-11-11 con liga clickeable para que los equipos testeen; un repo
evita desfasar contrato y front. Mapa con OSM (P-04): gratis y sin llave; Google Maps queda
solo como link de "ruta alterna".
**Costo:** $0 (Netlify Free, OSM). El repo es público (D-012): el front no lleva secretos,
solo URL y llave publicable.

## D-019 · Sesión anónima encendida en la nube para el mid-fi (atiende parte de P-16)
**Estado:** Aceptada (Diego y LeoFigo74z) · 2026-11-10 · condicionada: solo durante los testeos del mid-fi,
límite de 30 sesiones anónimas por hora por IP, y se apaga al terminar los testeos. Captcha sigue en P-16.
**Decisión:** se enciende el inicio de sesión anónimo en el proyecto remoto con el límite por IP
de Supabase Auth (anónimos por hora), sin captcha, mientras duren los testeos del mid-fi.
Los límites del backend siguen (`max_reportes_por_hora`, `max_entradas_por_hora`).
**Por qué:** sin sesión el front no puede reportar ni confirmar, y el mid-fi pide el flujo completo.
**Riesgo:** spam desde varias IP. Se revisa al terminar los testeos; captcha sigue en P-16.

## D-020 · Búsqueda de lugares y dirección con Nominatim (OpenStreetMap)
**Estado:** Aceptada (Diego) · 2026-11-10
**Decisión:** el front busca lugares y obtiene la dirección de un punto con Nominatim de OSM, directo desde el
navegador, máx. 1 petición por segundo, limitado a la ZMG y con atribución. No se envían datos personales; solo el
texto buscado o la coordenada del reporte.
**Por qué:** los equipos Mapa y Reporte validaron "Buscar un lugar" y "Ubicación detectada: Av. …". Gratis y sin llave.
**Riesgo:** límites de uso del servicio público; si se excede, se cae a "Tu ubicación actual ±N m".

## D-021 · Manda lo validado por los equipos (contrato v2)
**Estado:** Aceptada (Diego y LeoFigo74z) · 2026-11-10
**Decisión:** "manda lo validado por los equipos" en el testeo del mid-fi. Reemplaza las reglas
de activación y niveles anteriores (REGLAS_NEGOCIO §1, §3, §5) y amplía el contrato a v2 (`docs/API.md`):
- **Publicación por confirmaciones (resuelve P-01):** un reporte `pendiente` pasa a `activo` con
  `confirmaciones_para_publicar` (5) "sí" de otras personas. Se puede confirmar un pendiente.
  `persona_en_riesgo` sigue naciendo `activo`. Si no junta las confirmaciones en
  `ventana_activacion_min`, pasa a `resuelto`.
- **Se retira** la activación por `umbral_activacion` reportes cercanos (queda en `parametros`
  marcado OBSOLETO) y "un reporte junto a un activo nace activo" (**resuelve P-15**).
- **Niveles por confirmaciones "sí":** bajo 5–9 · medio 10–14 · alto 15–19 · `critico` ≥ 20
  (`nivel_*_min`); zona = suma de los activos de la celda. Un activo con < 5 es `bajo`; un
  pendiente no tiene nivel. `persona_en_riesgo` activa con < 15 es `alto` (nace sin
  confirmaciones y es lo más urgente). `pasan_carros=false` ya no sube la zona a `alto`.
- **Gravedad** opcional en el reporte (`bloqueado|limitado|sin_riesgo`); si viene, deduce `pasan_carros`.
- `mis_reportes()`, `reportes_cercanos` con pendientes y nivel, `moto` (**resuelve P-28**),
  derivación para `calle|arbol_caido|riesgo_electrico`, video `.mov` y `preferencias_push`
  (silenciar, solo fuertes, solo cambios).
**Por qué:** los equipos validaron con usuarios que 5 confirmaciones dan confianza; el contrato
debe seguir lo que se probó, no lo que se supuso antes.
**Privacidad:** los pendientes ahora se ven en `reportes_cercanos` (solo con sesión, radio ≤ 1 km,
sin autor), necesario para poder confirmarlos.
**Pendiente:** el 071 de CFE requiere fuente oficial (P-34).

## D-022 · Parámetros temporales y modo prueba para el testeo del mid-fi
**Estado:** Aceptada por Diego · 2026-11-10 · pendiente revisión de LeoFigo74z (PR #14) · **TEMPORAL**
**Decisión:** durante el testeo del mid-fi (desde 2026-11-11), migración `20261110192439_parametros_midfi`:
`radio_cercanos_max_m` 1000 → **40000**, `ventana_activacion_min` 60 → **1440**, `minutos_expiracion`
30 → **180**. `confirmaciones_para_publicar` se queda en **5** (el copy del front dice 5; bajarlo exige
primero que el front lea `parametros`). En el front, la liga con `?prueba=1` hace que "Cerca de ti"
liste pendientes y activos de toda la ZMG (sin GPS) con aviso visible "Modo prueba"; `?prueba=0` lo apaga.
**Por qué:** la maestra manda la liga a personas distintas, repartidas por la ZMG y a distintas horas.
Con 150–300 m de cercanía, 1 km de tope, 60 min de ventana y 30 min de expiración, casi ningún reporte
juntaría 5 confirmaciones y nadie vería activarse una zona. `confirmar_reporte` no valida distancia;
la cercanía solo se exige en el front, así que el modo prueba no toca el esquema.
**Privacidad:** con `?prueba=1` cualquier sesión ve los pendientes de toda la ZMG (sin autor, igual que
D-021). No se guarda nada nuevo de la persona; `aguas.prueba` vive solo en su navegador.
**Reversión:** al cerrar el testeo, nueva migración que regrese 1000 / 60 / 30, regresar
`0000_base.test.sql` a 30 y quitar el bloque D-022 de `0200_confirmacion` y `1800_validado_equipos`.

## D-023 · Privacidad y plazo tras la revisión del PR #14 (reemplaza en parte D-021)
**Estado:** Aceptada por Diego · 2026-11-10 · a pedido de LeoFigo74z (revisión del PR #14)
**Decisión:**
- **Sin video (TEMPORAL):** los videos conservan GPS en sus metadatos y se podían descargar sin sesión. El bucket
  `evidencias` acepta solo jpeg/png/webp y `agregar_evidencia` rechaza `video` (`video_deshabilitado`). Reemplaza
  "video `.mov`" de D-021 hasta tener limpieza de metadatos en video. Las fotos ya se re-codifican sin EXIF.
  El bucket de la nube estaba vacío (revisado 2026-11-10), no hubo videos que limpiar.
- **Plazo bajo bloqueo:** `validar_confirmable` (lo usan `confirmar_reporte` y `marcar_falso`) rechaza con
  `reporte_no_activo` un pendiente con la ventana vencida aunque el cron no haya corrido. No lo marca `resuelto`
  ahí (la excepción revertiría el cambio); lo cierra `expirar_reportes`.
- **Nominatim:** nunca se envían coordenadas del dispositivo (solo de reportes, ya públicas). La búsqueda por texto
  se conserva (sin GPS es la única forma de ubicar un reporte), pero solo al presionar "Buscar", sin autocompletar
  (reglas de uso de Nominatim). Tocar el mapa para elegir el punto queda para después del mid-fi.
**Por qué:** privacidad (AGENTS.md §3.8) y que una zona no se publique fuera del plazo que dice la regla.

## D-024 · Endurecimiento de seguridad para el mid-fi (auditoría 2026-11-10)
**Estado:** Aceptada por Diego · 2026-11-10 · tras auditoría independiente (Claude Fable 5.2, solo lectura)
**Decisión:**
- **Banderas 3 → 6 (TEMPORAL):** con 3 marcas de falso, 3 sesiones anónimas mandaban cualquier reporte (incluida
  `persona_en_riesgo`) a `en_revision`, y la nube no tiene administradores. Publicar exige 5 "sí" + autor, así que
  `banderas_para_revision` = 6. Se revierte con D-022 cuando `marcar_falso` tenga tope por identidad.
- **Realtime:** los canales `reportes`/`zonas` son públicos; el mapa agrupa eventos (máx. 1 recarga cada 3 s,
  `agruparRafaga`). Canales privados con RLS en `realtime.messages`: después del mid-fi.
- **Cabeceras** en `netlify.toml`: CSP, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- **Moderación en vivo** durante el testeo con `supabase db query --linked` (restaurar/ocultar con OK de Diego).
**Pendiente (no esta noche):** tope por identidad en `marcar_falso` y votos "no"; "sí" repetido no debe mover
`ultima_confirmacion`; captcha en alta anónima (P-16); validar bytes de evidencias; `npm audit fix` (auth-js, baja);
apagar registro por correo en Auth; caducidad de anónimos y `en_revision`.
**Por qué:** que 3 personas no puedan esconder una emergencia real durante el testeo, y defensa básica del sitio.

## D-025 · Diego mergea a `main` sin esperar revisión de LeoFigo74z
**Estado:** Aceptada por Diego · 2026-11-11
**Decisión:** la revisión de LeoFigo74z deja de ser requisito para mergear a `main`. Diego aprueba y mergea
sus PR con `gh pr merge --merge --admin` (sigue siendo merge commit, equivalente a `--no-ff`). Reemplaza la parte
"revisado por la otra persona" de AGENTS.md §3.12. Todo lo demás sigue igual: rama por tarea, PR, pruebas en verde.
**Por qué:** esperar la revisión retrasaba la construcción y el despliegue del mid-fi.

## D-026 · Mapa con menos ruido (humo en celular de Diego, 2026-11-11)
**Estado:** Aceptada por Diego · 2026-11-11 ("todas hazlas")
**Decisión:**
- **Hoja inferior arrastrable** (`lib/hoja.js`): arriba = más lista, abajo = solo mapa (full → min → mid). El asa sigue
  respondiendo a toques y hay botón "Ocultar y ver solo el mapa" para quien no arrastra. Antes solo respondía a toques
  y en el celular no bajaba con el dedo.
- **Hoja mínima:** se quita la fila "¿A quién acudo? / Refugios / Mapa completo" (las dos primeras viven en la pestaña
  Ayuda). Queda: "Ver alertas cercanas", la alerta más cercana (si hay) y Reportar (64 px, antes 76).
- **Barra superior (móvil):** sin la fila de chips de la leyenda; queda el botón "Leyenda y filtros". El panel abre
  con el interruptor de **daltonismo** arriba, junto a los colores.
- **Onboarding:** Accesibilidad pasa a ser el paso 2 (antes 4), para que texto grande o daltonismo apliquen al resto
  del registro. Reemplaza el orden de pasos del Equipo Registro (ronda 3).
- **Crédito de OpenStreetMap compacto:** botón "©" que abre "© OpenStreetMap". No se quita: la licencia ODbL y las
  reglas de uso de los tiles de OSM exigen el crédito.
- **Interruptores:** cualquier `role=switch` encendido se pinta encendido (el paso de accesibilidad decía "Activado"
  con el interruptor apagado).
**Pendiente:** "recorrido" (tutorial) del equipo: falta el material y su aprobación. Voz: falta saber qué falló.
**Por qué:** feedback de Diego tras probar en su celular: demasiadas cosas encima del mapa y la hoja no bajaba.

## D-027 · Gestos, vibración, voz de muestra y simulaciones (humo en celular, 2026-11-11)
**Estado:** Aceptada por Diego · 2026-11-11
**Decisión:**
- **Atrás dentro de la app** (`lib/historial.js`): cada pantalla es una entrada del historial del navegador, así que
  deslizar para regresar (iPhone) y el atrás de Android regresan a la pantalla anterior / al mapa en vez de salir de
  la app. "Reporte enviado" cierra el flujo: atrás va al mapa, nunca al formulario (evita reportes dobles).
- **Vibración al tocar** botones, enlaces e interruptores (10 ms), activada por omisión; se apaga en Accesibilidad y en
  el paso 2 del registro. Se guarda en el perfil anónimo: `accesibilidad.vibracion` (migración
  `accesibilidad_vibracion`; `guardar_accesibilidad` ahora mezcla). Safari de iPhone no permite vibrar desde la web.
- **Voz de muestra:** al activar "leer en voz alta" la app dice que se activó y así suena la voz.
- **Simulaciones (modo prueba):** en Más, "Simular una inundación" (bajo/medio/alto/crítico) pone una zona falsa a
  ~150 m. Solo en ese teléfono (`lib/simulacion.js`), marcada "Simulación", nada va a la nube; se borra al recargar.
**Pendiente:** persona en riesgo antes del 911 y niveles de agua subjetivos por estatura (revisar con el equipo);
textura de las tarjetas "pasan / no pasan"; tarjetas desalineadas (falta saber cuáles).
**Por qué:** feedback de Diego tras probar en su celular.

## D-028 · Pines en la calle, niveles con referencia fija, hoja v2 y reportes de ejemplo (2026-11-11)
**Estado:** Aceptada por Diego · 2026-11-11
**Decisión:**
- **Pines:** cada reporte activo se ve en su punto exacto (ícono del tipo + color/patrón del nivel; persona en riesgo
  roja y pulsando). Las zonas dejan de ser cuadros de 300 m con etiqueta: quedan como halo suave de 150 m.
- **Niveles con referencia fija:** "¿Cuánta agua hay?" usa banqueta y llanta (dibujo `NivelAgua`), no la estatura de
  quien reporta. Bajo = no sube de la banqueta; Medio = media llanta; Alto = cubre la llanta / no pasan carros.
- **Hoja mínima v2:** "Cerca de ti" + resumen por nivel (pastillas con conteo) + tarjeta de lo más cercano con el
  dibujo del agua (sin repetir el título).
- **Accesibilidad** a un toque en la barra superior móvil. **Tic háptico en iPhone** (Safari 18+, interruptor oculto).
- **Escenario de prueba local** (Más → Simulaciones): 8 reportes de todos los tipos y niveles, solo en ese teléfono.
- **Semilla en la nube** para el testeo: 9 reportes de ejemplo (todos los tipos y niveles) por la ZMG. Usuarios y
  reportes con prefijo `5eed`; limpieza: `delete from auth.users where id::text like '5eed0000-%'` (cascada).
**No se hizo:** rutas dentro de la app (requiere servicio de ruteo y que evite inundaciones; después del mid-fi).

## D-029 · Auditoría UX del mid-fi: una sola escala de nivel y menos ruido (2026-11-11)
**Estado:** Aceptada por Diego · 2026-11-11 ("vamos con tu recomendación")
**Decisión:**
- **Una sola escala:** el nivel que se MUESTRA (pines, zonas, lista, detalle, leyenda, filtros) es la altura del agua
  reportada (banqueta / media llanta / cubre la llanta → bajo / medio / alto). Las confirmaciones se muestran aparte
  ("Confirmado por N personas"). La zona toma el peor nivel de agua de sus reportes a ≤220 m (`zonasConNivelAgua`);
  sin reportes cercanos usa el nivel por confirmaciones (crítico → alto). Sin "crítico" en la UI. Solo front: el
  backend sigue calculando `nivel` por confirmaciones (D-021) — alinearlo queda para después del mid-fi.
- **Distancia real** en "Tu zona" (antes siempre "a 300 m").
- **Persona en riesgo sin nivel** en las listas (se atiende con el 911, no por altura del agua).
- **Barra superior compacta:** modo de transporte y Escuchar solo con ícono (con aria-label).
- **Detalle de alerta:** "¿Qué debes hacer?" y acciones arriba, con el dibujo del agua; datos completos plegados.
- **Onboarding sin "Registro terminado":** "Entrar a la app" desde el paso 4.

## D-030 · Color por tipo, barra inferior tipo píldora, 911 a pantalla completa y voz en iPhone (2026-11-11)
**Estado:** Aceptada por Diego · 2026-11-11 (con referencias de imagen para la barra)
**Decisión:**
- **Color por tipo de reporte** (`--t-calle` azul, `--t-casa` morado, `--t-coche` verde, persona en riesgo rojo):
  cabeza del pin, tarjetas de "¿Qué se inundó?" y listas. El nivel va en una chapita del pin (patrón + B/M/A).
  `--rm` (medio) pasa a naranja puro `#FF9F1C`: el anterior se leía rojo sin zoom.
- **Barra inferior:** píldora oscura con Mapa · Reportes · [+ Reportar] · Ayuda · Más y una "gota" que se desliza
  con efecto líquido a la pestaña activa (sin animación con "reducir movimiento"). "Más" sale de la barra superior y
  el botón grande "Reportar" sale de la hoja (lo reemplaza el "+").
- **Persona en riesgo:** al tocar la tarjeta abre directo la pantalla roja completa "Llama al 911" (como en la ronda
  1) y desde ahí pone el aviso en el mapa con tu ubicación. Reemplaza el aviso dentro del formulario de la ronda 3.
- **Voz:** ya no se llama `cancel()` antes de cada frase si no hay nada sonando (Safari iOS se quedaba callado) y se
  elige una voz en español si existe. Ajustes usa la misma función.

## D-031 · Rutas dentro de la app, marcas por calle y nivel más visible (2026-11-11)
**Estado:** Aceptada por Diego · 2026-11-11 (pidió no mandar a Google Maps)
**Decisión:**
- **Rutas dentro de la app** con el OSRM público de OpenStreetMap Alemania (`routing.openstreetmap.de`, FOSSGIS;
  gratis, sin llave, CORS; perfil car/foot/bike según el medio). Se ven en "Buscar → Cómo llegar" y desde el detalle
  de una alerta: tiempo, distancia, rutas alternativas (si el servidor las da), **reportes en el camino** (a ≤80 m de
  la línea), paso a paso en español y la línea en el mapa con chip "Quitar". Sustituye los enlaces a Google Maps.
- **Privacidad (excepción a "el GPS no sale del teléfono"):** para calcular la ruta el origen se manda REDONDEADO a
  3 decimales (~100 m) a ese servicio; no se guarda en nuestra base. Se avisa en la pantalla. CSP `connect-src` suma
  `https://routing.openstreetmap.de`. Sin GPS real, la ruta sale del punto de ejemplo (se avisa).
- **Limitación:** la ruta no esquiva inundaciones sola; las rutas se ordenan por menos reportes en el camino.
  Servidor público con límites de uso: suficiente para el mid-fi; para producción, servidor propio o con contrato.
- **Por calle, no por zona:** se quitan los halos de zona del mapa; solo pines en el punto de cada reporte.
- **Nivel más visible:** aro grueso con el color del nivel alrededor del pin + chapita más grande.

## D-032 · Pruebas de campo antes de cada entrega del front (2026-11-11)
**Contexto:** usuarios reportaron voz con acento extranjero en iPhone y un reporte que no salía manejando con señal
débil. Las pruebas unitarias pasaban porque repetían las mismas suposiciones del código.
**Decisión:**
- Antes de cada entrega se corre `docs/PRUEBAS_CAMPO.md`: escenarios automáticos en navegador real (Playwright,
  WebKit + Chromium) contra el sitio publicado y una lista corta en teléfono real.
- Playwright (gratuito) vive aparte en `web/campo/` con su propio `package.json`: no entra al build de la app.
- Los números de la app se justifican con una medición; si no se puede medir, `POR CONFIRMAR`.
