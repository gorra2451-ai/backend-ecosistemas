#!/usr/bin/env bash
# Prueba rápida de la base: aplica migraciones + seed + UNA prueba pgTAP dentro de una transacción
# que se deshace al final. No deja nada en la base, y varias corridas a la vez no se pisan
# (Postgres las forma en fila por los locks). Sirve para iterar; la verificación final es
# `supabase db reset && supabase test db` (y el CI).
# Requiere Postgres local: supabase db start
# Uso: bash scripts/probar-db.sh                         (todas las pruebas de supabase/tests)
#      bash scripts/probar-db.sh supabase/tests/0100_reportes.test.sql
. "$(dirname "$0")/lib.sh"
ir_a_raiz

contenedor="supabase_db_$(sed -nE 's/^project_id = "(.*)"/\1/p' supabase/config.toml)"
docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$contenedor" \
  || bloquear "Postgres local apagado. Corre: supabase db start"

# Migraciones en orden + seed, todo dentro de una transacción.
preparar() {
  echo "begin;"
  echo "set local lock_timeout = '300s';"
  for m in supabase/migrations/*.sql; do
    [ -f "$m" ] || continue
    echo "\\echo '# migración $m'"
    cat "$m"; echo
  done
  if [ -f supabase/seed.sql ]; then echo "\\echo '# seed'"; cat supabase/seed.sql; echo; fi
}

correr() {
  # La prueba trae su propio begin/rollback: su rollback deshace también las migraciones.
  { preparar; [ -n "${1:-}" ] && cat "$1"; echo; echo "rollback;"; } \
    | docker exec -i "$contenedor" psql -U postgres -d postgres -X -q -t -A -v ON_ERROR_STOP=1 2>&1
}

pruebas=("$@")
if [ ${#pruebas[@]} -eq 0 ]; then
  for t in supabase/tests/*.sql; do [ -f "$t" ] && pruebas+=("$t"); done
fi

if [ ${#pruebas[@]} -eq 0 ]; then
  salida="$(correr)" || { echo "$salida" | grep -v '^#' >&2; bloquear "las migraciones o el seed fallan."; }
  info "Migraciones y seed aplican limpio (no hay pruebas todavía)."
  exit 0
fi

fallas=0
for t in "${pruebas[@]}"; do
  salida="$(correr "$t")"; codigo=$?
  total="$(echo "$salida" | grep -cE '^(not )?ok ')"
  malas="$(echo "$salida" | grep -E '^not ok |^# Looks like|ERROR:' )"
  if [ $codigo -ne 0 ] || [ -n "$malas" ] || [ "$total" -eq 0 ]; then
    fallas=$((fallas + 1))
    echo "✘ $t"
    echo "$salida" | grep -E '^not ok |^#  |^# Looks like|ERROR:|DETAIL:|HINT:|CONTEXT:|LINE [0-9]+:|^# migración' \
      | grep -v '^# migración' | sed 's/^/    /'
    [ "$total" -eq 0 ] && [ $codigo -eq 0 ] && echo "    (no corrió ninguna prueba: ¿falta select plan(...)?)"
  else
    echo "✔ $t ($total pruebas)"
  fi
done

[ $fallas -eq 0 ] && info "Todas las pruebas pasan." || bloquear "$fallas archivo(s) de prueba fallan."
