# CONTRATO DE API (para los equipos de front)
> Todo se consume con `supabase-js`. Llave pública `anon` + sesión anónima.
> Si cambias algo aquí, avisa a los equipos y registra en PROGRESO.md.
> Estado: **v2 (D-021, 2026-11-10)**: manda lo validado por los equipos en el mid-fi. Cambios frente a v1:
> `gravedad`, publicación por 5 confirmaciones, niveles por confirmaciones (+`critico`), `mis_reportes`,
> `reportes_cercanos` con pendientes, `moto`, casos nuevos de `derivar`, video `.mov` y `preferencias_push`.
> v1 se congeló en F1-T6 (2026-10-23).
> Sin sesión (`anon`) solo se lee lo público; toda escritura pide sesión anónima.
> Las secciones indican por separado lo probado **localmente** y lo disponible **en nube**.
> Las incorporaciones de Leo siguen locales hasta revisión y publicación autorizada.

## Conexión
```js
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  'https://hdaolwqvxofmvqahzjvp.supabase.co',
  'sb_publishable_…'   // llave publicable: pídela al equipo de backend; es pública, va en el front
)
```
Nunca uses la llave `secret`/`service_role` en el front.

## Arranque (Equipo Registro) ✅ local · ⏳ nube (F1-T2)
```js
const { data } = await supabase.auth.signInAnonymously()
await supabase.rpc('registrar_entrada', { medio: 'auto' })        // peaton|bici|moto|auto|transporte_publico ("Omitir" = no llamar)
await supabase.rpc('guardar_accesibilidad', { prefs: { daltonismo: true } })  // D-027: también { vibracion: false }; se MEZCLA con lo guardado
```
Auth crea el perfil automáticamente al abrir la sesión. Cada llamada a `registrar_entrada`
guarda una visita nueva; ambas RPC devuelven `null` al completarse. Un perfil puede registrar hasta `max_entradas_por_hora` visitas por hora (20, D-017); el exceso devuelve `limite_entradas`. Para `prefs`, v1 acepta
`{}` o `{ daltonismo: boolean }`; otras claves o valores no booleanos dan
`parametros_invalidos`. Sin sesión no se pueden llamar las RPC (`42501` sin token;
`sin_sesion` si el rol llega sin usuario). Solo el dueño puede leer su perfil y sus entradas.
La sesión anónima está habilitada en la configuración **local**. Diego debe habilitarla también
en Auth del proyecto remoto al publicar F1-T2; captcha y límite de altas siguen en P-16.

## Reportar (Equipo Reporte) ✅
```js
const { data: reporte } = await supabase.rpc('crear_reporte', {
  p_id: crypto.randomUUID(),   // UUID v4 generado en el front (nunca v1: incluye la MAC); reintentar con el mismo id no duplica
  p_tipo: 'calle',             // calle|casa|coche|persona_en_riesgo
  p_pasan_carros: null,        // v2: puede ir null si viene p_gravedad (se deduce)
  p_lat: 20.6597, p_lng: -103.3496, p_precision_m: 15,
  p_gravedad: 'bloqueado'      // v2, opcional: bloqueado|limitado|sin_riesgo
})
// → { id, estado: 'pendiente' | 'activo' }   ✅ (requiere sesión anónima: F1-T2)
// persona_en_riesgo nace 'activo'; lo demás nace 'pendiente' y se publica con 5 confirmaciones "sí".
// Evidencia opcional ✅ local · ⏳ nube (F2-T4): después de crear el reporte,
// quitar metadatos EXIF de la foto en el front (P-19) y subir al bucket privado:
const ruta = `${reporte.id}/${crypto.randomUUID()}.png`
await supabase.storage.from('evidencias').upload(ruta, archivoSinExif,
  { contentType: 'image/png', upsert: false })
await supabase.rpc('agregar_evidencia',
  { p_reporte_id: reporte.id, p_ruta: ruta, p_tipo: 'foto' }) // → UUID de evidencia
```
Errores (en `error.message`): `sin_sesion`, `parametros_invalidos`, `fuera_de_zmg`, `limite_por_hora`, `duplicado_cercano`, `id_en_uso`.
**Gravedad (v2):** `bloqueado` (no se puede transitar), `limitado` (con precaución), `sin_riesgo`
(encharcamiento leve). Si viene `p_gravedad`, **manda sobre** `p_pasan_carros`: `bloqueado` → `false`,
los otros → `true`. Sin `p_gravedad`, `p_pasan_carros` sigue siendo obligatorio (como v1).
La evidencia se elige antes de enviar y se sube inmediatamente después de `crear_reporte`.
```js
await supabase.rpc('mis_reportes')   // v2, requiere sesión; máx. 20, más recientes primero
// → [{ id, tipo, gravedad, estado, confirmaciones_si, confirmaciones_no, marcas_falso, nivel,
//      lat, lng, creado_en, ultima_confirmacion }]   error: sin_sesion
// confirmaciones_no no incluye las marcas de falso (van en marcas_falso). nivel null = aún sin nivel.
```
La ruta de evidencia siempre es `<reporte_uuid>/<archivo_uuid>.<extensión>`; acepta
`jpg|jpeg|png|webp` para `foto`. **Video deshabilitado (D-023, temporal):** el bucket solo acepta imágenes y `agregar_evidencia` con `video` lanza `video_deshabilitado` (los videos conservan GPS en sus metadatos). Tamaño máximo provisional:
10 MiB por archivo y 3 archivos por reporte (`parametros`, P-18). Solo el autor puede subir;
no se permite sobrescribir. La RPC exige que el objeto exista en Storage y sea suyo;
repetirla con la misma ruta devuelve el mismo UUID. Errores adicionales:
`reporte_no_existe`, `reporte_no_autorizado`, `reporte_no_activo`, `archivo_no_existe`,
`tipo_archivo_invalido`, `archivo_invalido`, `limite_evidencias`.
El bucket es privado: para leer una evidencia autorizada se usa
`supabase.storage.from('evidencias').download(ruta_storage)` (no `getPublicUrl`).
El autor puede leer su evidencia pendiente; las evidencias de reportes activos son públicas.
Archivos subidos por error y todavía sin registrar pueden borrarse por su dueño.

## Confirmar (Equipo Confirmación) ✅
```js
await supabase.rpc('reportes_cercanos', { p_lat, p_lng, p_radio_m: 300 })   // para el aviso; radio topado a radio_cercanos_max_m (1000; 40000 temporal mid-fi con ?prueba=1, D-022)
// → [{ id, tipo, gravedad, pasan_carros, lat, lng, distancia_m, ultima_confirmacion, creado_en,
//      confirmaciones_si, nivel, estado, es_propio }]   error: sin_sesion
// v2: incluye 'pendiente' y 'activo' (para poder confirmarlos). Sin autor.
await supabase.rpc('confirmar_reporte', { p_reporte_id, p_sigue: true })   // true = "Sí, sigue"; false = "Ya se secó / El agua bajó"
await supabase.rpc('marcar_falso', { p_reporte_id })                       // "Calle seca / Nunca hubo agua" · 6 marcas → en_revision en el mid-fi (D-024; normal 3)
// ambas → { reporte_id, estado }; estado pasa a 'activo' cuando el "sí" publica un pendiente
```
Errores de confirmar/marcar_falso: `sin_sesion`, `parametros_invalidos` (p_sigue nulo), `reporte_no_existe`, `propio_reporte`, `reporte_no_activo` (v2: ni `pendiente` ni `activo`; D-023: también un `pendiente` cuya `ventana_activacion_min` ya venció, aunque el cron no haya corrido).
`es_propio = true` → el front no debe ofrecer confirmar ese reporte.
**Publicación (v2, D-021):** un reporte pasa a `activo` (visible en el mapa) al juntar
`confirmaciones_para_publicar` (5) confirmaciones "sí" de otras personas. `persona_en_riesgo` se
publica con su propio reporte. Si no las junta en `ventana_activacion_min` (60; 1440 temporal en el mid-fi, D-022) pasa a `resuelto`.
**Nivel (v2):** por confirmaciones "sí" (`parametros.nivel_*_min`): **bajo 5–9 · medio 10–14 ·
alto 15–19 · critico ≥ 20**. `persona_en_riesgo` activa con menos de 15 = `alto`. Un `activo` con menos
de 5 "sí" (p. ej. restaurado por admin) = `bajo`; un `pendiente` tiene `nivel = null`.

## Mapa (Equipo Mapa) ✅ zonas y reportes · ✅ realtime y refugios locales · ⏳ nube (F3)
```js
await supabase.from('zonas_publicas').select('*')   // celda, lat, lng, nivel (bajo|medio|alto|critico), total_reportes, total_confirmaciones, alguno_no_pasan_carros, actualizado_en
// v2: nivel = suma de "sí" de los activos de la celda (mín. bajo; alto si hay persona_en_riesgo). pasan_carros ya no sube el nivel.
// celda = '<ix>_<iy>' (enteros: coordenada UTM 13N / tamano_celda_m), p. ej. '2240_7617'. Mismo formato en notificaciones.
await supabase.rpc('reportes_activos_en_area', { min_lat, min_lng, max_lat, max_lng })
// → [{ id, tipo, pasan_carros, lat, lng, ultima_confirmacion, creado_en, gravedad, confirmaciones_si, nivel }]   errores: parametros_invalidos (min ≥ max, fuera de rango), area_demasiado_grande
await supabase.from('refugios_publicos').select('*')
// → [{ id, nombre, lat, lng, direccion, municipio, capacidad, fuente, verificado_en }]
// Puede devolver [] hasta que el equipo aporte fuentes oficiales verificadas (P-07).
// Broadcast público de invalidación, sin postgres_changes ni filas privadas.
supabase.channel('reportes').on('broadcast', { event: 'cambio' }, ({ payload }) => {
  // payload = { id: reporte_uuid, estado: 'activo'|'resuelto'|'oculto'|'en_revision'|'borrado' }
  // Consultar de nuevo reportes_activos_en_area; quitar el id si salió del mapa.
}).subscribe()
supabase.channel('zonas').on('broadcast', { event: 'cambio' }, ({ payload }) => {
  // payload = { celda: '<ix>_<iy>', id: uuid_del_mensaje }
  // Consultar de nuevo zonas_publicas para esa celda (puede haber desaparecido).
}).subscribe()
// Rutas alternas: el front arma link a Waze/Google Maps con lat/lng (no pasa por el backend)
```

## Notificaciones y derivación (Equipo 5) ⏳ F4
```js
await supabase.rpc('suscribir_push', {
  p_endpoint, p_p256dh, p_auth, p_municipio: 'Guadalajara'
}) // → UUID de suscripción; interés por municipio, nunca un punto
// Opción por celda: p_municipio: null, p_celda: '2240_7617'.
await supabase.rpc('baja_push', { p_endpoint }) // → boolean
await supabase.rpc('preferencias_push', {          // v2, requiere sesión; solo el dueño
  p_endpoint, p_solo_cambios: false, p_solo_fuertes: true, p_silenciar_min: 60
}) // → { solo_cambios, solo_fuertes, silenciado_hasta }
// null en un parámetro = no cambiarlo; p_silenciar_min: 0 quita el silencio, máx. max_minutos_silencio_push (10080).
// Errores: sin_sesion, parametros_invalidos, suscripcion_no_existe (no existe o es de otro).
await supabase.from('alertas_clima_vigentes').select('*')
// → [{ id, fuente, fuente_url, nivel: 'bajo'|'medio'|'alto', titulo, descripcion,
//       municipio, vigente_desde, vigente_hasta, verificado_en }]
await supabase.rpc('derivar', { p_caso: 'casa', p_municipio: 'Zapopan', p_lat, p_lng })
// p_caso: casa|coche|persona_herida|tercero|otro|calle|arbol_caido|riesgo_electrico (v2)
// → { instituciones: [{id,nombre,tipos_caso,telefono,url,municipio,horario,fuente,verificado_en}],
//     refugios: [{id,nombre,direccion,municipio,capacidad,fuente,verificado_en,lat,lng,distancia_m}],
//     pasos: [string,...] }
```
**Push ✅ local, ⏳ nube (F4-T1):** el navegador pide permiso al usuario y obtiene
`endpoint`, `p256dh` y `auth` de `PushSubscription`. Convierte las claves a base64url.
La RPC requiere sesión anónima, acepta exactamente un ámbito (`municipio` o `celda`),
normaliza municipio a minúsculas y devuelve el mismo UUID al reintentar con el mismo
endpoint. El front no puede consultar endpoints ni claves; solo puede dar de baja el
suyo con `baja_push`. Renovar el mismo endpoint cuenta como uso. Una suscripción
sin renovación ni aviso entregado durante 30 días se borra automáticamente (D-017;
plazo configurable en `parametros`). Tras caducar, una nueva alta devuelve un UUID
nuevo. Errores: `sin_sesion`, `parametros_invalidos`,
`proveedor_push_no_permitido`, `suscripcion_en_uso`, `limite_suscripciones` (5 dispositivos provisionales, P-20). Solo se aceptan endpoints HTTPS de FCM, Mozilla, Apple o subdominios de `.notify.windows.com`, sin puerto explícito.
La Edge Function `enviar-push` es **interna**: solo el servidor la invoca con `apikey`
secreta. El front nunca recibe esa clave. Requiere VAPID configurado en el entorno
servidor; no hay credenciales de producción en el repo.
**Avisos por zona ✅ local, ⏳ nube (F4-T2):** al aparecer el primer reporte activo
de una celda, o resolverse el último, se encola un aviso por suscripción a esa celda.
El límite `minutos_entre_avisos` (30 minutos provisionales) solo suprime nuevas activaciones de la misma celda y suscripción; el aviso de fin de zona siempre se encola cuando desaparece el último reporte activo, también al pasar a `oculto` o `en_revision`.
El trabajador interno `procesar-avisos` reclama lotes, invoca `enviar-push` y reintenta
fallos. Antes de reclamar descarta estados obsoletos, alertas vencidas o retiradas y
avisos de intereses anteriores del dispositivo. El payload Web Push incluye `tag`
estable por entrega: el Service Worker debe usarlo al mostrar la notificación para
reemplazar duplicados de reintentos. El front no llama al trabajador ni lee la cola. Por ahora las suscripciones por
municipio no reciben este evento: falta una delimitación municipal verificada (P-21).
**Preferencias (v2) ✅ local:** con `silenciado_hasta` vigente no se encola ni se entrega nada a
esa suscripción. Con `solo_fuertes` solo llegan clima `alto` y zonas que se activan en `alto|critico`.
Lo que ya estaba en cola cuando se silencia o se activa `solo_fuertes` se descarta (no llega tarde).
`solo_cambios` se guarda; hoy los avisos de zona ya son solo de cambio (activada/resuelta).
**Clima ✅ local, ⏳ nube (F4-T3):** la vista solo entrega alertas verificadas y
vigentes, cargadas manualmente por el servicio con URL HTTPS de la fuente, municipio y
fechas. Un trabajo programado encola el aviso para suscripciones de ese municipio.
El catálogo empieza vacío mientras se confirma la fuente (P-06) y la escala (P-23).
**Derivación ✅ local, ⏳ nube (F4-T4):** `derivar` acepta
`casa|coche|persona_herida|tercero|otro|calle|arbol_caido|riesgo_electrico`, municipio y
coordenadas válidas. Pasos de `riesgo_electrico` incluyen "Reporta a CFE al 071 o al 911"
(071 POR CONFIRMAR con fuente oficial, P-34). Solo entrega
instituciones verificadas para ese caso y municipio y hasta cinco refugios verificados
dentro de 20 km (límites provisionales P-24). Si no hay fichas verificadas, devuelve
listas vacías y pasos generales. La consulta no guarda ubicación ni crea folios.
Error: `parametros_invalidos`. El catálogo oficial está pendiente de P-05/P-07.

## Admin (panel interno) ✅
```js
await supabase.rpc('reportes_en_revision')                                    // solo admins
await supabase.rpc('ocultar_reporte', { p_reporte_id, p_motivo })             // → { reporte_id, estado }
await supabase.rpc('restaurar_reporte', { p_reporte_id, p_motivo })           // en_revision|oculto → activo
```
Errores (en este orden): `no_autorizado`, `motivo_requerido`, `reporte_no_existe`, `estado_invalido`
(restaurar algo que no está `en_revision`/`oculto`).

## Lectura directa de tablas
`reportes` (solo activos, sin autor) y `confirmaciones` (solo `reporte_id`, `sigue`, `falso`) se pueden leer
con `from(...)`, pero lo recomendado es usar las RPC y vistas de arriba.

## Formato de respuesta
- Ubicaciones siempre como `{ lat, lng }`.
- Fechas en ISO 8601 UTC; el front convierte a hora de Guadalajara.
- `nivel` siempre como texto (`bajo|medio|alto|critico`) además de cualquier color.

## Datos de prueba
`supabase/seed.sql` carga 30 reportes falsos en la ZMG, **solo en local** (`supabase db reset`).
La base en la nube arranca vacía: los datos reales llegan cuando los equipos reporten.
