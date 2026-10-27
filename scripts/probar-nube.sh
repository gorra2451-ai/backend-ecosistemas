#!/usr/bin/env bash
# Revisa la seguridad del proyecto en la nube desde fuera, como lo vería un front o un atacante.
# Usa solo SUPABASE_URL y SUPABASE_ANON_KEY (llave publicable) de .env. No escribe nada.
# Uso: bash scripts/probar-nube.sh      (después de cada `supabase db push`)
. "$(dirname "$0")/lib.sh"
ir_a_raiz

leer_env() { grep "^$1=" .env 2>/dev/null | head -n 1 | cut -d= -f2-; }
URL="$(leer_env SUPABASE_URL)"
LLAVE="$(leer_env SUPABASE_ANON_KEY)"
[ -n "$URL" ] && [ -n "$LLAVE" ] || bloquear "faltan SUPABASE_URL y SUPABASE_ANON_KEY en .env (pídeselas a Diego)."
command -v curl >/dev/null 2>&1 || bloquear "falta curl."

PASAN=0
FALLAN=0
# revisa "descripción" "texto esperado en la respuesta" curl-args...
revisa() {
  local d="$1" esperado="$2"; shift 2
  local out
  out="$(curl -s --max-time 20 -H "apikey: $LLAVE" "$@" 2>&1)"
  if printf '%s' "$out" | grep -q -- "$esperado"; then
    PASAN=$((PASAN + 1)); echo "  ✔ $d"
  else
    FALLAN=$((FALLAN + 1)); echo "  ✘ $d"; printf '%s\n' "$out" | head -c 300 | sed 's/^/      /'; echo
  fi
}
JSON="Content-Type: application/json"

echo "Lecturas públicas"
revisa "parametros se leen" '"umbral_activacion"' "$URL/rest/v1/parametros?select=clave"
revisa "zonas_publicas responde" '^\[' "$URL/rest/v1/zonas_publicas?select=celda&limit=1"

echo "Lo privado no se ve"
revisa "perfil_id de reportes oculto" '42501' "$URL/rest/v1/reportes?select=perfil_id"
revisa "perfil_id de confirmaciones oculto" '42501' "$URL/rest/v1/confirmaciones?select=perfil_id"
revisa "administradores no se lee" '42501' "$URL/rest/v1/administradores?select=*"
revisa "acciones_admin vacía para anon" '^\[\]$\|42501' "$URL/rest/v1/acciones_admin?select=*"

echo "Sin sesión no se escribe"
revisa "crear_reporte bloqueado" '42501' -X POST -H "$JSON" "$URL/rest/v1/rpc/crear_reporte" \
  -d '{"p_id":"7b1c6a4e-0000-4000-8000-000000000001","p_tipo":"calle","p_pasan_carros":true,"p_lat":20.66,"p_lng":-103.35}'
revisa "parametros no se modifica" '42501' -X POST -H "$JSON" "$URL/rest/v1/parametros" \
  -d '{"clave":"x","valor":1,"descripcion":"x"}'
revisa "funciones internas no expuestas" '42501\|PGRST202' -X POST -H "$JSON" "$URL/rest/v1/rpc/expirar_reportes" -d '{}'

echo "Entradas abusivas y llaves"
revisa "área del mundo rechazada" 'area_demasiado_grande' -X POST -H "$JSON" "$URL/rest/v1/rpc/reportes_activos_en_area" \
  -d '{"min_lat":-90,"min_lng":-180,"max_lat":90,"max_lng":180}'
revisa "token falso rechazado" 'PGRST301' -H "Authorization: Bearer abc.def.ghi" "$URL/rest/v1/parametros?select=clave"
revisa "GraphQL apagado" 'not enabled\|404' -X POST -H "$JSON" "$URL/graphql/v1" -d '{"query":"{__typename}"}'

echo
echo "Resultado: $PASAN pasan, $FALLAN fallan"
[ "$FALLAN" -eq 0 ]
