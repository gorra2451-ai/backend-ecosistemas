# Entrega local de Leo: revisión independiente para Diego y Claude

> Histórico: la revisión posterior y la rama final están en
> `docs/INFORME_REVISION_DIEGO_2026-10-27.md`; usar ese informe para la entrega actual.

**Fecha:** 2026-10-26  
**Repo:** `gorra2451-ai/backend-ecosistemas`  
**Rama local final:** `feat/f4-t4-derivacion`  
**Publicación:** ninguna. `arnes.soloLocal=true`; no hubo push, PR ni migración remota.

## Mensaje para Diego y Claude

Diego, Leo completó **localmente** las ocho tareas asignadas a su mitad del backend.
Por favor, pídele a Claude una revisión independiente del diff acumulado entre `main`
y `feat/f4-t4-derivacion` en la computadora de Leo. Las ramas están **apiladas** en el
orden de la tabla, así que la rama final contiene todo el trabajo anterior. Revisen
seguridad, reglas de negocio, contrato con frontend, migraciones desde cero y los
pendientes de producto antes de acordar PR e integración. Leo conserva el control de
la publicación; este informe no autoriza subir cambios ni tocar Supabase remoto.

| Tarea | Implementación local | Evidencia principal |
|---|---|---|
| F1-T2 | Auth anónima, perfiles, entradas y accesibilidad | 30 pgTAP; sesión HTTP local |
| F2-T4 | Evidencias privadas en Storage con registro por autor | 28 pgTAP; prueba HTTP con dos usuarios |
| F3-T3 | Broadcast de invalidaciones de reportes/zonas | 14 pgTAP; WebSocket local |
| F3-T4 | Refugios solo verificados | 15 pgTAP; catálogo vacío |
| F4-T1 | Suscripciones Web Push y envío interno VAPID | 20 pgTAP; Edge Runtime y cifrado local |
| F4-T2 | Avisos por celda, cola, límite y reintentos | 20 pgTAP; HTTP reporte → cola → trabajador |
| F4-T3 | Alertas climáticas manuales verificadas y aviso municipal | 16 pgTAP; catálogo vacío |
| F4-T4 | Instituciones verificadas y `derivar` | 19 pgTAP; HTTP con catálogos vacíos |

**Resultado conjunto:** `supabase db reset` limpio; `supabase test db` pasó **314 pruebas
en 14 archivos**; `scripts/probar-db.sh` pasó las 14 suites; `supabase db lint
--local --schema public,private --level warning` sin errores. También pasaron los
smokes HTTP locales de avisos y derivación. El backend base de Diego aporta las otras
152 pruebas, según `HANDOFF.md`. El cambio de F4-T3 a `create or replace function`
se hizo porque el arnés transaccional reconstruye migraciones sobre funciones privadas
ya presentes; repetir el arnés confirmó el arreglo.

## Qué revisar con especial cuidado

1. **Auth y exposición:** RLS de perfiles, Storage, suscripciones, cola, alertas e
   instituciones; las funciones internas aceptan solo la clave de servidor. Confirmar
   que ningún secreto ni endpoint de usuario sale por vistas/Broadcast.
2. **Reportes y push:** validar que el primer reporte activo y la última resolución de
   una celda son las transiciones correctas; revisar anti-spam, concurrencia, tokens de
   reclamo, reintentos y baja de suscripciones caducadas. Probar entrega real a un
   navegador con VAPID de producción antes de habilitar cron remoto.
3. **Clima:** la carga es manual porque la fuente oficial sigue sin definirse. Validar
   fuente HTTPS, municipio, niveles, persona que verifica y vigencia. No publicar filas
   de prueba ni activar una ingesta automática sin fuente aprobada.
4. **Derivación:** verificar institución/tipo/municipio/contacto contra fuentes oficiales;
   revisar radio y número de refugios y texto de orientación con el equipo. Confirmar que
   la posición consultada no se persiste.
5. **Contrato:** revisar `docs/API.md`, `docs/MODELO_DATOS.md` y avisar a los equipos de
   frontend de cualquier ajuste acordado. Las secciones nuevas solo existen localmente.

## Decisiones pendientes antes de uso público

- **P-05/P-07:** instituciones, teléfonos y refugios oficiales verificados. Los catálogos
  quedan vacíos hasta contar con ellos.
- **P-06/P-23:** fuente climática oficial, niveles y quién verifica. No hay alertas reales.
- **P-16:** abuso de sesiones anónimas y activación de riesgo con un solo reporte.
- **P-18/P-19:** límites de evidencia y eliminación comprobable de EXIF en el frontend.
- **P-20:** proveedores Push, número de dispositivos, VAPID de producción y prueba real.
- **P-21:** polígonos municipales oficiales; los reportes solo notifican por celda.
- **P-22/P-24:** parámetros de reintento/retención, radio y cantidad de refugios,
  y pasos de orientación.

## Integración propuesta, sujeta a revisión de Diego

1. En el checkout local de Leo, inspeccionar `git log --oneline main..feat/f4-t4-derivacion`
   y `git diff main...feat/f4-t4-derivacion`; revisar las migraciones y sus pruebas en orden.
2. Repetir `supabase db reset`, `supabase test db`, `bash scripts/probar-db.sh`,
   `./scripts/smoke-avisos.ps1` y `./scripts/smoke-derivacion.ps1` con Docker local.
   Para el smoke Edge debe estar corriendo `supabase functions serve`.
3. Anotar hallazgos concretos y resolverlos localmente; después acordar con Leo cómo
   presentar los commits/PR. Las ramas apiladas requieren integrar en orden o preparar
   una rama consolidada revisable.
4. **Solo después de autorización explícita de Diego y Leo:** publicar por PR, aplicar
   migraciones desde `main`, habilitar Auth anónima remoto, configurar secretos VAPID y
   Vault para cron (`ecosistemas_project_url`, `ecosistemas_secret_key`), probar
   permisos y entrega real. No colocar claves en archivos versionados ni en el frontend.

**Respuesta solicitada de Claude:** hallazgos priorizados con archivo/línea, resultado
de comandos repetidos, decisiones P-05 a P-24 que necesitan respuesta y una propuesta
de integración. Si no puede reproducir algo, indicar el bloqueo exacto y la evidencia.
