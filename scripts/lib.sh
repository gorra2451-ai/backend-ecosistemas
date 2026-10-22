#!/usr/bin/env bash
# Funciones compartidas por los scripts de scripts/ y los hooks de .githooks/.
# No se corre sola: se carga con  . "$(dirname "$0")/lib.sh"

# Formato de commit (AGENTS.md §3.11): tipo(modulo): qué cambió
TIPOS='feat|fix|docs|test|refactor|chore'
RE_MENSAJE="^($TIPOS)\([a-z0-9_-]+\): .+"

# Patrones de llaves que nunca deben entrar al repo.
# No se bloquea la palabra "service_role" sola: aparece legítimamente en SQL (grants, RLS).
RE_SECRETO='eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}'           # JWT (anon/service_role viejas)
RE_SECRETO="$RE_SECRETO|sb_secret_[A-Za-z0-9_-]{10,}"            # llave secreta nueva de Supabase
RE_SECRETO="$RE_SECRETO|sk_(live|test)_[A-Za-z0-9]{10,}"         # llaves estilo Stripe/OpenAI
RE_SECRETO="$RE_SECRETO|SERVICE_ROLE_KEY[\"']?[[:space:]]*[:=][[:space:]]*[\"']?[A-Za-z0-9_.-]{20,}"
RE_SECRETO="$RE_SECRETO|VAPID_PRIVATE_KEY[\"']?[[:space:]]*[:=][[:space:]]*[\"']?[A-Za-z0-9_-]{20,}"

info()     { echo "→ $*"; }
aviso()    { echo "⚠ $*" >&2; }
bloquear() { echo "✘ BLOQUEADO: $*" >&2; exit 1; }

raiz_repo()      { git rev-parse --show-toplevel 2>/dev/null; }
# Todos los scripts corren desde la raíz del repo; fuera de un repo git se niegan a correr.
ir_a_raiz() {
  local raiz
  raiz="$(raiz_repo)" || bloquear "no estás dentro del repo backend-ecosistemas (git). Entra a la carpeta clonada."
  cd "$raiz" || exit 1
}
rama_actual()    { git branch --show-current; }
hay_remoto()     { git remote get-url origin >/dev/null 2>&1; }
arbol_limpio()   { [ -z "$(git status --porcelain)" ]; }
mensaje_valido() { printf '%s\n' "$1" | head -n 1 | grep -Eq "$RE_MENSAJE"; }

explicar_formato() {
  echo "  Formato: tipo(modulo): qué cambió" >&2
  echo "  Tipos: ${TIPOS//|/, }" >&2
  echo "  Ejemplo: feat(reportes): crear tabla reportes con RLS" >&2
}
