#!/usr/bin/env bash
# Panel de control: fase, ramas, PR abiertos, commits por persona y avance del plan.
# Uso: bash scripts/estado.sh
. "$(dirname "$0")/lib.sh"
ir_a_raiz

hay_remoto && git fetch -q origin 2>/dev/null

echo "== $(grep -m 1 'Fase actual' HANDOFF.md | tr -d '*')"
rama="$(rama_actual)"
echo "== Rama actual: ${rama:-(ninguna)}"
if hay_remoto && git rev-parse -q --verify origin/main >/dev/null; then
  set -- $(git rev-list --left-right --count origin/main...HEAD)
  echo "   $2 commit(s) adelante y $1 atrás de origin/main"
fi

echo
echo "== Ramas (más reciente arriba)"
git for-each-ref --sort=-committerdate refs/heads refs/remotes \
  --format='   %(refname:short) · %(committerdate:relative) · %(authorname)' | grep -v 'origin/HEAD'

echo
echo "== PR abiertos"
if command -v gh >/dev/null 2>&1 && hay_remoto; then
  prs="$(gh pr list --state open 2>/dev/null)" || prs="(no se pudo consultar GitHub)"
  printf '%s\n' "${prs:-(ninguno)}" | sed 's/^/   /'
else
  echo "   (sin gh o sin remoto)"
fi

echo
echo "== Últimos commits por persona"
git log --all --format='%an' | sort -u | while IFS= read -r autor; do
  echo "   $autor"
  git log --all --author="$autor" --format='     %h %ar · %s' -3
done

echo
echo "== Avance de docs/PLAN.md (% del reparto ya terminado)"
awk -F'|' '
  $2 ~ /\[[ x]\]/ {
    dueno = $4; gsub(/ /, "", dueno)
    pct = $5; gsub(/[^0-9]/, "", pct); pct += 0
    total[dueno] += pct; n[dueno]++
    if ($2 ~ /\[x\]/) { hecho[dueno] += pct; listas[dueno]++ }
  }
  END {
    nombre["D"] = "Diego"; nombre["C"] = "LeoFigo74z"; nombre["D+C"] = "Juntos"
    split("D C D+C", orden, " ")
    for (i = 1; i <= 3; i++) {
      d = orden[i]
      if (d in n) printf "   %-10s %2d%% de %2d%% · %d/%d tareas\n", nombre[d], hecho[d], total[d], listas[d], n[d]
    }
  }
' docs/PLAN.md
