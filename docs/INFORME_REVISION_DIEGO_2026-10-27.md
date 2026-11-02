# Revisión de la mitad de Leo para Diego — 27/10/2026

**Rama local:** `feat/c-mitad-leo`, tip `5d6ee80` al redactar.
**Publicación:** sin push de esta rama, sin PR propio y sin cambios en Supabase remoto.
**Trabajo:** ocho tareas de Leo (50% del reparto) más las correcciones solicitadas por Diego.
**Identidad:** Diego es la persona a quien Leo llamó Ángel en la entrega anterior.

## Correcciones verificadas

| Hallazgo de Diego | Corrección en una sola migración nueva |
|---|---|
| Cinco `crear_reporte` activan un grupo, pero no sale `zona_activada` | Trigger por statement con tablas de transición; reconstruye los activos antes/después por celda y toma el lock existente antes de contar. Una activación produce una entrega. |
| `zona_resuelta` se perdía durante los 30 minutos de silencio | El límite aplica solo a nuevas activaciones; el fin de zona se encola de inmediato. También cubre `oculto` y `en_revision`. |
| `suscribir_push` aceptaba proveedores que `enviar-push` rechaza | La RPC solo permite FCM, Mozilla, Apple y subdominios WNS; rechaza falsos sufijos y puertos alternos con `proveedor_push_no_permitido`. |
| `registrar_entrada` no tenía límite de frecuencia | Bloqueo por perfil y parámetro `max_entradas_por_hora=20` provisional. El exceso devuelve `limite_entradas`. Diego debe confirmar el valor en P-25. |

Se agregaron pruebas antes del arreglo: fallaron cinco de seis casos de avisos/proveedor y dos de cinco de entradas; tras la migración pasaron. Se ampliaron las pruebas de host válido y falsificado. Las migraciones anteriores no se editaron.

## Validación local

- `supabase db reset` desde cero: correcto con 19 migraciones de esta rama.
- `supabase test db`: **349/349 pgTAP en 17 archivos**.
- `bash scripts/probar-db.sh`: las 17 suites pasan.
- `./scripts/probar-edge.ps1`: **10/10**; fetch simulado, sin envío externo.
- `node scripts/smoke-concurrencia.mjs`: dos resoluciones generan un aviso; cuatro subidas respetan máximo tres evidencias.
- `bash scripts/diagnostico.sh`: 55 pruebas del arnés, cero fallas y cero problemas.
- Integración **temporal y solo local** de las ramas de los PR #10/#11 con esta entrega: `supabase db reset` correcto y **358/358 pgTAP en 18 archivos**. Esta prueba no reemplaza el merge posterior desde `main`.

## Documentación y decisiones

`docs/API.md` describe los errores nuevos y que el fin de zona no queda sujeto al silencio de 30 minutos. `docs/ARQUITECTURA.md` registra el costo O(N) de `celda_mapa`, Broadcast falsificable que solo provoca recargas, MIME declarado por el cliente, objetos de reportes expirados sin limpieza automática y ubicación aproximada en suscripciones por celda.

- **P-25:** confirmar o ajustar 20 entradas por perfil en una hora; el valor está en `parametros`, no en código.
- **P-26:** decidir si se acepta guardar una celda aproximada de ~300 m vinculada al perfil y su retención.
- **P-16:** no habilitar Auth anónima en la nube hasta acordar captcha y límites contra abuso.
- Para uso real siguen pendientes datos oficiales P-05/P-07, fuente de clima P-06/P-23, EXIF P-19, prueba real Web Push/VAPID P-20, polígonos P-21 y parámetros P-22/P-24.

## Integración y publicación

Leo revisó y aprobó los PR #10 y #11; ambos seguían abiertos al redactar. **Diego debe fusionarlos primero.** Después sincronizar `main`, hacer `git merge --no-ff main` en `feat/c-mitad-leo`, conservar la bitácora de ambos y repetir reset, suites SQL, Edge, smoke y diagnóstico. La autorización de Diego para subir esta rama y abrir un PR fue comunicada para el final de ese proceso. Diego revisa y fusiona nuestro PR. La aplicación de migraciones remotas, secretos y despliegue son pasos posteriores a cargo de Diego.

El trabajo se hizo en `C:\Users\leo74\Downloads\backend-ecosistemas-trabajo`, fuera de OneDrive.