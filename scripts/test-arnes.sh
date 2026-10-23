#!/usr/bin/env bash
# Pruebas del arnés: hooks y scripts de scripts/.
# Copia el repo a una carpeta temporal con un remoto falso, así no toca tu repo real.
# Uso: bash scripts/test-arnes.sh      (lo corre también el CI)
set -u

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASAN=0
FALLAN=0
ok()  { PASAN=$((PASAN + 1)); echo "  ✔ $1"; }
mal() { FALLAN=$((FALLAN + 1)); echo "  ✘ $1"; [ -n "${2:-}" ] && echo "$2" | sed 's/^/      /'; }

# espera_ok "descripción" comando...   → el comando debe salir con 0
espera_ok() {
  local d="$1"; shift
  local out
  if out="$("$@" 2>&1)"; then ok "$d"; else mal "$d" "$out"; fi
}
# espera_bloqueo "descripción" comando...   → debe fallar y decir BLOQUEADO
espera_bloqueo() {
  local d="$1"; shift
  local out
  if out="$("$@" 2>&1)"; then
    mal "$d (debía fallar y pasó)" "$out"
  elif echo "$out" | grep -q "BLOQUEADO"; then
    ok "$d"
  else
    mal "$d (falló, pero no por el arnés)" "$out"
  fi
}

# --- Entorno aislado: git sin tu configuración global, gh falso ----------------
export GIT_CONFIG_GLOBAL="$TMP/gitconfig"
export GIT_CONFIG_NOSYSTEM=1
git config --global user.name "Prueba"
git config --global user.email "prueba@example.com"
git config --global init.defaultBranch main

mkdir -p "$TMP/bin"
cat > "$TMP/bin/gh" <<'EOF'
#!/usr/bin/env bash
# gh falso: registra cómo lo llamaron y responde como GitHub.
echo "$*" >> "$GH_LOG"
case "$1 $2" in
  "pr create") echo "https://github.com/prueba/backend-ecosistemas/pull/7" ;;
  "pr view")   exit 1 ;;
  "pr list")   echo "7	PR-DE-PRUEBA	feat/f1-t3-reportes" ;;
  "repo view") echo "prueba/backend-ecosistemas" ;;
  "api")       exit 0 ;;
esac
EOF
chmod +x "$TMP/bin/gh"
export GH_LOG="$TMP/gh.log"
export PATH="$TMP/bin:$PATH"

git init -q --bare "$TMP/remoto.git"
mkdir "$TMP/repo"
(cd "$RAIZ" && tar cf - --exclude=.git --exclude=.env .) | (cd "$TMP/repo" && tar xf -)
cd "$TMP/repo" || exit 1
git init -q

echo "instalar.sh"
espera_ok "corre sin error" bash scripts/instalar.sh
[ "$(git config core.hooksPath)" = ".githooks" ] && ok "activa .githooks" || mal "activa .githooks"
[ -f .env ] && ok "crea .env desde .env.example" || mal "crea .env desde .env.example"

echo "fuera de un repo git"
mkdir "$TMP/sin-repo"
cp -R scripts "$TMP/sin-repo/"
espera_bloqueo "guardar.sh se niega a correr" sh -c "cd '$TMP/sin-repo' && bash scripts/guardar.sh 'feat(x): y'"
espera_bloqueo "diagnostico.sh lo avisa" sh -c "cd '$TMP/sin-repo' && bash scripts/diagnostico.sh --sin-pruebas"

echo "probar-nube.sh"
espera_bloqueo "sin URL ni llave en .env lo avisa" bash scripts/probar-nube.sh

echo "diagnostico.sh"
# Solo se revisa la línea de hooks: el total depende de qué herramientas tenga la máquina (en CI no hay supabase).
out="$(bash scripts/diagnostico.sh --sin-pruebas 2>&1)"
echo "$out" | grep -q "✔ hooks" && ok "reporta hooks activos" || mal "reporta hooks activos" "$out"
git config --unset core.hooksPath
out="$(bash scripts/diagnostico.sh --sin-pruebas 2>&1)"; r=$?
echo "$out" | grep -q "✘ hooks" && [ $r -ne 0 ] && ok "detecta hooks desactivados" || mal "detecta hooks desactivados" "$out"
git config core.hooksPath .githooks
printf 'x\r\n' >> scripts/lib.sh
out="$(bash scripts/diagnostico.sh --sin-pruebas 2>&1)"
echo "$out" | grep -q "✘ fin de línea" && ok "detecta scripts con CRLF (Windows)" || mal "detecta CRLF" "$out"
sed -i.bak '$d' scripts/lib.sh && rm -f scripts/lib.sh.bak

echo "pre-commit en main"
git add -A
espera_ok "permite el primer commit del repo en main" git commit -q -m "chore(repo): arnés inicial"
git remote add origin "$TMP/remoto.git"
git push -q -u origin main 2>/dev/null
espera_bloqueo "bloquea commits directos a main" git commit -q --allow-empty -m "chore(repo): directo"

git checkout -q -b prueba
echo "commit-msg"
espera_ok "acepta 'feat(reportes): algo'" git commit -q --allow-empty -m "feat(reportes): crear tabla"
espera_bloqueo "rechaza mensaje sin formato" git commit -q --allow-empty -m "cambios varios"
espera_bloqueo "rechaza tipo inválido" git commit -q --allow-empty -m "update(reportes): algo"
espera_bloqueo "rechaza trailer de co-autor" git commit -q --allow-empty -m "feat(reportes): algo

Co-Authored-By: Alguien <a@b.com>"
espera_ok "acepta mensajes de merge de git" git commit -q --allow-empty -m "Merge branch 'main' into prueba"

echo "pre-push"
espera_bloqueo "bloquea push directo a main" git push -q origin HEAD:main
espera_ok "permite push de una rama" git push -q origin prueba

echo "modo solo local (push solo con autorización de Diego)"
git config arnes.soloLocal true
git commit -q --allow-empty -m "feat(reportes): trabajo local"
espera_bloqueo "bloquea push sin autorización" git push -q origin prueba
out="$(bash scripts/guardar.sh "feat(reportes): otro cambio" 2>&1)"; r=$?
[ $r -eq 0 ] && echo "$out" | grep -q "solo en tu compu" && ok "guardar.sh hace commit y no sube" || mal "guardar.sh hace commit y no sube" "$out"
espera_ok "permite push con PUSH_AUTORIZADO=1" env PUSH_AUTORIZADO=1 git push -q origin prueba
git config --unset arnes.soloLocal

echo "pre-commit secretos"
# Llaves falsas armadas por partes: así este archivo no trae el patrón literal y se puede subir.
JWT_FALSO="ey""JhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abc"
SUFIJO_KEY="_KEY"; SECRET="secret_"; LIVE="live_"
# intenta_commit archivo contenido → deja el índice limpio al final
intenta_commit() {
  printf '%s\n' "$2" > "$1"
  git add -f "$1"
  git commit -q -m "chore(prueba): archivo"
  local r=$?
  if [ $r -ne 0 ]; then git reset -q HEAD -- "$1"; rm -f "$1"; fi
  return $r
}
espera_bloqueo "bloquea .env" intenta_commit .env "SUPABASE_URL=x"
espera_bloqueo "bloquea .env.local" intenta_commit .env.local "X=1"
espera_bloqueo "bloquea JWT largo (eyJ...)" intenta_commit a.ts "const k = '${JWT_FALSO}'"
espera_bloqueo "bloquea SERVICE_ROLE_KEY con valor" intenta_commit b.txt "SUPABASE_SERVICE_ROLE${SUFIJO_KEY}=abcdefghijklmnopqrstuvwxyz123456"
espera_bloqueo "bloquea llave sb_secret_" intenta_commit c.txt "key: sb_${SECRET}AbCdEfGhIjKlMnOpQr123"
espera_bloqueo "bloquea llave sk_live_" intenta_commit d.txt "stripe = sk_${LIVE}51HxAbCdEfGhIjKl"
espera_ok "permite SQL con 'to service_role'" intenta_commit e.sql "grant select on t to service_role;"
espera_ok "permite .env.example con valores vacíos" intenta_commit .env.example "SUPABASE_SERVICE_ROLE_KEY="

echo "nueva-tarea.sh"
git checkout -q main
espera_ok "crea rama desde main" bash scripts/nueva-tarea.sh F1-T3 reportes y confirmaciones
[ "$(git branch --show-current)" = "feat/f1-t3-reportes-y-confirmaciones" ] \
  && ok "nombre feat/f1-t3-reportes-y-confirmaciones" \
  || mal "nombre de rama" "$(git branch --show-current)"
git checkout -q main
espera_ok "acepta -t fix" bash scripts/nueva-tarea.sh -t fix F2-T1 limites
[ "$(git branch --show-current)" = "fix/f2-t1-limites" ] && ok "nombre fix/f2-t1-limites" || mal "nombre fix" "$(git branch --show-current)"
git checkout -q main
espera_bloqueo "rechaza tarea que no está en PLAN.md" bash scripts/nueva-tarea.sh F9-T9 nada
espera_bloqueo "rechaza si hay cambios sin guardar" sh -c 'echo x > sucio.txt && bash scripts/nueva-tarea.sh F1-T1 base'
rm -f sucio.txt

echo "guardar.sh"
git checkout -q feat/f1-t3-reportes-y-confirmaciones
echo "-- prueba" > supabase/migrations/0001_prueba.sql
espera_bloqueo "rechaza mensaje sin formato" bash scripts/guardar.sh "agregué cosas"
espera_ok "commit + push con mensaje válido" bash scripts/guardar.sh "feat(reportes): migración de prueba"
git ls-remote --exit-code origin feat/f1-t3-reportes-y-confirmaciones >/dev/null \
  && ok "la rama quedó en el remoto" || mal "la rama quedó en el remoto"
git checkout -q main
espera_bloqueo "rechaza correr en main" bash scripts/guardar.sh "feat(x): algo"

echo "sync.sh"
# Simula que el compañero subió algo a main.
git clone -q "$TMP/remoto.git" "$TMP/otro"
(cd "$TMP/otro" && git config core.hooksPath /dev/null && echo nuevo > nuevo.txt \
  && git add nuevo.txt && git commit -q -m "chore(x): nuevo" && git push -q origin main)
git checkout -q feat/f1-t3-reportes-y-confirmaciones
espera_ok "corre sin error en una rama" bash scripts/sync.sh
[ -f nuevo.txt ] && ok "integra lo nuevo de main en la rama" || mal "integra lo nuevo de main en la rama"

echo "cerrar-tarea.sh"
: > "$GH_LOG"
espera_ok "corre sin error" bash scripts/cerrar-tarea.sh
grep -q "pr create" "$GH_LOG" && grep -q -- "--base main" "$GH_LOG" \
  && ok "abre PR contra main" || mal "abre PR contra main" "$(cat "$GH_LOG")"
sed -n '1,12p' PROGRESO.md | grep -q "F1-T3" && sed -n '1,14p' PROGRESO.md | grep -q "pull/7" \
  && ok "agrega entrada arriba en PROGRESO.md con el PR" || mal "entrada en PROGRESO.md" "$(sed -n '1,14p' PROGRESO.md)"
[ -z "$(git status --porcelain)" ] && ok "deja todo guardado y subido" || mal "deja todo guardado" "$(git status --short)"

echo "estado.sh"
out="$(bash scripts/estado.sh 2>&1)"
echo "$out" | grep -q "Fase actual" && ok "muestra la fase" || mal "muestra la fase" "$out"
echo "$out" | grep -q "PR-DE-PRUEBA" && ok "muestra PR abiertos" || mal "muestra PR abiertos" "$out"
echo "$out" | grep -q "Prueba" && ok "muestra commits por persona" || mal "commits por persona" "$out"

echo "invitar.sh"
espera_bloqueo "pide el usuario" bash scripts/invitar.sh
: > "$GH_LOG"
espera_ok "invita con gh api" bash scripts/invitar.sh compa123 --si
grep -q "collaborators/compa123" "$GH_LOG" && ok "llama a collaborators/<usuario>" || mal "llamada a gh api" "$(cat "$GH_LOG")"

echo "ci-revisar.sh (lo que el CI revisa aunque se salten los hooks)"
git checkout -q main
git checkout -q -b ci-limpia
git commit -q --allow-empty -m "feat(reportes): todo bien"
espera_ok "acepta una rama limpia" bash scripts/ci-revisar.sh main
git checkout -q main && git checkout -q -b ci-mensaje
git commit -q --no-verify --allow-empty -m "arreglos"
espera_bloqueo "detecta commit con mensaje inválido hecho con --no-verify" bash scripts/ci-revisar.sh main
git checkout -q main && git checkout -q -b ci-coautor
git commit -q --no-verify --allow-empty -m "feat(x): algo

Co-Authored-By: Alguien <a@b.com>"
espera_bloqueo "detecta trailer de co-autor" bash scripts/ci-revisar.sh main
git checkout -q main && git checkout -q -b ci-llave
printf 'k=%s\n' "$JWT_FALSO" > llave.txt && git add llave.txt && git commit -q --no-verify -m "feat(x): llave"
espera_bloqueo "detecta llave subida con --no-verify" bash scripts/ci-revisar.sh main
git checkout -q main && git checkout -q -b ci-env
echo "A=1" > .env.produccion && git add -f .env.produccion && git commit -q --no-verify -m "chore(x): env"
espera_bloqueo "detecta .env subido con --no-verify" bash scripts/ci-revisar.sh main
git checkout -q main

echo
echo "Resultado: $PASAN pasan, $FALLAN fallan"
[ "$FALLAN" -eq 0 ]
