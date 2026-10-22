#!/usr/bin/env bash
# Cierra la tarea: sube la rama, abre el PR con la plantilla y anota el cierre en PROGRESO.md.
# Uso: bash scripts/cerrar-tarea.sh
. "$(dirname "$0")/lib.sh"
ir_a_raiz

rama="$(rama_actual)"
[ -n "$rama" ] && [ "$rama" != "main" ] || bloquear "corre esto desde la rama de tu tarea, no desde main."
arbol_limpio || bloquear "tienes cambios sin guardar. Corre primero: bash scripts/guardar.sh \"tipo(modulo): mensaje\""
hay_remoto || bloquear "no hay remoto 'origin'."
command -v gh >/dev/null 2>&1 || bloquear "falta gh (GitHub CLI). Ver docs/ONBOARDING.md"

# Tarea a partir del nombre de la rama: feat/f1-t3-algo → F1-T3
tarea="$(echo "$rama" | sed -nE 's#^[a-z]+/(f[0-9]+-t[0-9]+).*#\1#p' | tr '[:lower:]' '[:upper:]')"
[ -n "$tarea" ] || tarea="$rama"

git fetch -q origin
git push -q -u origin "$rama" || bloquear "falló el push. Corre bash scripts/sync.sh y vuelve a intentar."
commits="$(git log --no-merges --format='- %s' origin/main..HEAD)"

if url="$(gh pr view "$rama" --json url -q .url 2>/dev/null)" && [ -n "$url" ]; then
  info "El PR ya existe: $url"
  exit 0
fi

titulo="$(git log --no-merges --reverse --format=%s origin/main..HEAD | head -n 1)"
[ -n "$titulo" ] || titulo="$tarea"

# Cuerpo = plantilla con la tarea y la lista de commits ya puestas.
cuerpo="$(mktemp)"
TAREA="$tarea" COMMITS="$commits" awk '
  /<!-- Fase y tarea/ { print ENVIRON["TAREA"]; next }
  /^## Qué cambia/    { print; print ENVIRON["COMMITS"]; salta = 1; next }
  salta && /^-[[:space:]]*$/ { salta = 0; next }
  { print }
' .github/pull_request_template.md > "$cuerpo"

url="$(gh pr create --base main --head "$rama" --title "$titulo" --body-file "$cuerpo")" \
  || { rm -f "$cuerpo"; bloquear "gh no pudo crear el PR."; }
rm -f "$cuerpo"
info "PR abierto: $url"

# Entrada en PROGRESO.md, debajo del encabezado (lo más nuevo arriba).
ENTRADA="## $(date +%F) · $(git config user.name) · cierre $tarea
**Hecho**
- PR: $url
$commits

**Pendiente**
- Revisión del PR por la otra persona.
" ENTRADA="$ENTRADA" awk '
  { print }
  !hecho && /^$/ { print ENVIRON["ENTRADA"]; hecho = 1 }
' PROGRESO.md > PROGRESO.md.tmp && mv PROGRESO.md.tmp PROGRESO.md

git add PROGRESO.md
git commit -q -m "docs(progreso): cierre $tarea" && git push -q

echo
info "Siguiente: pide revisión a tu compañero, llena la plantilla del PR (casillas) y"
info "actualiza PLAN/HANDOFF con prompts/cierre_sesion.md."
