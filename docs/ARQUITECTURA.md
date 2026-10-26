# ARQUITECTURA

## Vista general
```
[Front web / app de cada equipo]
        │  supabase-js (llave anon + sesión anónima)
        ▼
┌──────────────── Supabase ────────────────┐
│ Auth anónima      → identifica al usuario │
│ Postgres+PostGIS  → tablas, vistas, RLS   │
│ Funciones RPC     → reglas de negocio     │
│ Realtime          → mapa en vivo          │
│ Storage           → fotos y videos        │
│ pg_cron           → expirar reportes      │
│ Edge Functions    → push y clima          │
└──────────────────────────────────────────┘
        │
        ▼
[Fuente de clima POR CONFIRMAR] · [Servicio Web Push del navegador]
```

## Principios
1. **La lógica vive en la base.** Crear reporte, confirmar y calcular zonas son funciones SQL
   (RPC). El front no decide reglas; solo llama funciones. Así web y app se comportan igual.
2. **El front nunca escribe directo en tablas sensibles.** Inserta por RPC con validación.
3. **RLS en todo.** Lectura pública solo de lo agregado (zonas, reportes activos sin autor).
4. **Parámetros configurables** en la tabla `parametros` (D-004).
5. **Realtime solo para lo que cambia en pantalla:** zonas y estado de reportes.

### Broadcast del mapa (F3-T3)
- La publicación `supabase_realtime` incluye `realtime.messages`, no `reportes` ni
  `confirmaciones`; los triggers envían invalidaciones al cambiar reportes activos o
  confirmaciones que afectan una zona.
- Canales públicos `reportes` y `zonas`, evento `cambio`. El primero lleva `id` y `estado`;
  el segundo solo `celda` (Realtime agrega un identificador del mensaje). Nunca se manda
  `perfil_id`, una fila completa ni la ubicación exacta de un usuario.
- El front vuelve a consultar las RPC/vistas autorizadas tras recibir el evento. Un cliente
  podría enviar un Broadcast falso; la fuente de verdad siempre es la consulta a Postgres.

## Privacidad
- Sin correo, teléfono, nombre ni edad.
- El servidor no guarda dónde está el usuario; solo dónde está cada reporte (D-006).
- La autoría de un reporte nunca se expone a otros usuarios.
- Fotos: el front debe quitar metadatos de ubicación (EXIF) antes de subir. POR CONFIRMAR cómo.

## Ambientes
| Ambiente | Para qué | Quién aplica cambios |
|---|---|---|
| Local (Docker + Supabase CLI) | Desarrollo y pruebas | Cada quien |
| Remoto (proyecto Supabase gratuito) | Lo que usan los equipos de front | Solo desde `main` |

## Riesgos conocidos
- **Spam con sesiones anónimas:** cualquiera abre sesiones nuevas gratis, y `persona_en_riesgo` activa con 1
  reporte. Antes de abrir a público: captcha y límite de inicios anónimos en Supabase Auth (P-16).
- El plan gratuito pausa proyectos inactivos: programar un uso semanal o reactivarlo antes de testeos.
- Push en iPhone solo funciona si la web se instala en pantalla de inicio (verificar en Fase 4).
- La fuente oficial de clima puede no tener API: plan B es carga manual por el admin.
