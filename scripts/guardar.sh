#!/usr/bin/env bash
# Guarda tu trabajo: valida el mensaje, hace add + commit + push de la rama actual.
# Uso: bash scripts/guardar.sh "tipo(modulo): qué cambió"
# Nunca en main. Los hooks revisan llaves y .env antes del commit.
. "$(dirname "$0")/lib.sh"
ir_a_raiz

mensaje="${1:-}"
[ -n "$mensaje" ] || bloquear "uso: scripts/guardar.sh \"tipo(modulo): qué cambió\""
rama="$(rama_actual)"
[ -n "$rama" ] || bloquear "no estás en ninguna rama. Cámbiate a la de tu tarea: git checkout <rama>"
[ "$rama" != "main" ] || bloquear "estás en main. Crea tu rama: scripts/nueva-tarea.sh F1-T1 descripcion"
if ! mensaje_valido "$mensaje"; then
  echo "✘ BLOQUEADO: mensaje con formato inválido: \"$mensaje\"" >&2
  explicar_formato
  exit 1
fi

git add -A
if git diff --cached --quiet; then
  info "No hay cambios nuevos que guardar."
else
  git commit -q -m "$mensaje" || exit 1
  git log -1 --oneline
fi

if solo_local; then
  info "Commit guardado solo en tu compu (modo solo local). Para subirlo pide autorización a Diego."
elif hay_remoto; then
  git push -q -u origin "$rama" || bloquear "falló el push. Corre bash scripts/sync.sh y vuelve a intentar."
  info "Subido a origin/$rama."
else
  aviso "No hay remoto 'origin'; el commit quedó solo en tu compu."
fi
