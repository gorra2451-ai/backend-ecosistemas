#!/usr/bin/env bash
# Se corre UNA vez después de clonar: activa hooks, da permisos y crea .env.
# Uso: bash scripts/instalar.sh
. "$(dirname "$0")/lib.sh"
ir_a_raiz

git config core.hooksPath .githooks
chmod +x scripts/*.sh .githooks/* 2>/dev/null
info "Hooks activados (.githooks): bloquean llaves, .env y commits directos a main."

if [ -f .env ]; then
  info ".env ya existe; no lo toco."
else
  cp .env.example .env
  info ".env creado desde .env.example. Llena los valores que te pase Diego (nunca lo subas)."
fi

echo
echo "Herramientas:"
for h in git gh supabase docker node; do
  if command -v "$h" >/dev/null 2>&1; then
    printf "  ✔ %-9s %s\n" "$h" "$("$h" --version 2>&1 | head -n 1)"
  else
    printf "  ✘ %-9s falta (ver docs/ONBOARDING.md)\n" "$h"
  fi
done
if command -v gh >/dev/null 2>&1 && ! gh auth status >/dev/null 2>&1; then
  aviso "gh no tiene sesión. Corre: gh auth login"
fi

echo
info "Listo. Siguiente: bash scripts/sync.sh y luego bash scripts/nueva-tarea.sh <tarea> <descripcion>"
