# Tests aislados: fetch simulado, sin notificaciones externas.
$ErrorActionPreference = 'Stop'
deno test --allow-env --no-config --node-modules-dir=none `
  --lock=supabase/functions/deno.lock --frozen `
  supabase/functions/revision_test.ts supabase/functions/enviar-push/webpush_test.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
