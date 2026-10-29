# MODELO DE DATOS (v0 revisado en F0-T5 · 2026-10-22)
> Nombres en español, snake_case. Toda tabla con RLS. Ubicaciones en `geography(Point, 4326)`.
> Dueño de cada tabla entre corchetes: **[D]** Diego · **[C]** LeoFigo74z.

## Diagrama
```
auth.users ─1──1─ perfiles [C]
auth.users ─1──1─ administradores [D]      (solo quien está aquí es admin)
perfiles   ─1──n─ entradas [C]             (medio de transporte por visita)
auth.users ─1──n─ reportes [D] ─1──n─ confirmaciones [D] ─n──1─ auth.users
reportes   ─1──n─ evidencias [C]           (foto/video en Storage)
reportes   ─n──1─ zonas_publicas [D]       (vista calculada)
perfiles   ─1──n─ suscripciones_push [C]
alertas_clima [C] · instituciones [C] · refugios [C] · parametros [D] · limites_zmg [D] · acciones_admin [D]
```
`reportes.perfil_id` y `confirmaciones.perfil_id` apuntan a `auth.users(id)` (no a `perfiles`) para
que el módulo de reportes no dependa del de registro.

## Reglas de acceso (aplican a todo el modelo)
- **RLS filtra filas; los permisos por columna ocultan columnas.** `perfil_id` nunca tiene `grant
  select` para `anon`/`authenticated`: nadie puede leer quién hizo un reporte o una confirmación.
- El front **no escribe directo** en tablas: inserta/actualiza solo por RPC (`security definer`,
  `search_path` fijo, validan todo).
- Las vistas públicas usan `security_invoker = true` (una vista normal se salta RLS).
- **Realtime por Broadcast**, no por `postgres_changes` sobre tablas: `postgres_changes` manda la fila
  completa (incluido `perfil_id`). Un trigger publica solo los campos públicos (tarea F3-T3).
- Usuarios anónimos de Supabase tienen rol `authenticated`; `anon` = sin sesión (solo lectura pública).

## Enums
| Enum | Valores | Dueño |
|---|---|---|
| `tipo_reporte` | `calle`, `casa`, `coche`, `persona_en_riesgo` | D |
| `estado_reporte` | `pendiente`, `activo`, `resuelto`, `oculto`, `en_revision` | D |
| `nivel_zona` | `bajo`, `medio`, `alto` | D |
| `tipo_caso` | `casa`, `coche`, `persona_herida`, `tercero`, `otro` (derivación; ≠ `tipo_reporte`) | C |
| `medio_transporte` | `peaton`, `bici`, `auto`, `transporte_publico` | C |
| `tipo_evidencia` | `foto`, `video` | C |

## Tablas
### parametros [D]
| clave text PK | valor numeric | descripcion | actualizado_en |
Lectura pública. Se cambian solo por migración. Se leen con `param('clave')`.
Valores iniciales (**5 y 30 salieron de clase; el resto son propuestas** a ajustar con testeo):

| Clave | Valor | Para qué |
|---|---|---|
| `umbral_activacion` | 5 | reportes cercanos que activan una alerta |
| `umbral_persona_en_riesgo` | 1 | reportes `persona_en_riesgo` que la activan (POR CONFIRMAR) |
| `radio_agrupacion_m` | 150 | radio que agrupa reportes / detecta duplicados |
| `ventana_activacion_min` | 60 | minutos para juntar el umbral; si no, `pendiente` → `resuelto` |
| `minutos_expiracion` | 30 | minutos sin "sí" para que un `activo` pase a `resuelto` |
| `votos_no_para_resolver` | 3 | votos "no" (desde el último "sí") que lo resuelven |
| `banderas_para_revision` | 3 | marcas de falso que lo mandan a `en_revision` |
| `max_reportes_por_hora` | 5 | límite por usuario |
| `tamano_celda_m` | 300 | lado de la celda de zonas de calor |
| `nivel_medio_min` | 3 | reportes activos en la celda para nivel `medio` (POR CONFIRMAR) |
| `nivel_alto_min` | 6 | reportes activos en la celda para nivel `alto` (POR CONFIRMAR) |
| `radio_cercanos_max_m` | 1000 | tope de `p_radio_m` en `reportes_cercanos` |
| `area_max_consulta_km2` | 2500 | tope del rectángulo en `reportes_activos_en_area` |
| `minutos_entre_avisos` | 30 | máx. 1 aviso por zona por usuario en este lapso (módulo C) |
| `max_intentos_push` / `minutos_reintento_push` / `minutos_bloqueo_aviso_push` / `dias_retencion_avisos_push` | 3 / 5 / 2 / 7 | cola de avisos (P-22) |
| `radio_refugios_derivacion_m` / `max_refugios_derivacion` | 20000 / 5 | límites de orientación (P-24) |

### limites_zmg [D]
| id smallint PK | nombre | area geography(MultiPolygon) | fuente | actualizado_en |
Lectura pública. Se consulta con `dentro_de_zmg(lat, lng)`. **El polígono inicial es una
aproximación rectangular PROVISIONAL** (P-13) hasta tener el oficial.

### administradores [D]
| perfil_id uuid PK → auth.users | creado_en |
Sin políticas para `anon`/`authenticated`: solo se da de alta por SQL con la llave de servicio.
`es_admin()` dice si el usuario actual está aquí.

### reportes [D]
| Columna | Tipo | Nota |
|---|---|---|
| id | uuid PK | Lo genera el cliente → reintentos no duplican |
| perfil_id | uuid → auth.users | Nunca se expone (sin grant de columna) |
| tipo | `tipo_reporte` | |
| pasan_carros | boolean | Medida simple de gravedad |
| ubicacion | geography(Point) | Obligatoria, dentro de la ZMG |
| precision_m | int ≥ 0 | Precisión del GPS (opcional) |
| estado | `estado_reporte` | Ver REGLAS_NEGOCIO §1 |
| ultima_confirmacion | timestamptz | Último "sí"; reinicia la expiración |
| activado_en | timestamptz | Cuándo pasó a `activo` |
| resuelto_en | timestamptz | Cuándo pasó a `resuelto` |
| creado_en | timestamptz | La pone el servidor |
Lectura pública solo de filas `activo` y sin `perfil_id`.

### confirmaciones [D]
| id | reporte_id | perfil_id → auth.users | sigue boolean | falso boolean | creado_en | actualizado_en |
Única por `(reporte_id, perfil_id)`. Lectura pública de `reporte_id`, `sigue`, `falso` (sin autor).

### acciones_admin [D]
| id | admin_id → auth.users | accion | objetivo_tabla | objetivo_id | motivo (obligatorio) | creado_en |
Solo los admins la leen.

### zonas_publicas (vista) [D]
Agrupa reportes `activo` en celdas de `tamano_celda_m` (metros en UTM 13N, EPSG:32613).
Columnas: `celda` text, `lat`, `lng` (centro), `total_reportes`, `total_confirmaciones`,
`nivel` (`nivel_zona`, como texto), `alguno_no_pasan_carros`, `actualizado_en`.

### perfiles [C]
| id uuid PK = auth.users.id | accesibilidad jsonb | creado_en |
Sin columna `rol` (el rol admin vive en `administradores`).
Se crea automáticamente con `auth.users`, también para sesiones anónimas. RLS permite leer
solo el propio perfil; los clientes actualizan `accesibilidad` mediante
`guardar_accesibilidad(prefs)` y no por escritura directa. En v1 `accesibilidad` solo admite
`{}` o `{ "daltonismo": boolean }`; otras preferencias requieren acuerdo con Equipo Registro.

### entradas [C]
| id | perfil_id | medio `medio_transporte` | creado_en |
Una fila por llamada a `registrar_entrada(medio)`. RLS permite leer solo entradas propias;
la escritura del cliente es exclusiva de la RPC. `perfil_id` tiene índice para lectura y cascada.

### evidencias [C]
| id | reporte_id | ruta_storage | tipo `tipo_evidencia` | creado_en |
Bucket privado `evidencias`, ruta `<reporte_uuid>/<archivo_uuid>.<extensión>`. Subida solo
por el autor del reporte pendiente/activo mediante política de Storage; no se sobrescribe.
`agregar_evidencia` comprueba autoría, objeto existente, dueño del objeto, MIME, tamaño y
límite por reporte antes de insertar. La ruta es única; repetir la RPC es idempotente.
RLS: el autor ve las evidencias de su reporte, y cualquier lector ve las de reportes activos.
La lectura del archivo usa Storage autenticado o público autorizado por RLS, nunca URL pública
del bucket. Los números provisionales están en `parametros` (P-18). El front debe quitar EXIF
antes de subir fotos; falta verificar ese flujo para publicación (P-19).
Las políticas de alta y borrado serializan por reporte para respetar el límite incluso
con peticiones simultáneas y no borrar un objeto mientras se registra como evidencia.

### suscripciones_push [C]
| id | perfil_id | endpoint | p256dh | auth | municipio text? | celda text? | creado_en | actualizado_en | ultimo_aviso_entregado_en? |
Interés por **municipio o celda**, nunca un punto (D-006: un punto suele ser la casa).
El endpoint identifica un dispositivo y sus claves permiten cifrar el mensaje; la tabla
no concede SELECT a usuarios. Solo las RPC `suscribir_push`/`baja_push` la modifican,
con límite por perfil en `parametros`. Se borra con `baja_push`, al eliminar el perfil o tras `dias_retencion_suscripcion` días sin renovación ni entrega exitosa (D-017). El último aviso se conserva en la suscripción aunque el historial se limpie a los 7 días. La Edge Function
interna usa clave secreta de servidor y VAPID para enviar; no se guardan coordenadas.

### avisos_push [C]
| id | suscripcion_id | celda | tipo | titulo | mensaje | estado | intentos | proximo_intento_en | bloqueado_hasta | token_reclamo | creado_en | enviado_en |
Cola privada y sin datos del autor ni coordenadas. Un trigger de `reportes` encola el
primer evento activo y la última resolución de cada celda, respetando el intervalo de
`parametros`. Solo `service_role` puede reclamar y cerrar envíos; el token de reclamo
impide que un trabajador atrasado cierre el trabajo de otro. Cron invoca una Edge Function
interna mediante `pg_net` y Vault, cuando Diego configure URL y clave en producción.
El reclamo descarta avisos cuya alerta, estado o interés ya no corresponde. `fallido`
incluye descartes permanentes; `enviado_en` solo se establece si hubo envío exitoso.
El historial climático se conserva hasta su fin de vigencia para mantener deduplicación.
Reintentos y retención provisionales: P-22. Sin mapa municipal verificado, los eventos
de reportes no se envían a suscripciones por municipio (P-21).

### alertas_clima [C]
| id | fuente | fuente_url | nivel `nivel_alerta_clima` | titulo | descripcion | municipio | vigente_desde | vigente_hasta | verificado_en | creado_en |
Carga manual por servicio hasta acordar fuente oficial (P-06). Sin polígonos verificados,
el ámbito explícito es un municipio. RLS y `alertas_clima_vigentes` muestran solo alertas
verificadas dentro de su intervalo. Cron encola una vez por suscripción municipal y
respeta el intervalo de avisos; ninguna alerta de prueba persiste en producción.
El significado operativo de `bajo|medio|alto` debe validarse con el equipo (P-23).

### instituciones [C]
| id | nombre | tipos_caso `tipo_caso`[] | telefono? | url? | municipio | horario? | fuente | verificado_en | creado_en |
Solo servicio carga/verifica contactos; debe haber teléfono o URL HTTPS. RLS y
`instituciones_publicas` ocultan fichas sin `verificado_en`. El catálogo arranca vacío
hasta cotejar institución, ámbito, contacto y fuente (P-05). `derivar` filtra por caso
y municipio, añade refugios verificados dentro de `radio_refugios_derivacion_m` y
devuelve pasos generales. La ubicación de la consulta no se guarda.

### refugios [C]
| id | nombre | ubicacion | direccion | municipio | capacidad | fuente | verificado_en |
Solo servicio/administración puede cargar o verificar refugios. RLS y la vista
`refugios_publicos` exponen únicamente filas con `verificado_en` no nulo y vigente.
La vista entrega `lat` y `lng` para el front. `capacidad` puede ser nula si se desconoce.
El catálogo de producción arranca vacío hasta verificar fuentes oficiales (P-07).
