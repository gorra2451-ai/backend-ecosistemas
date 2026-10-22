# CONTRATO DE API (para los equipos de front)
> Todo se consume con `supabase-js`. Llave pública `anon` + sesión anónima.
> Si cambias algo aquí, avisa a los equipos y registra en PROGRESO.md.
> Estado: **BORRADOR v0** — se congela al cerrar la Fase 1.

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
Errores: `fuera_de_zmg`, `limite_por_hora`, `duplicado_cercano`, `sin_sesion`.

## Confirmar (Equipo Confirmación)
```js
await supabase.rpc('reportes_cercanos', { p_lat, p_lng, p_radio_m: 300 })   // para el aviso
await supabase.rpc('confirmar_reporte', { p_reporte_id, p_sigue: true })
await supabase.rpc('marcar_falso', { p_reporte_id })
```

## Mapa (Equipo Mapa)
```js
await supabase.from('zonas_publicas').select('*')            // celda, centro, nivel, total_reportes...
await supabase.rpc('reportes_activos_en_area', { min_lat, min_lng, max_lat, max_lng })
await supabase.from('refugios_publicos').select('*')
supabase.channel('zonas').on('postgres_changes', { event: '*', schema: 'public', table: 'reportes' }, cb).subscribe()
// Rutas alternas: el front arma link a Waze/Google Maps con lat/lng (no pasa por el backend)
```

## Notificaciones y derivación (Equipo 5)
```js
await supabase.rpc('suscribir_push', { p_endpoint, p_p256dh, p_auth })
await supabase.from('alertas_clima_vigentes').select('*')
await supabase.rpc('derivar', { p_caso: 'casa', p_municipio: 'Zapopan', p_lat, p_lng })
// → { instituciones: [...], refugios: [...], pasos: [...] }
```

## Formato de respuesta
- Ubicaciones siempre como `{ lat, lng }`.
- Fechas en ISO 8601 UTC; el front convierte a hora de Guadalajara.
- `nivel` siempre como texto (`bajo|medio|alto`) además de cualquier color.

## Datos de prueba
`supabase/seed.sql` (Fase 1) carga reportes falsos en la ZMG para que el front pruebe sin esperar lluvia.
