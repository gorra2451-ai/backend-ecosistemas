#!/usr/bin/env bash
# Crea la rama de una tarea de docs/PLAN.md partiendo de main actualizada.
# Uso: bash scripts/nueva-tarea.sh [-t tipo] F1-T3 descripcion corta
#   → rama feat/f1-t3-descripcion-corta   (tipo por defecto: feat)
. "$(dirname "$0")/lib.sh"
ir_a_raiz

tipo="feat"
while getopts "t:" opcion; do
  case "$opcion" in
    t) tipo="$OPTARG" ;;
    *) bloquear "uso: scripts/nueva-tarea.sh [-t tipo] F1-T3 descripcion" ;;
  esac
done
shift $((OPTIND - 1))
[ $# -ge 2 ] || bloquear "uso: scripts/nueva-tarea.sh [-t tipo] F1-T3 descripcion"

echo "$tipo" | grep -Eq "^($TIPOS)$" || bloquear "tipo '$tipo' inválido. Usa: ${TIPOS//|/, }"
tarea="$(echo "$1" | tr '[:lower:]' '[:upper:]')"
shift
grep -q "$tarea " docs/PLAN.md || bloquear "la tarea $tarea no está en docs/PLAN.md"

# Descripción → minúsculas, sin acentos, palabras unidas con guiones.
desc="$(echo "$*" | tr '[:upper:]' '[:lower:]' \
  | sed 's/á/a/g; s/é/e/g; s/í/i/g; s/ó/o/g; s/ú/u/g; s/ñ/n/g; s/ü/u/g' \
  | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
rama="$tipo/$(echo "$tarea" | tr '[:upper:]' '[:lower:]')-$desc"

arbol_limpio || bloquear "tienes cambios sin guardar. Guárdalos (scripts/guardar.sh) antes de cambiar de tarea."
git show-ref --verify -q "refs/heads/$rama" && bloquear "la rama $rama ya existe. Cámbiate con: git checkout $rama"

git checkout -q main
if hay_remoto; then
  git fetch -q origin
  git merge -q --ff-only origin/main || bloquear "tu main local se separó de origin/main. Pide ayuda antes de seguir."
fi
git checkout -q -b "$rama"

info "Rama $rama creada desde main actualizada."
info "Al terminar: bash scripts/guardar.sh \"$tipo(modulo): qué cambió\" y bash scripts/cerrar-tarea.sh"
