# Entrega de la mitad de Leo — revisión para Diego

> Fotografía histórica del paquete v2 del 26/10. La revisión posterior y sus pruebas se registran en `PROGRESO.md`.

**Fecha local:** 26 de octubre de 2026.  
**Rama que contiene toda la entrega:** `codex/revision-final-local`.  
**Alcance cerrado:** las ocho tareas de implementación local asignadas a Leo.  
**Estado de publicación:** commits locales; sin push, PR ni cambios en Supabase remoto.

## Visibilidad en GitHub y autorizaciones

La rama de Leo **todavía no se puede ver en GitHub**. En GitHub está la base
`main` de Diego; los once commits de esta entrega y este informe actualizado
están en la computadora de Leo. Para que Diego y su Claude vean el código ahora,
hay que compartirles el archivo `backend-ecosistemas-entrega-angel-v2.bundle`
junto con este informe y el `LEEME.txt` del paquete. El bundle transporta los
commits versionados, sin archivos locales ignorados ni secretos.

El orden de aprobación acordado en `AGENTS.md` es:

1. Diego y su Claude revisan **localmente** el bundle, el diff, los permisos y
   las pruebas. Pueden devolver hallazgos; esa revisión no publica nada.
2. **Diego autoriza expresamente el push de la rama** de Leo a GitHub. El repo
   establece esta autorización en su regla 3.13. Diego confirmó que es la persona a quien Leo llamó Ángel. Una vez autorizado, se
   podrá subir la rama y abrir un PR para que el equipo vea el diff en GitHub.
3. El PR se revisa por la otra persona y el merge a `main` se hace con `--no-ff`
   según la regla 3.12. La aplicación de migraciones al Supabase remoto, la
   configuración de credenciales y el despliegue son pasos posteriores que
   requieren su propia decisión operativa. No se han hecho aquí.

**La revisión del código y el permiso para subir una rama no equivalen a
aprobar su puesta en producción.** Las fuentes oficiales, las decisiones
provisionales y la integración del frontend se detallan más abajo.

## Resultado de la revisión

La revisión encontró defectos que las pruebas anteriores no cubrían. Se corrigieron
con dos migraciones nuevas, ajustes en las funciones Edge y pruebas de regresión.
Las migraciones de la entrega anterior se conservaron. El contrato público de los
equipos sigue siendo el de `docs/API.md`, con aclaraciones de operación local.

| Hallazgo | Corrección y comprobación |
|---|---|
| Avisos en cola podían salir después de vencer o retirarse una alerta, resolverse la zona o cambiar el interés del dispositivo | Se valida la vigencia y el ámbito antes de reclamar; lo obsoleto se cierra sin enviar. Regresión SQL |
| Dos reportes podían resolverse al mismo tiempo sin producir el aviso final | Bloqueo por celda antes de contar. Dos transacciones reales producen una entrega |
| Cuatro subidas simultáneas podían superar el máximo de tres archivos | Serialización por reporte en la autorización de Storage. Prueba concurrente permite tres y rechaza la cuarta |
| Borrado de un objeto podía competir con su registro como evidencia | Autorización de borrado y registro comparten bloqueo por reporte; objetos registrados no se borran por el cliente |
| La limpieza de historial permitía repetir una alerta climática de larga duración | Se conserva la clave de deduplicación mientras la alerta no haya terminado |
| JSON `null` y algunas caídas de red producían errores sin controlar | Validación de cuerpo y UUID; errores 400/502 controlados y tiempos de espera acotados. Tests de manejadores |
| Un dispositivo caducado podía causar un falso fallo del trabajador al desaparecer la entrega por cascada | El trabajador distingue descarte de envío y tolera la cascada; no registra una entrega inexistente como enviada |
| Una respuesta tardía del proveedor podía borrar una suscripción recién renovada | Baja atómica solo si endpoint y claves todavía coinciden; parámetros van en el cuerpo de una RPC interna |
| Compatibilidad de credenciales legacy incompleta | Cabeceras de servicio compartidas para clave secreta actual y JWT legacy. Test de ambos modos |

La carga Web Push lleva un `tag` estable por entrega para que el Service Worker del
frontend pueda reemplazar duplicados al mostrarla. La entrega sigue siendo susceptible
de reintento si el proceso se interrumpe tras enviar y antes de confirmar; no se promete
entrega exactamente una vez. La comprobación de vigencia corresponde al momento de reclamo.

## Cobertura de nuestra mitad

| Tarea | Resultado local | Peso del reparto |
|---|---|---:|
| F1-T2 | Sesiones anónimas, perfil propio, entradas y accesibilidad | 10% |
| F2-T4 | Evidencias privadas, autoría, MIME/tamaño, límites y registro por RPC | 8% |
| F3-T3 | Broadcast público de invalidaciones de reportes y zonas sin datos privados | 4% |
| F3-T4 | Catálogo y vista de refugios verificados | 6% |
| F4-T1 | Alta/baja de dispositivos y envío interno Web Push con VAPID | 5% |
| F4-T2 | Avisos por cambios de zona, cola, límite y reintentos | 4% |
| F4-T3 | Carga manual de clima con fuente, verificación, vigencia y aviso municipal | 3% |
| F4-T4 | Instituciones verificadas y RPC `derivar` con refugios cercanos y orientación | 10% |
| **Total implementado localmente** | **Ocho tareas** | **50% del backend** |

## Validación reproducible

- `supabase db reset`: reconstrucción limpia de las **18 migraciones** y seed local.
- `supabase test db`: **333 pruebas SQL en 15 suites**, todas aprobadas.
- `bash scripts/probar-db.sh`: las mismas 15 suites con reconstrucción transaccional.
- `./scripts/probar-edge.ps1`: **10 pruebas** de cifrado, autorización, validación,
  errores de red, caducidad y renovación; fetch simulado, sin enviar push externo.
- `deno check` para los dos puntos de entrada Edge: aprobado. Dependencias de las
  pruebas fijadas en `supabase/functions/deno.lock`.
- `node scripts/smoke-concurrencia.mjs`: aviso único con dos resoluciones simultáneas
  y máximo tres objetos ante cuatro inserciones concurrentes; limpia sus datos sintéticos.
- Pruebas HTTP locales de Storage con dos usuarios, suscripciones, funciones Edge,
  cola y derivación; WebSocket local para Broadcast.
- Asesores locales de seguridad y rendimiento: sin avisos de nivel `warn` o `error`.
- Lint ejecutado por esquema: sin avisos en nuestras funciones. Hay **cinco advertencias
  previas de conversión texto/enum** en `evaluar_activacion` y `aplicar_votos_no`, del
  módulo base. Sus pruebas pasan; se dejan visibles para que el responsable las revise.

## Lo que falta para usarlo con usuarios reales

El código local de las ocho tareas está entregado. Estos puntos siguen abiertos y
deben resolverse en la revisión e integración; no se presentan como ya terminados:

| Dependencia | Estado / responsable de acordarla |
|---|---|
| Instituciones, teléfonos y refugios oficiales | Catálogos vacíos, sin datos inventados. P-05/P-07 |
| Fuente climática y autoridad que verifica | Carga manual preparada; sin alertas reales. P-06/P-23 |
| Push real a navegador | Pendientes VAPID de producción, Service Worker del frontend y prueba de entrega real. P-08/P-20 |
| Reportes → municipio | Avisos de reportes por celda; municipio necesita polígonos oficiales. P-21 |
| Privacidad de fotos | El backend no elimina EXIF ni comprueba el contenido binario; debe verificarse la preparación de archivos en el frontend. P-19 |
| Reglas provisionales | Tamaños, reintentos, retención, radio y orientación requieren aprobación del equipo. P-18/P-22/P-24 |
| Abuso de sesiones anónimas | Acordar captcha y límites antes de exposición pública. P-16 |
| Integración y publicación | Revisión por la otra persona, PR, Auth anónima remota, VAPID, Vault/cron y pruebas del frontend. Requiere autorización |

Google Maps sigue siendo una decisión del frontend (P-04). Este backend entrega puntos,
zonas, eventos y refugios; no incluye el componente visual ni una cuenta/API de Google Maps.

## Instrucción para la revisión de Diego y su Claude

Usar el `LEEME.txt` adjunto para importar el bundle en un clon de este repo cuya
`main` contenga el commit base `e6dc5c8beef6769f8f47d9612e7faa6d1ee254e2`.
Después comparar `main...codex/revision-leo`. El bundle actualizado contiene
los once commits de implementación y este informe. No hace falta acceso a la
computadora de Leo para revisar ese paquete.

Leer `AGENTS.md`, `HANDOFF.md`, `docs/PLAN.md`, `docs/API.md`, `PREGUNTAS.md`
y este informe. Para Claude, la revisión solicitada es:

1. Examinar las once migraciones nuevas, RLS, políticas de Storage y RPC, y
   compatibilidad del contrato con el frontend y con la base de Diego.
2. Revisar autenticación y autorización de las funciones Edge, uso de secretos,
   privacidad del payload Realtime, idempotencia de la cola, vigencia de avisos,
   límites de evidencias y carreras de renovación/borrado de suscripciones.
3. Repetir `supabase db reset`, `supabase test db`, `bash scripts/probar-db.sh`,
   `./scripts/probar-edge.ps1` y `node scripts/smoke-concurrencia.mjs` en local.
   Se necesitan Docker y Supabase CLI. Para los smokes HTTP de Edge, iniciar
   `supabase functions serve` y usar VAPID de prueba en un archivo ignorado.
4. Informar hallazgos por gravedad, con archivo/línea, prueba que los demuestra
   y propuesta de corrección. Confirmar si la rama es apta para subir a GitHub
   y abrir PR, y separar esa decisión de las condiciones para uso público.

No aplicar migraciones al Supabase remoto durante esta revisión. Los catálogos
de refugios e instituciones siguen vacíos hasta contar con fuentes verificadas;
las pruebas HTTP de catálogos vacíos se ejecutaron en ese estado. Los resultados
de pruebas citados son locales y deben ser reproducidos por el revisor.

### Decisiones concretas a devolver al equipo

- **Para ver el trabajo en GitHub:** autorización expresa de Diego para hacer
  push de `codex/revision-final-local` y abrir PR. La revisión del PR precede
  cualquier merge; no autorizar `supabase db push` por implicación.
- **Para integrar el frontend:** decidir mapa (P-04), formato web/app (P-08),
  eliminación de EXIF (P-19), Service Worker y prueba de Web Push real (P-20).
- **Para activar servicios reales:** obtener instituciones, teléfonos y refugios
  oficiales (P-05/P-07); fuente y validación de alertas climáticas (P-06/P-23);
  polígonos municipales (P-21); límites contra abuso y parámetros provisionales
  (P-16/P-18/P-22/P-24). Configurar Auth anónima, VAPID, Vault/cron y comprobar
  el flujo completo en el entorno remoto autorizado.
