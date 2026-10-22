# ONBOARDING — Primer día en el backend
> Para COMPANERO (o quien entre al repo). Tiempo: ~30 min. Al final debes tener
> `bash scripts/diagnostico.sh` con **0 problemas**.

## 1. Instalar herramientas
| Herramienta | macOS (Homebrew) | Windows |
|---|---|---|
| git | `brew install git` | [Git for Windows](https://git-scm.com/download/win) (incluye **Git Bash**) |
| gh (GitHub CLI) | `brew install gh` | `winget install GitHub.cli` |
| Supabase CLI | `brew install supabase/tap/supabase` | `scoop install supabase` ([scoop.sh](https://scoop.sh)) |
| Docker Desktop | `brew install --cask docker` | [docker.com](https://www.docker.com/products/docker-desktop/) |

- **Docker** solo hace falta para probar migraciones en tu compu (desde la Fase 1). El CI de
  GitHub las prueba de todos modos en cada PR.
- **Windows:** todos los comandos de este repo se corren en **Git Bash**, no en PowerShell ni CMD.

Después:
```bash
gh auth login                                   # GitHub.com → HTTPS → navegador
git config --global user.name "Tu Nombre"
git config --global user.email "tu-correo@ejemplo.com"
git config --global core.autocrlf input         # solo Windows: evita romper los scripts
```

## 2. Clonar e instalar
1. Acepta la invitación del repo (te llega por correo o en github.com/notifications).
2. Clona e instala:
```bash
gh repo clone gorra2451-ai/backend-ecosistemas
cd backend-ecosistemas
bash scripts/instalar.sh        # hooks, permisos y .env
bash scripts/diagnostico.sh     # debe terminar en "0 problema(s)"
```
3. Las llaves de `.env` te las pasa Diego por privado. **Nunca** se suben ni se pegan en la IA.

## 3. El ciclo de cada tarea
```bash
bash scripts/sync.sh                                   # 1. al empezar la sesión
bash scripts/nueva-tarea.sh F1-T2 perfiles anonimos    # 2. rama de tu tarea (de docs/PLAN.md)
#    ... trabajar con la IA ...
bash scripts/guardar.sh "feat(perfiles): tabla perfiles con RLS"   # 3. cada avance
bash scripts/cerrar-tarea.sh                           # 4. abre el PR
bash scripts/estado.sh                                 # cuando quieras ver cómo va todo
```
Diego revisa tu PR y tú revisas los suyos (con `prompts/revision_pr.md`). Nada entra a `main`
sin PR y sin CI en verde.

## 4. Trabajar con tu IA
El arnés no depende de qué IA uses: las reglas están en `AGENTS.md` y lo que protege el repo
(hooks + CI) corre igual. Lo que cambia es **quién corre los comandos**.

### A) Codex o una IA con terminal (recomendado)
- Codex lee `AGENTS.md` solo al abrir el repo.
- La IA corre los scripts por ti. Pídele siempre que use `scripts/` y no `git` a mano.
- Primera sesión: pega `prompts/arranque_companero.md`. Después, `prompts/inicio_sesion.md`.

### B) ChatGPT web (sin terminal)
- La IA **no ve el repo ni corre nada**: tú corres los scripts en Git Bash y le pegas la salida.
- Crea un **Proyecto** en ChatGPT llamado `backend-ecosistemas` y súbele como archivos:
  `AGENTS.md`, `HANDOFF.md`, `docs/PLAN.md` y los docs que pida tu tarea. Vuelve a subirlos cuando
  cambien (después de cada `sync.sh`).
- Primera sesión: pega `prompts/arranque_companero.md`. Cada sesión nueva: `prompts/inicio_sesion.md`.
- Si la IA te da código, **tú** lo guardas en el archivo y corres `scripts/guardar.sh`.
  Si te propone un comando de git que no sea un script de `scripts/`, pregunta antes.

### Al cerrar cada sesión (las dos formas)
Pega `prompts/cierre_sesion.md` para actualizar `HANDOFF.md` y `PROGRESO.md`, y guarda con
`scripts/guardar.sh`.

## 5. Si algo falla
| Síntoma | Qué hacer |
|---|---|
| `BLOQUEADO: commit directo a main` | `bash scripts/nueva-tarea.sh <tarea> <descripcion>` |
| `BLOQUEADO: mensaje … inválido` | Usa `tipo(modulo): qué cambió`, tipos: feat, fix, docs, test, refactor, chore |
| `BLOQUEADO: el commit trae secretos` | Saca la llave del archivo; va en `.env`. Si ya se subió, avisa a Diego (hay que rotarla) |
| `$'\r': command not found` (Windows) | `git config --global core.autocrlf input` y vuelve a clonar |
| CI en rojo en tu PR | Abre el PR en GitHub → pestaña *Checks* → copia el error y pégalo en tu IA |
