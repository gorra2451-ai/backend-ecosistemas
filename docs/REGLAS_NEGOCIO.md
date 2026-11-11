# REGLAS DE NEGOCIO
> Todos los números salen de la tabla `parametros`. Aquí se escriben con su nombre.

## 1. Ciclo de vida de un reporte
```
           crear_reporte
                │
                ▼
          ┌──pendiente──┐  junta ≥ confirmaciones_para_publicar "sí"
          │             │  de otras personas (D-021)
          │             ▼
          │          activo ◄──── confirmación "sí" (reinicia el reloj)
          │             │
          │             ├── votos_no_para_resolver "no" ──► resuelto
          │             ├── minutos_expiracion sin "sí" ──► resuelto
          │             ├── banderas_para_revision falsos ► en_revision ──admin──► activo | oculto
          │             └── admin lo oculta ─────────────► oculto
          └── ventana_activacion_min sin juntar confirmaciones ──► resuelto
```
- Solo los reportes `activo` se ven en el mapa y cuentan para zonas. Los `pendiente` se ven en
  `reportes_cercanos` (con sesión) para que otras personas los confirmen.
- `persona_en_riesgo` se activa con `umbral_persona_en_riesgo` (1) reportes: nace `activo` y aparece primero.
- **Publicación (D-021, validado por los equipos):** un `pendiente` pasa a `activo` cuando junta
  `confirmaciones_para_publicar` (5) confirmaciones "sí" de **otras** personas. Se evalúa tras cada "sí".
- **Retirado (D-021):** la activación por `umbral_activacion` reportes cercanos (P-01) y "un reporte
  nuevo junto a uno `activo` nace `activo`" (P-15). `umbral_activacion` queda en `parametros` marcado OBSOLETO.

## 2. Crear reporte (`crear_reporte`)
- Requiere sesión (anónima vale).
- `gravedad` opcional (`bloqueado|limitado|sin_riesgo`). Si viene, deduce `pasan_carros`
  (`bloqueado` → no pasan; otros → pasan) y manda sobre lo que mande el cliente. Sin gravedad,
  `pasan_carros` es obligatorio.
- Ubicación dentro de la ZMG (tabla `limites_zmg`, función `dentro_de_zmg`). Fuera → `fuera_de_zmg`.
- Fecha y hora las pone el servidor, nunca el cliente.
- Límite: `max_reportes_por_hora` por usuario.
- Si el `id` ya existe del mismo usuario → devuelve el existente (idempotente). De otro usuario → `id_en_uso`.
- Un usuario no puede reportar dos veces el mismo punto (≤ radio) mientras su reporte siga vivo.

## 3. Confirmar (`confirmar_reporte`)
- Una confirmación por usuario por reporte; se puede cambiar de "sí" a "no".
- No puedes confirmar tu propio reporte.
- Se confirman reportes `pendiente` (así se publican) y `activo`. Los demás → `reporte_no_activo`.
- "sí" actualiza `ultima_confirmacion`. "no" suma hacia `votos_no_para_resolver`; cuentan los "no"
  registrados después del último "sí".
- El aviso "¿sigue inundado?" lo dispara el front al estar cerca (D-006).

## 4. Expiración
- Tarea `pg_cron` cada 5 min: pasa a `resuelto` lo que cumpla las reglas de §1.
- Cada cambio de estado se publica por Realtime y puede disparar notificación.

## 5. Zonas de calor
- Celdas de `tamano_celda_m`. **Nivel por confirmaciones "sí" (D-021)**, sumando las de los reportes
  activos de la celda: `bajo` ≥ `nivel_bajo_min` (5) · `medio` ≥ `nivel_medio_min` (10) ·
  `alto` ≥ `nivel_alto_min` (15) · `critico` ≥ `nivel_critico_min` (20).
- Una celda o reporte activo con menos de 5 "sí" es `bajo` (ya está publicado). Un `pendiente` no tiene nivel.
- **Decisión D-021:** `persona_en_riesgo` activa con menos de `nivel_alto_min` "sí" es `alto` (nace activa
  sin confirmaciones y es lo más urgente); con ≥ 20 es `critico`. La celda que la contiene, igual.
- `pasan_carros=false` ya no sube la zona a `alto` (el nivel sale solo de las confirmaciones).
- El front no debe depender solo del color: la API entrega también `nivel` como texto.

## 6. Notificaciones
- Se notifica por **cambio de estado** (zona nueva activa, zona resuelta) y por alerta de clima.
- Nunca más de 1 aviso por zona cada `minutos_entre_avisos` (30) por usuario **(propuesta)**.
- Solo a quien se suscribió y aceptó permisos.
- Preferencias (D-021, `preferencias_push`): `silenciado_hasta` vigente → no se encola ni se entrega;
  `solo_fuertes` → solo clima `alto` y zonas que se activan en `alto|critico`. Lo ya encolado que deja de
  cumplir se descarta al reclamar. `solo_cambios` se guarda (los avisos de zona ya son solo de cambio).
- `procesar-avisos` reclama hasta `lote_procesar_avisos` (20) por ejecución;
  `enviar-push` usa `ttl_enviar_push_seg` (3600 s) para el proveedor Web Push.
- Los avisos por reporte se agrupan por celda; sin polígonos oficiales no se asigna un
  municipio al reporte (P-21). Las alertas climáticas manuales sí declaran municipio,
  requieren fuente HTTPS, verificación y vigencia antes de aparecer o encolarse (P-06/P-23).

## 7. Derivación
- Entrada: tipo de caso (`casa`,`coche`,`persona_herida`,`tercero`,`otro`,`calle`,`arbol_caido`,
  `riesgo_electrico`) + municipio. Pasos generales (D-021): `riesgo_electrico` → alejarse 10 m de cables,
  no tocar agua cercana, reportar a CFE al 071 (POR CONFIRMAR, P-34) o al 911; `arbol_caido` → no mover
  cables enredados, avisar a Protección Civil por el 911; `calle` → no cruzar si el agua cubre la
  banqueta o pasa de la rodilla.
- Salida: instituciones verificadas para ese caso, refugios más cercanos y pasos a seguir.
- La plataforma no da seguimiento al folio: solo orienta a dónde acudir.
- Sin fuentes verificadas, las listas de instituciones y refugios quedan vacías. Los
  pasos generales no sustituyen indicaciones oficiales (P-05/P-07/P-24).

## 8. Moderación
- El admin puede ocultar reportes; cada acción queda en `acciones_admin` con motivo.
- Marcar como falso = confirmación "no" + `falso = true`; `banderas_para_revision` (3) lo mandan a
  `en_revision` (sale del mapa) **(propuesta)**. El admin lo regresa a `activo` u `oculto`.
- Los admins están en la tabla `administradores` (alta solo por SQL con llave de servicio).
