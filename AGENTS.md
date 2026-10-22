# AGENTS.md — Reglas para cualquier IA (Claude, ChatGPT/Codex, Warp, Cursor)

> Este archivo es la fuente única de reglas. `CLAUDE.md` solo lo importa.
> Si una herramienta no lo lee sola, pega `prompts/inicio_sesion.md` al empezar.

## 1. Qué es este repo
Backend de la plataforma de inundaciones de la ZMG (materia Ecosistemas, ITESO, Otoño 2026).
La plataforma permite **reportar inundaciones, confirmarlas, verlas en un mapa, recibir alertas
y saber a qué institución acudir**. Este repo es solo el backend: base de datos, reglas,
seguridad y funciones. Los equipos de front consumen lo que define `docs/API.md`.

## 2. Orden de lectura al iniciar una sesión (obligatorio)
1. `HANDOFF.md` — dónde quedamos y cuál es el siguiente paso. **Empieza aquí.**
2. `docs/PLAN.md` — fase actual y tareas con dueño.
3. Solo lo que la tarea necesite: `docs/MODELO_DATOS.md`, `docs/REGLAS_NEGOCIO.md`,
   `docs/API.md`, `docs/ARQUITECTURA.md`, `docs/CONTEXTO.md`.
4. `PREGUNTAS.md` si la tarea toca algo marcado "por confirmar".

No leas todo el repo "por si acaso": gasta contexto. Lee lo que la tarea pide.

## 3. Reglas de trabajo
1. **Una tarea a la vez.** Toma una tarea de `docs/PLAN.md`, termínala, ciérrala.
2. **Rama por tarea:** `tipo/modulo-descripcion` (ej. `feat/reportes-crear`). Nunca trabajar en `main`.
3. **Plan antes de código:** di en 3–6 líneas qué vas a hacer y espera aprobación humana
   antes de tocar esquema, seguridad (RLS) o borrar algo.
4. **No inventar datos.** Teléfonos, instituciones, umbrales, fuentes de clima: si no hay dato
   verificado, queda como `POR CONFIRMAR` y se agrega a `PREGUNTAS.md`.
5. **El esquema solo cambia por migración** (`supabase/migrations/`). Nunca editar tablas
   desde el dashboard de Supabase. Una migración aplicada no se edita: se crea otra.
6. **Los números de negocio viven en la tabla `parametros`**, no en el código
   (umbral de activación, minutos de expiración, radios). Así se ajustan sin redeploy.
7. **Seguridad primero:** RLS activo en todas las tablas. La `service_role` key jamás
   va al cliente ni a un archivo que se suba. Nada de secretos en el repo.
8. **Privacidad:** no se guardan datos personales ni el rastro de ubicación de nadie.
   Solo se guarda la ubicación de un reporte. Ver `docs/ARQUITECTURA.md` §Privacidad.
9. **Pruebas con cada regla:** toda regla de negocio o política RLS lleva su prueba en
   `supabase/tests/`. Sin prueba no está terminada.
10. **Contrato primero:** si cambias algo que el front consume, actualiza `docs/API.md`
    en el mismo PR y avisa en `PROGRESO.md`.
11. **Commits pequeños** en español, formato `tipo(modulo): qué cambió`
    (tipos: feat, fix, docs, test, refactor, chore). Sin trailers de co-autor
    (Vercel Hobby bloquea deploys con un segundo colaborador).
12. **Merge a `main` solo por PR** revisado por la otra persona, con `--no-ff`.

## 4. Definición de terminado
- [ ] Hace lo que pide la tarea y nada más
- [ ] Migración nueva (si aplica) corre limpia desde cero: `supabase db reset`
- [ ] Pruebas pasan: `supabase test db`
- [ ] `docs/API.md` / `docs/MODELO_DATOS.md` actualizados si cambió algo
- [ ] Tarea marcada en `docs/PLAN.md`, entrada en `PROGRESO.md`, `HANDOFF.md` al día
- [ ] PR abierto con la plantilla llena

## 5. Límite de contexto (sesiones nuevas)
- Cierra la sesión cuando: terminas una tarea, la IA empieza a repetir o a olvidar reglas,
  o la conversación ya es muy larga (en Claude, cuando avise de compactar; en ChatGPT,
  cuando se vuelva lenta o pierda detalles).
- **Antes de cerrar**, corre `prompts/cierre_sesion.md`: actualiza `HANDOFF.md` y `PROGRESO.md`.
- **Para abrir**, pega `prompts/inicio_sesion.md`. Con eso cualquier IA retoma sin historial.
- `HANDOFF.md` se mantiene corto (máx. ~60 líneas). La historia va en `PROGRESO.md`.

## 6. Comandos
```bash
supabase start            # levanta Postgres local (requiere Docker)
supabase db reset         # recrea la base local desde migraciones + seed
supabase test db          # corre pruebas pgTAP de supabase/tests
supabase migration new <nombre>
supabase functions serve  # Edge Functions en local
supabase db push          # aplica migraciones al proyecto remoto (solo desde main)
```

## 7. Qué NO hacer
- No crear frontend aquí (cada equipo tiene el suyo).
- No agregar dependencias o servicios de pago sin registrarlo en `DECISIONES.md`.
- No cambiar una decisión de `DECISIONES.md` sin agregar una nueva que la reemplace.
- No borrar archivos de documentación; si algo ya no aplica, márcalo como obsoleto.

## 8. Quién es quién
Reparto 50/50 del backend. `COMPANERO` es marcador hasta confirmar nombre y usuario de GitHub (P-10).

| Persona | Herramienta | Módulo | % |
|---|---|---|---|
| Diego Rosas | Claude / Claude Code + Warp | Base compartida (extensiones, `parametros`, ZMG, seed) | 10% |
| | | Reportes | 15% |
| | | Confirmación y expiración | 15% |
| | | Zonas de calor | 5% |
| | | Admin | 5% |
| | | **Total Diego** | **50%** |
| COMPANERO | ChatGPT / Codex | Registro anónimo y perfiles | 10% |
| | | Fotos/videos (evidencias + Storage) | 8% |
| | | Refugios y realtime | 10% |
| | | Notificaciones y clima | 12% |
| | | Derivación | 10% |
| | | **Total COMPANERO** | **50%** |

Ambos revisan los PR del otro. El esquema base (Fase 1) se revisa juntos.
Las tareas `D+C` de `docs/PLAN.md` (coordinación, revisión, integración) no cuentan en el reparto.
