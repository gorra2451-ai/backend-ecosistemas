#!/usr/bin/env bash
# Trae lo último de main y lo integra en tu rama. Córrelo al INICIAR cada sesión.
# Uso: bash scripts/sync.sh
# Integra con merge (no rebase) para no tener que forzar el push de ramas ya subidas.
. "$(dirname "$0")/lib.sh"
ir_a_raiz

if ! hay_remoto; then
  aviso "No hay remoto 'origin'; nada que sincronizar."
  git status -sb
  exit 0
fi
arbol_limpio || bloquear "tienes cambios sin guardar. Corre primero: bash scripts/guardar.sh \"tipo(modulo): mensaje\""

git fetch -q origin
rama="$(rama_actual)"
if [ "$rama" = "main" ]; then
  git merge -q --ff-only origin/main || bloquear "tu main local se separó de origin/main. Pide ayuda antes de seguir."
else
  if ! git merge -q --no-edit origin/main; then
    echo "✘ BLOQUEADO: hay conflictos al integrar main en $rama." >&2
    echo "  Archivos en conflicto:" >&2
    git diff --name-only --diff-filter=U | sed 's/^/    /' >&2
    echo "  Resuélvelos, luego: git add <archivos> && git commit --no-edit" >&2
    echo "  O cancela con: git merge --abort" >&2
    exit 1
  fi
fi

info "Rama $rama al día con main."
git status -sb | head -n 1
git log --oneline -5
