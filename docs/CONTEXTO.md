# CONTEXTO DEL PRODUCTO
> Qué construimos y por qué. Fuente: clase del 20-oct-2026 y encuestas de los 6 equipos.

## Problema
En la ZMG las inundaciones se normalizan, pero sí cuestan vidas. Quien reporta no sabe a quién
acudir (casi todos llaman al 911) y **más del 50% nunca recibió seguimiento** de su folio.

## Qué hace la plataforma
1. **Registro** anónimo + medio de transporte de hoy.
2. **Reporte** de inundación en pocos taps.
3. **Confirmación** tipo Waze: "¿sigue inundado?" al pasar por la zona.
4. **Mapa** con zonas de calor, tráfico, riesgos y refugios.
5. **Notificaciones** de clima y de cambios de estatus.
6. **Derivación:** a qué institución acudir según lo que pasó.

## Usuarios
| Perfil | Qué hace |
|---|---|
| Reporta | Sube y confirma reportes |
| Consulta | Ve el mapa y recibe alertas |
| Administrador | Interviene solo en casos puntuales (moderación) |

Cada entrada pide el medio de transporte: peatón, bici, auto, transporte público.
Reacción esperada: auto sigue o cambia de ruta; a pie cancela o pospone; transporte público espera información.

## Datos de las encuestas que guían el backend
| Dato | Implicación |
|---|---|
| 60.7% pide ubicación exacta, fecha y hora | Ubicación y hora automáticas y obligatorias |
| 60% fotos, 55% videos | Evidencia opcional (Storage) |
| 49.3% quiere avisos solo si cambia la situación | Notificar por cambio de estado, no por tiempo |
| 55% no le importa la fuente | La confianza viene de confirmaciones, no de quién publica |
| ~30% quiere saber de refugios | Tabla de refugios con ubicación |
| La información llega por la familia | Enlace compartible por reporte/zona |
| Necesidades por discapacidad (Equipo 6) | Textos cortos, opciones cerradas; el front resuelve voz/vibración |

## Alcance
- Solo ZMG. Web primero; app se decide con testeo.
- Fuera de alcance por ahora: tour guiado, negocios como refugio, aseguradoras, CarPlay,
  campañas de apoyo, modo sin señal.

## Equipos de front (consumen este backend)
1. Registro · 2. Mapa · 3. Reporte de inundaciones · 4. Confirmación · 5. Notificaciones + derivación
