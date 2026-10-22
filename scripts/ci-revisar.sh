#!/usr/bin/env bash
# Revisión del lado del servidor (CI): repite lo que hacen los hooks sobre TODOS los commits
# del PR, porque los hooks locales se pueden saltar con --no-verify.
# Uso: bash scripts/ci-revisar.sh <rama_base>      (ej. origin/main)
. "$(dirname "$0")/lib.sh"
ir_a_raiz

base="${1:-origin/main}"
problemas=""

for commit in $(git rev-list --no-merges "$base..HEAD"); do
  corto="$(git rev-parse --short "$commit")"
  asunto="$(git log -1 --format=%s "$commit")"

  mensaje_valido "$asunto" || problemas="$problemas\n  $corto: mensaje inválido \"$asunto\""
  if git log -1 --format=%B "$commit" | grep -qi '^co-authored-by:'; then
    problemas="$problemas\n  $corto: trae trailer Co-Authored-By"
  fi

  # Se revisa cada commit (no solo el diff final): una llave borrada después sigue en el historial.
  while IFS= read -r archivo; do
    [ -z "$archivo" ] && continue
    case "$(basename "$archivo")" in
      .env.example) ;;
      .env|.env.*) problemas="$problemas\n  $corto: sube el archivo $archivo" ;;
    esac
    if git show --format= -U0 --no-color "$commit" -- "$archivo" | grep '^+' | grep -v '^+++' | grep -Eq "$RE_SECRETO"; then
      problemas="$problemas\n  $corto: $archivo contiene algo que parece una llave secreta"
    fi
  done <<< "$(git show --format= --name-only --diff-filter=ACMR "$commit")"
done

if [ -n "$problemas" ]; then
  printf "✘ BLOQUEADO: el PR no pasa la revisión del arnés:%b\n" "$problemas" >&2
  echo "  Si es una llave: no basta con borrarla, hay que rotarla en Supabase y reescribir la rama." >&2
  exit 1
fi
info "Revisión del arnés OK: $(git rev-list --no-merges --count "$base..HEAD") commit(s) revisados."
