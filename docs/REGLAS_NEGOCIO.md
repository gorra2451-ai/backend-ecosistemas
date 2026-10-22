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
          │             └── admin lo oculta ─────────────► oculto
          └── ventana_activacion_min sin juntar umbral ──► resuelto
```
- Solo los reportes `activo` se ven en el mapa y cuentan para zonas.
- `persona_en_riesgo` se activa con 1 reporte (no espera umbral) y aparece primero. **Propuesta, POR CONFIRMAR con el grupo.**

## 2. Crear reporte (`crear_reporte`)
- Requiere sesión (anónima vale).
- Ubicación dentro de la ZMG (polígono en `parametros`/tabla aparte). Fuera → error claro.
- Fecha y hora las pone el servidor, nunca el cliente.
- Límite: `max_reportes_por_hora` por usuario.
- Si el `id` ya existe del mismo usuario → devuelve el existente (idempotente).
- Un usuario no puede reportar dos veces el mismo punto (≤ radio) mientras su reporte siga vivo.

## 3. Confirmar (`confirmar_reporte`)
- Una confirmación por usuario por reporte; se puede cambiar de "sí" a "no".
- No puedes confirmar tu propio reporte.
- "sí" actualiza `ultima_confirmacion`. "no" suma hacia `votos_no_para_resolver`.
- El aviso "¿sigue inundado?" lo dispara el front al estar cerca (D-006).

## 4. Expiración
- Tarea `pg_cron` cada 5 min: pasa a `resuelto` lo que cumpla las reglas de §1.
- Cada cambio de estado se publica por Realtime y puede disparar notificación.

## 5. Zonas de calor
- Celdas de `tamano_celda_m`. Nivel por reportes activos en la celda:
  `bajo` 1–2 · `medio` 3–5 · `alto` 6+ **(propuesta, POR CONFIRMAR)**.
- Si algún reporte dice `pasan_carros=false`, la zona sube a `alto`.
- El front no debe depender solo del color: la API entrega también `nivel` como texto.

## 6. Notificaciones
- Se notifica por **cambio de estado** (zona nueva activa, zona resuelta) y por alerta de clima.
- Nunca más de 1 aviso por zona cada 30 min por usuario **(propuesta)**.
- Solo a quien se suscribió y aceptó permisos.

## 7. Derivación
- Entrada: tipo de caso (`casa`,`coche`,`persona_herida`,`tercero`,`otro`) + municipio.
- Salida: instituciones verificadas para ese caso, refugios más cercanos y pasos a seguir.
- La plataforma no da seguimiento al folio: solo orienta a dónde acudir.

## 8. Moderación
- El admin puede ocultar reportes; cada acción queda en `acciones_admin` con motivo.
- Marcar como falso = confirmación "no" + bandera; 3 banderas lo mandan a revisión **(propuesta)**.
