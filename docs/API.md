# CONTRATO DE API (para los equipos de front)
> Todo se consume con `supabase-js`. Llave pública `anon` + sesión anónima.
> Si cambias algo aquí, avisa a los equipos y registra en PROGRESO.md.
> Estado: **v1 congelada (F1-T6, 2026-10-23)**. Cambios que rompan algo → v2, avisando a los 5 equipos.
> Sin sesión (`anon`) solo se lee lo público; toda escritura pide sesión anónima.
> ✅ = ya funciona en la nube · ⏳ = contrato fijo, implementación pendiente (fase indicada).

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
await supabase.rpc('registrar_entrada', { medio: 'auto' })        // peaton|bici|auto|transporte_publico
await supabase.rpc('guardar_accesibilidad', { prefs: { daltonismo: true } })
```
Auth crea el perfil automáticamente al abrir la sesión. Cada llamada a `registrar_entrada`
guarda una visita nueva; ambas RPC devuelven `null` al completarse. Para `prefs`, v1 acepta
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
  p_pasan_carros: false,
  p_lat: 20.6597, p_lng: -103.3496, p_precision_m: 15
})
// → { id, estado: 'pendiente' | 'activo' }   ✅ (requiere sesión anónima: F1-T2)
// Evidencia opcional ✅ local · ⏳ nube (F2-T4): después de crear el reporte,
// quitar metadatos EXIF de la foto en el front (P-19) y subir al bucket privado:
const ruta = `${reporte.id}/${crypto.randomUUID()}.png`
await supabase.storage.from('evidencias').upload(ruta, archivoSinExif,
  { contentType: 'image/png', upsert: false })
await supabase.rpc('agregar_evidencia',
  { p_reporte_id: reporte.id, p_ruta: ruta, p_tipo: 'foto' }) // → UUID de evidencia
```
Errores (en `error.message`): `sin_sesion`, `parametros_invalidos`, `fuera_de_zmg`, `limite_por_hora`, `duplicado_cercano`, `id_en_uso`.
La ruta de evidencia siempre es `<reporte_uuid>/<archivo_uuid>.<extensión>`; acepta
`jpg|jpeg|png|webp` para `foto` y `mp4|webm` para `video`. Tamaño máximo provisional:
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
await supabase.rpc('reportes_cercanos', { p_lat, p_lng, p_radio_m: 300 })   // para el aviso; radio topado a radio_cercanos_max_m
// → [{ id, tipo, pasan_carros, lat, lng, distancia_m, ultima_confirmacion, es_propio }]   error: sin_sesion
await supabase.rpc('confirmar_reporte', { p_reporte_id, p_sigue: true })   // → { reporte_id, estado }
await supabase.rpc('marcar_falso', { p_reporte_id })                       // → { reporte_id, estado }
```
Errores de confirmar/marcar_falso: `sin_sesion`, `parametros_invalidos` (p_sigue nulo), `reporte_no_existe`, `propio_reporte`, `reporte_no_activo`.
`es_propio = true` → el front no debe ofrecer confirmar ese reporte.

## Mapa (Equipo Mapa) ✅ zonas y reportes · ✅ realtime y refugios locales · ⏳ nube (F3)
```js
await supabase.from('zonas_publicas').select('*')   // celda, lat, lng, nivel, total_reportes, total_confirmaciones, alguno_no_pasan_carros, actualizado_en
// celda = '<ix>_<iy>' (enteros: coordenada UTM 13N / tamano_celda_m), p. ej. '2240_7617'. Mismo formato en notificaciones.
await supabase.rpc('reportes_activos_en_area', { min_lat, min_lng, max_lat, max_lng })
// → [{ id, tipo, pasan_carros, lat, lng, ultima_confirmacion, creado_en }]   errores: parametros_invalidos (min ≥ max, fuera de rango), area_demasiado_grande
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
await supabase.rpc('suscribir_push', { p_endpoint, p_p256dh, p_auth, p_municipio })   // interés por municipio/celda, nunca un punto
await supabase.from('alertas_clima_vigentes').select('*')
await supabase.rpc('derivar', { p_caso: 'casa', p_municipio: 'Zapopan', p_lat, p_lng })
// → { instituciones: [...], refugios: [...], pasos: [...] }
```

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
- `nivel` siempre como texto (`bajo|medio|alto`) además de cualquier color.

## Datos de prueba
`supabase/seed.sql` carga 30 reportes falsos en la ZMG, **solo en local** (`supabase db reset`).
La base en la nube arranca vacía: los datos reales llegan cuando los equipos reporten.
