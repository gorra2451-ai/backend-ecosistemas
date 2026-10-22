#!/usr/bin/env bash
# Invita a un usuario de GitHub como colaborador (permiso de push) de este repo.
# Uso: bash scripts/invitar.sh <usuario_github> [--si]   (--si salta la confirmación)
. "$(dirname "$0")/lib.sh"
ir_a_raiz

usuario="${1:-}"
[ -n "$usuario" ] || bloquear "uso: scripts/invitar.sh <usuario_github>"
command -v gh >/dev/null 2>&1 || bloquear "falta gh (GitHub CLI)."
repo="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)" || bloquear "este repo no está en GitHub todavía."
gh api --silent "users/$usuario" 2>/dev/null || bloquear "el usuario '$usuario' no existe en GitHub."

if [ "${2:-}" != "--si" ]; then
  read -r -p "¿Invitar a $usuario como colaborador de $repo? [s/N] " respuesta
  [ "$respuesta" = "s" ] || [ "$respuesta" = "S" ] || { info "Cancelado."; exit 0; }
fi

gh api --silent -X PUT "repos/$repo/collaborators/$usuario" -f permission=push \
  || bloquear "GitHub rechazó la invitación."
info "Invitación enviada. $usuario debe aceptarla en https://github.com/$repo/invitations"
