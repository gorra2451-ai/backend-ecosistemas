# CONTRATO DE API (para los equipos de front)
> Todo se consume con `supabase-js`. Llave pública `anon` + sesión anónima.
> Si cambias algo aquí, avisa a los equipos y registra en PROGRESO.md.
> Estado: **v0 revisado (F0-T5, 2026-10-22)** — se congela al cerrar la Fase 1.
> Sin sesión (`anon`) solo se lee lo público; toda escritura pide sesión anónima.

## Arranque (Equipo Registro)
```js
const { data } = await supabase.auth.signInAnonymously()
await supabase.rpc('registrar_entrada', { medio: 'auto' })        // peaton|bici|auto|transporte_publico
await supabase.rpc('guardar_accesibilidad', { prefs: { daltonismo: true } })
```

## Reportar (Equipo Reporte)
```js
await supabase.rpc('crear_reporte', {
  p_id: crypto.randomUUID(),   // el front lo genera; reintentar con el mismo id no duplica
  p_tipo: 'calle',             // calle|casa|coche|persona_en_riesgo
  p_pasan_carros: false,
  p_lat: 20.6597, p_lng: -103.3496, p_precision_m: 15
})
// → { id, estado: 'pendiente' | 'activo' }
// Evidencia opcional: subir a Storage bucket 'evidencias/<reporte_id>/<archivo>'
// y luego rpc('agregar_evidencia', { p_reporte_id, p_ruta, p_tipo: 'foto' })
```
Errores (en `error.message`): `sin_sesion`, `fuera_de_zmg`, `limite_por_hora`, `duplicado_cercano`, `id_en_uso`.

## Confirmar (Equipo Confirmación)
```js
await supabase.rpc('reportes_cercanos', { p_lat, p_lng, p_radio_m: 300 })   // para el aviso; radio topado a radio_cercanos_max_m
// → [{ id, tipo, pasan_carros, lat, lng, distancia_m, ultima_confirmacion, es_propio }]   error: sin_sesion
await supabase.rpc('confirmar_reporte', { p_reporte_id, p_sigue: true })   // → { reporte_id, estado }
await supabase.rpc('marcar_falso', { p_reporte_id })                       // → { reporte_id, estado }
```
Errores de confirmar/marcar_falso: `sin_sesion`, `reporte_no_existe`, `propio_reporte`, `reporte_no_activo`.
`es_propio = true` → el front no debe ofrecer confirmar ese reporte.

```js
```

## Mapa (Equipo Mapa)
```js
await supabase.from('zonas_publicas').select('*')   // celda, lat, lng, nivel, total_reportes, total_confirmaciones, alguno_no_pasan_carros, actualizado_en
// celda = '<ix>_<iy>' (enteros: coordenada UTM 13N / tamano_celda_m), p. ej. '2240_7617'. Mismo formato en notificaciones.
await supabase.rpc('reportes_activos_en_area', { min_lat, min_lng, max_lat, max_lng })
// → [{ id, tipo, pasan_carros, lat, lng, ultima_confirmacion, creado_en }]   error: area_demasiado_grande
await supabase.from('refugios_publicos').select('*')
// Tiempo real por Broadcast (no postgres_changes: filtraría el autor). Canal y payload: F3-T3.
supabase.channel('reportes').on('broadcast', { event: 'cambio' }, cb).subscribe()
// Rutas alternas: el front arma link a Waze/Google Maps con lat/lng (no pasa por el backend)
```

## Notificaciones y derivación (Equipo 5)
```js
await supabase.rpc('suscribir_push', { p_endpoint, p_p256dh, p_auth, p_municipio })   // interés por municipio/celda, nunca un punto
await supabase.from('alertas_clima_vigentes').select('*')
await supabase.rpc('derivar', { p_caso: 'casa', p_municipio: 'Zapopan', p_lat, p_lng })
// → { instituciones: [...], refugios: [...], pasos: [...] }
```

## Admin (panel interno)
```js
await supabase.rpc('reportes_en_revision')                                    // solo admins
await supabase.rpc('ocultar_reporte', { p_reporte_id, p_motivo })             // → { reporte_id, estado }
await supabase.rpc('restaurar_reporte', { p_reporte_id, p_motivo })           // en_revision|oculto → activo
```
Errores (en este orden): `no_autorizado`, `motivo_requerido`, `reporte_no_existe`, `estado_invalido`
(restaurar algo que no está `en_revision`/`oculto`).

## Formato de respuesta
- Ubicaciones siempre como `{ lat, lng }`.
- Fechas en ISO 8601 UTC; el front convierte a hora de Guadalajara.
- `nivel` siempre como texto (`bajo|medio|alto`) además de cualquier color.

## Datos de prueba
`supabase/seed.sql` (Fase 1) carga reportes falsos en la ZMG para que el front pruebe sin esperar lluvia.
