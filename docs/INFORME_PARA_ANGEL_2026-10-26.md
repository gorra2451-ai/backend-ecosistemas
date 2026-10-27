# Entrega de la mitad de Leo — revisión final para Ángel

**Fecha local:** 26 de octubre de 2026.  
**Rama que contiene toda la entrega:** `codex/revision-final-local`.  
**Alcance cerrado:** las ocho tareas de implementación local asignadas a Leo.  
**Estado de publicación:** commits locales; sin push, PR ni cambios en Supabase remoto.

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

## Instrucción para la revisión de Ángel y su Claude

Leer `AGENTS.md`, este informe, `HANDOFF.md` y el diff acumulado de
`main...codex/revision-final-local`. Revisar las reglas, permisos y casos de concurrencia
por su cuenta; repetir los comandos anteriores. Para los smokes de Edge ejecutar antes
`supabase functions serve`, con VAPID de prueba en un archivo ignorado por Git.
Las pruebas HTTP de catálogos vacíos se corren antes de cargar fuentes reales.

El paquete local `backend-ecosistemas-revision.bundle` contiene la rama de entrega y
necesita el commit base de `main`; el `LEEME.txt` adjunto registra ese commit y las
instrucciones de importación. El bundle no incluye `.env` ni claves VAPID locales.
Solicitar hallazgos con archivo/línea, comandos repetidos y decisiones pendientes;
preparar la integración después de la aprobación del equipo.

## Mensaje breve para enviar

Ángel, ya quedó implementada y revisada localmente nuestra mitad del backend: las ocho
tareas que suman el 50% del reparto. En la segunda revisión corregimos casos de avisos
obsoletos, concurrencia de archivos y reportes, renovación de push y errores de red.
Pasaron 333 pruebas de base de datos y 10 de funciones, además de las pruebas locales
de API y concurrencia. Te comparto este informe y el bundle con los commits para que
tu Claude pueda revisarlos y repetir las pruebas. Falta acordar fuentes oficiales,
probar push real con el frontend y hacer la revisión/publicación autorizada; todo lo
construido sigue local. El informe detalla cada pendiente y cómo integrar la entrega.
