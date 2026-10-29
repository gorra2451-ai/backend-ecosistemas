# REGLAS DE NEGOCIO
> Todos los números salen de la tabla `parametros`. Aquí se escriben con su nombre.

## 1. Ciclo de vida de un reporte
```
           crear_reporte
                │
                ▼
          ┌──pendiente──┐  se juntan ≥ umbral_activacion reportes
          │             │  a ≤ radio_agrupacion_m en ventana_activacion_min
          │             ▼
          │          activo ◄──── confirmación "sí" (reinicia el reloj)
          │             │
          │             ├── votos_no_para_resolver "no" ──► resuelto
          │             ├── minutos_expiracion sin "sí" ──► resuelto
          │             ├── banderas_para_revision falsos ► en_revision ──admin──► activo | oculto
          │             └── admin lo oculta ─────────────► oculto
          └── ventana_activacion_min sin juntar umbral ──► resuelto
```
- Solo los reportes `activo` se ven en el mapa y cuentan para zonas.
- `persona_en_riesgo` se activa con `umbral_persona_en_riesgo` (1) reportes y aparece primero. **Propuesta, POR CONFIRMAR con el grupo.**
- Activación: al crear un reporte se cuentan los reportes `pendiente`/`activo` a ≤ `radio_agrupacion_m`
  creados en los últimos `ventana_activacion_min`. Si llegan a `umbral_activacion`, todos los
  `pendiente` de ese grupo pasan a `activo`. Un reporte nuevo junto a uno ya `activo` nace `activo`.

## 2. Crear reporte (`crear_reporte`)
- Requiere sesión (anónima vale).
- Ubicación dentro de la ZMG (tabla `limites_zmg`, función `dentro_de_zmg`). Fuera → `fuera_de_zmg`.
- Fecha y hora las pone el servidor, nunca el cliente.
- Límite: `max_reportes_por_hora` por usuario.
- Si el `id` ya existe del mismo usuario → devuelve el existente (idempotente). De otro usuario → `id_en_uso`.
- Un usuario no puede reportar dos veces el mismo punto (≤ radio) mientras su reporte siga vivo.

## 3. Confirmar (`confirmar_reporte`)
- Una confirmación por usuario por reporte; se puede cambiar de "sí" a "no".
- No puedes confirmar tu propio reporte.
- Solo se confirman reportes `activo`.
- "sí" actualiza `ultima_confirmacion`. "no" suma hacia `votos_no_para_resolver`; cuentan los "no"
  registrados después del último "sí".
- El aviso "¿sigue inundado?" lo dispara el front al estar cerca (D-006).

## 4. Expiración
- Tarea `pg_cron` cada 5 min: pasa a `resuelto` lo que cumpla las reglas de §1.
- Cada cambio de estado se publica por Realtime y puede disparar notificación.

## 5. Zonas de calor
- Celdas de `tamano_celda_m`. Nivel por reportes activos en la celda:
  `bajo` < `nivel_medio_min` (3) · `medio` < `nivel_alto_min` (6) · `alto` el resto **(propuesta, POR CONFIRMAR)**.
- Si algún reporte dice `pasan_carros=false`, la zona sube a `alto`.
- El front no debe depender solo del color: la API entrega también `nivel` como texto.

## 6. Notificaciones
- Se notifica por **cambio de estado** (zona nueva activa, zona resuelta) y por alerta de clima.
- Nunca más de 1 aviso por zona cada `minutos_entre_avisos` (30) por usuario **(propuesta)**.
- Solo a quien se suscribió y aceptó permisos.
- Los avisos por reporte se agrupan por celda; sin polígonos oficiales no se asigna un
  municipio al reporte (P-21). Las alertas climáticas manuales sí declaran municipio,
  requieren fuente HTTPS, verificación y vigencia antes de aparecer o encolarse (P-06/P-23).

## 7. Derivación
- Entrada: tipo de caso (`casa`,`coche`,`persona_herida`,`tercero`,`otro`) + municipio.
- Salida: instituciones verificadas para ese caso, refugios más cercanos y pasos a seguir.
- La plataforma no da seguimiento al folio: solo orienta a dónde acudir.
- Sin fuentes verificadas, las listas de instituciones y refugios quedan vacías. Los
  pasos generales no sustituyen indicaciones oficiales (P-05/P-07/P-24).

## 8. Moderación
- El admin puede ocultar reportes; cada acción queda en `acciones_admin` con motivo.
- Marcar como falso = confirmación "no" + `falso = true`; `banderas_para_revision` (3) lo mandan a
  `en_revision` (sale del mapa) **(propuesta)**. El admin lo regresa a `activo` u `oculto`.
- Los admins están en la tabla `administradores` (alta solo por SQL con llave de servicio).
