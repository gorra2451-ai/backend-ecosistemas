# DECISIONES
> Una decisión por bloque. No se editan: si cambia algo, se agrega otra que la reemplaza.
> Estado: Propuesta · Aprobada · Reemplazada por D-XXX

## D-001 · Supabase como backend completo
**Estado:** Propuesta · 2026-10-20
**Decisión:** Postgres + Auth + Realtime + Storage + Edge Functions de Supabase.
**Por qué:** el grupo ya lo usó en la app de la encuesta; plan gratuito; cualquier front
(web hoy, app después) lo consume igual con `supabase-js`.
**Costo:** el plan gratuito pausa proyectos sin actividad (verificar límite vigente al crear).

## D-002 · Backend separado del front
**Estado:** Propuesta · 2026-10-20
**Decisión:** este repo no tiene front. Los equipos consumen el contrato de `docs/API.md`.
**Por qué:** hay 5 equipos de front trabajando en paralelo y la decisión web/app sigue abierta.

## D-003 · Registro anónimo
**Estado:** Aprobada en clase · 2026-10-20
**Decisión:** inicio de sesión anónimo de Supabase. Sin correo ni teléfono.
**Por qué:** quien va manejando no llena formularios; solo necesitamos contar usuarios y evitar spam.

## D-004 · Parámetros de negocio en tabla
**Estado:** Propuesta · 2026-10-20
**Decisión:** umbral de activación, minutos de expiración y radios viven en la tabla `parametros`.
**Por qué:** los valores (5 reportes, 30 min) siguen por confirmar y se ajustarán con testeo.

## D-005 · Ubicación con PostGIS
**Estado:** Propuesta · 2026-10-20
**Decisión:** columnas `geography(Point)` y consultas por distancia con PostGIS.
**Por qué:** "reportes a menos de X metros" y zonas de calor son el centro del producto.

## D-006 · Sin rastreo de usuarios
**Estado:** Propuesta · 2026-10-20
**Decisión:** el servidor no guarda la ubicación del usuario. El aviso "¿sigue inundado?"
se calcula en el teléfono comparando su ubicación con los reportes activos.
**Por qué:** privacidad y menos datos sensibles que proteger.

## D-007 · Sin texto libre en el reporte (por ahora)
**Estado:** Propuesta · 2026-10-20
**Decisión:** el reporte usa opciones cerradas + foto/video opcional. Sin comentarios escritos.
**Por qué:** evita moderar groserías y desinformación; reportar en 3 taps.

## D-008 · Arnés agnóstico de IA
**Estado:** Aprobada · 2026-10-20
**Decisión:** `AGENTS.md` es la fuente única de reglas; `CLAUDE.md` solo la importa.
**Por qué:** Diego usa Claude y la Persona B usa ChatGPT; ambos deben seguir las mismas reglas.

## D-009 · Stack 100% gratuito
**Estado:** Aprobada (Diego) · 2026-10-22 · COMPANERO la revisa al entrar
**Decisión:** Supabase Free (sin tarjeta), GitHub Free y GitHub Actions. Ningún servicio de pago.
**Límites del plan Free de Supabase** (verificar vigentes al crear el proyecto):
- 2 proyectos activos por organización.
- 500 MB de base de datos.
- 1 GB de archivos en Storage (fotos/videos de evidencias).
- El proyecto se pausa tras 7 días sin uso.
**Por qué:** materia escolar, sin presupuesto; el esquema en SQL puro permite migrar a otro Postgres.
**Consecuencias:** limitar tamaño y duración de videos en `parametros`; crear el proyecto remoto
cuando haya migraciones que subir, para que no se pause sin uso; la organización de Diego ya tiene
1 proyecto activo, así que este ocupa el segundo cupo.

## D-010 · Construir completo ahora; cambios por parámetros o migraciones nuevas
**Estado:** Aprobada (Diego) · 2026-10-22 · COMPANERO la revisa al entrar
**Decisión:** se construye el núcleo completo según `docs/PLAN.md` sin esperar a que se confirme
cada dato. Lo que siga abierto entra como valor en `parametros` o como `POR CONFIRMAR`; cuando
se confirme, se ajusta el parámetro o se agrega una migración nueva (nunca se edita una aplicada).
**Por qué:** las preguntas abiertas (P-01 a P-11) no deben frenar la construcción, y así un cambio
acordado en clase no obliga a rehacer código. Flujo en `docs/CAMBIOS_DE_CLASE.md`.
