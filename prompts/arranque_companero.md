# Prompt de arranque · LeoFigo74z
> Pégalo completo en tu IA (Codex o ChatGPT) la primera vez. En las siguientes sesiones
> pega `prompts/inicio_sesion.md`.

---

Vas a trabajar conmigo en el backend de una plataforma de inundaciones para Guadalajara
(Supabase + Postgres). Repo: https://github.com/gorra2451-ai/backend-ecosistemas
Mi compañero Diego lleva la otra mitad y es quien autoriza todo lo que se sube a GitHub.

## Reglas fijas (aplican en toda la sesión)
1. **Nunca hagas push sin autorización de Diego.** Todo se construye y se prueba en mi compu.
   El repo lo hace cumplir: con el modo solo local, `git push` se bloquea.
2. **Al terminar cada bloque grande** (una tarea completa de `docs/PLAN.md`), detente y
   escríbeme un mensaje listo para mandarle a Diego por WhatsApp (formato abajo).
   No empieces el siguiente bloque hasta que yo te diga que Diego respondió.
3. **Dudas → a Diego, no las supongas.** Si algo no está claro (una regla, un dato, un nombre),
   para y dame la pregunta redactada para Diego. Nunca inventes teléfonos, instituciones,
   umbrales ni fuentes: van como `POR CONFIRMAR` en `PREGUNTAS.md`.
4. Las reglas del repo están en `AGENTS.md` y son obligatorias. Si algo de este prompt choca
   con `AGENTS.md`, gana este prompt solo en lo de push y avisos a Diego.
5. Nunca me pidas ni aceptes llaves de `.env` en el chat.

Si no puedes correr comandos en mi compu (ChatGPT en el navegador), dímelo: yo corro cada
comando en la terminal (Git Bash en Windows) y te pego la salida.

## Paso 1 · Auditoría de mi compu
Corre (o pídeme correr) esto y dame una tabla **herramienta · versión · ✔/✘ · cómo arreglarlo**:
```bash
git --version; gh --version; supabase --version; docker --version; bash --version | head -1
gh auth status
docker info >/dev/null 2>&1 && echo "docker corriendo" || echo "docker apagado"
```
Mínimo para construir: git, gh con sesión iniciada, Supabase CLI y Docker Desktop corriendo
(la base local corre en Docker). Instalación: `docs/ONBOARDING.md` §1.
No sigas hasta que todo esté en ✔.

## Paso 2 · Bajar el repo y activar el arnés
```bash
# Primera vez:
gh repo clone gorra2451-ai/backend-ecosistemas && cd backend-ecosistemas
# Si ya lo tenía: cd backend-ecosistemas && git checkout main && git pull

bash scripts/instalar.sh            # hooks, permisos y .env
git config arnes.soloLocal true     # modo solo local: nada se sube sin Diego
bash scripts/diagnostico.sh         # debe terminar en "0 problema(s)"
supabase db start                   # base local (Docker)
bash scripts/probar-db.sh           # pruebas de la base: deben pasar todas
```
Si algo marca ✘ o falla, dime la causa y el arreglo exacto antes de seguir.

## Paso 3 · Entender el proyecto
Lee `AGENTS.md`, `HANDOFF.md` y `docs/PLAN.md`. Resúmeme en 6 líneas máximo:
qué hace el backend, fase actual, **mis tareas** (dueño **C**) con su %, y cuál va primero.
Mi primera tarea es **F1-T2 (sesión anónima y perfiles)**: es la que hoy impide que los
equipos de front puedan reportar. Lee lo que pide en `docs/MODELO_DATOS.md`,
`docs/API.md` y `PREGUNTAS.md` (P-16, anti-spam).

## Paso 4 · Construir, bloque por bloque
Para cada tarea:
1. `bash scripts/sync.sh` y `bash scripts/nueva-tarea.sh F1-T2 descripcion-corta`.
2. Plan de 3–6 líneas y **espera mi OK** antes de tocar esquema, RLS o borrar algo.
3. Primero la prueba en `supabase/tests/`, luego la migración nueva en `supabase/migrations/`
   (nunca editar una migración ya existente).
4. `bash scripts/probar-db.sh` hasta que todo pase. Actualiza `docs/API.md` si cambia algo
   que usa el front.
5. `bash scripts/guardar.sh "tipo(modulo): qué cambió"` → guarda en mi compu, no sube.
6. Mensaje para Diego y **alto**.

**Formato del mensaje para Diego:**
```
Bloque terminado: F1-T2 <nombre>
Qué hace: <2–3 líneas>
Pruebas: <N pasan, 0 fallan> (salida de probar-db.sh)
Archivos: <lista corta>
Dudas: <o "ninguna">
¿Autorizas subirlo?
```

**Cuando Diego autorice** (yo te lo diré):
```bash
PUSH_AUTORIZADO=1 bash scripts/guardar.sh "tipo(modulo): qué cambió"
PUSH_AUTORIZADO=1 bash scripts/cerrar-tarea.sh     # abre el PR; Diego lo revisa y lo mergea
```

Empieza por el Paso 1.
