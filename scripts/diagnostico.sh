#!/usr/bin/env bash
# Revisa que el arnés esté bien instalado en ESTA compu e imprime un reporte para pegarlo en la IA.
# Uso: bash scripts/diagnostico.sh            (incluye las pruebas del arnés, ~20 s)
#      bash scripts/diagnostico.sh --sin-pruebas
. "$(dirname "$0")/lib.sh"
ir_a_raiz

fallas=0
bien() { echo "  ✔ $1"; }
falla() { fallas=$((fallas + 1)); echo "  ✘ $1"; [ -n "${2:-}" ] && echo "      → $2"; }

echo "=== Diagnóstico del arnés · $(date '+%F %H:%M') ==="
echo "Sistema: $(uname -s) · bash $BASH_VERSION"

echo "Herramientas:"
for h in git gh supabase docker node; do
  if command -v "$h" >/dev/null 2>&1; then
    bien "$h $("$h" --version 2>&1 | head -n 1)"
  else
    case "$h" in
      docker|node) echo "  · $h no instalado (opcional por ahora)" ;;
      *) falla "$h no instalado" "ver docs/ONBOARDING.md" ;;
    esac
  fi
done
if command -v gh >/dev/null 2>&1; then
  gh auth status >/dev/null 2>&1 && bien "gh con sesión iniciada" || falla "gh sin sesión" "corre: gh auth login"
fi

echo "Repo:"
[ -n "$(git config user.name)" ] && bien "git user.name = $(git config user.name)" \
  || falla "git sin user.name" "git config --global user.name \"Tu Nombre\""
[ "$(git config core.hooksPath)" = ".githooks" ] && bien "hooks activos (.githooks)" \
  || falla "hooks desactivados" "corre: bash scripts/instalar.sh"
if grep -lqU $'\r' scripts/*.sh .githooks/* 2>/dev/null; then
  falla "fin de línea CRLF en scripts (rompe bash)" "rm scripts/*.sh .githooks/* && git checkout -- scripts .githooks"
else
  bien "fin de línea LF en scripts"
fi
[ -f .env ] && bien ".env existe" || falla ".env no existe" "corre: bash scripts/instalar.sh"
[ -z "$(git ls-files .env)" ] && bien ".env no está en git" || falla ".env está versionado" "avisa a Diego: hay que rotar llaves"
rama="$(rama_actual)"
echo "  · rama actual: ${rama:-(ninguna)}"
if hay_remoto && git rev-parse -q --verify origin/main >/dev/null; then
  set -- $(git rev-list --left-right --count origin/main...HEAD)
  echo "  · $2 adelante / $1 atrás de origin/main"
  bien "remoto origin: $(git remote get-url origin)"
else
  echo "  · sin remoto origin todavía"
fi
[ -z "$(git status --porcelain)" ] && bien "sin cambios pendientes" || echo "  · hay cambios sin guardar"

if [ "${1:-}" != "--sin-pruebas" ]; then
  echo "Pruebas del arnés:"
  if salida="$(bash scripts/test-arnes.sh 2>&1)"; then
    bien "$(echo "$salida" | tail -n 1)"
  else
    falla "$(echo "$salida" | tail -n 1)"
    echo "$salida" | grep '✘' | sed 's/^/    /'
  fi
fi

echo "=== Resultado: $fallas problema(s) ==="
[ "$fallas" -eq 0 ]
