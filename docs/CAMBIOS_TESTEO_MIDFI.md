# Cambios por el testeo mid-fi (D-033)

> Fuente: Google Doc "Testeos Mid-fi - Plataforma ¡Aguas!" (5 equipos, 13 módulos, test cards y learning cards).
> Se aplicaron los cambios de prioridad ALTA y los MEDIA baratos. Lo que pide datos no verificados queda
> "por confirmar" (AGENTS §3.4). Verificado: 342 pruebas, build, recorrido en WebKit (iPhone) y escenarios de red
> de `docs/PRUEBAS_CAMPO.md`.

## Hallazgo central
La falta de información se lee como seguridad: 9/10 leyeron "Tu zona: sin reportes" como zona segura;
6/10 "sin alertas de clima" como calles bien; 6/10 asumieron accesible un refugio sin datos.

## Aplicado
| Módulo | Cambio | Evidencia |
|---|---|---|
| Mapa | "Sin reportes registrados en [municipio]" + "Sin reportes no significa sin riesgo" + "Reportes actualizados a las HH:MM" (sin "tiempo real") | 9/10 |
| Mapa | Botón "Mi ubicación" con diana y texto; sin permiso, explica cómo activarla | 8/10 |
| Mapa | Leyenda y filtros en dos pestañas; filtros: niveles separados de tipo/verificación, aviso "Filtros: N activos" + "Ver todos", toques ≥44 px, scroll del panel corregido; el filtro de nivel ahora sí oculta pines | 5/10 |
| Mapa | Mini leyenda fija (B/M/A con banqueta/llanta); coche ya no es verde; persona en riesgo con ícono propio igual en mapa y lista | 4/10, 2/10 |
| Mapa | Botón "En auto" visible; aviso "Alertas adaptadas para…" | 4/10 |
| Mapa | Tarjetas: "Nivel de riesgo" y "Verificación" separados; "No transitable" arriba del nivel; WhatsApp visible; pin centrado fuera de la hoja; sin GPS el punto dice "Punto de ejemplo" | 1–2/10 |
| Simulaciones | "SIMULACIÓN" en todas las tarjetas y pines punteados; barra fija "Modo práctica · Quitar"; avisos al cargar y al quitar | 4/8 |
| Buscar | Apodos locales (`lib/alias.js`: la Mine, Los Arcos, Estampida…); vacío con sugerencias; municipio como etiqueta; nombre antes que dirección; "Destino: Nombre · Municipio" | 16/20 |
| Rutas | Una sola fuente de ruta (bug "1 min · 0.2 km" vs "11 min · 8.1 km"); el nombre del destino se actualiza; "Cómo llegar" primario; ruta activa gruesa y otras punteadas; reportes por ruta; "En el camino / En el destino"; selector de medio | 9/20 |
| Reportar | Tras enviar: quién confirma, "No se avisó a ninguna institución ni viene ayuda" + 911, qué significa cada estado | 6/8 |
| Reportar | Persona en riesgo: referencia escrita obligatoria, vista previa del mensaje; sin GPS no se manda un punto falso | 6/8 |
| Reportar | Foto: sin "metadatos", aclara que placas/caras no se tapan; "¿Dónde ocurrió?"; borrador en la sesión; nivel con referencia física; etiqueta "Tuyo" | 3/8 |
| A quién acudo | 911 y "Persona herida" arriba; "Municipio que elegiste" (no "detectado"); "por confirmar" junto al botón con la misma jerarquía; mensaje copiado "Hay 1 persona herida. En total somos 2." editable | 5/8, 5/9 |
| Refugios | Lista vacía "no quiere decir que no existan"; sin conexión ≠ sin refugios; ficha guardada con antigüedad; accesibilidad en 3 estados; "No sabemos si está abierto" | 6/10, 5/10 |
| Avisos | "Esto es solo del clima" + calles con agua cerca; interruptores Activado/Desactivado, confirmación al guardar, estado "Avisos en tu celular"; silencio con hora de fin y qué cubre | 6/10, 6/7 |
| Permisos | Pantalla nueva "Privacidad y permisos" (Más); onboarding: permisos opcionales explícitos, Permitir vs Ahora no, uso de cada permiso, ID temporal explicado, resumen de privacidad a la vista | 5/10, 4/10 |

## Pendiente / por confirmar
- **Avisos de zonas con agua:** hoy al celular solo llegan alertas de clima (la suscripción es por municipio y los
  avisos de zona van a suscripciones por celda). `solo_cambios` se guarda pero el servidor no lo usa → P-38.
- **Datos que no existen:** 071 de CFE (P-34), Protección Civil, teléfonos de instituciones; de refugios: abierto,
  accesibilidad y teléfono → P-39.
- No hecho: "¿cuándo lo viste?" (requiere esquema), cruces/paradas en el buscador, tema "Usar el del sistema",
  editar la foto dentro de la app, filtros por tipo calle/casa/coche.
- Falta prueba en teléfono real de: scroll del panel, mini leyenda sobre la hoja, instrucciones de permisos por SO.
