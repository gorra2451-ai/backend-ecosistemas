# Contrato HTTP local cuando aún no hay instituciones ni refugios verificados.
$ErrorActionPreference = 'Stop'
$env:SUPABASE_TELEMETRY_DISABLED = '1'
$estado = supabase status --output json 2>$null | ConvertFrom-Json
$api = $estado.API_URL.TrimEnd('/')
$headers = @{ apikey = $estado.PUBLISHABLE_KEY }
$body = @{ p_caso = 'casa'; p_municipio = 'Guadalajara';
  p_lat = 20.6597; p_lng = -103.3496 } | ConvertTo-Json -Compress
$resultado = Invoke-RestMethod -Uri "$api/rest/v1/rpc/derivar" -Method Post `
  -Headers $headers -ContentType 'application/json' -Body $body
if (@($resultado.instituciones).Count -ne 0 -or @($resultado.refugios).Count -ne 0 `
  -or @($resultado.pasos).Count -eq 0) {
  throw 'La derivación vacía devolvió datos no verificados o no orientó.'
}
$instituciones = Invoke-WebRequest -Uri `
  "$api/rest/v1/instituciones_publicas?select=id" -Headers $headers
$clima = Invoke-WebRequest -Uri `
  "$api/rest/v1/alertas_clima_vigentes?select=id" -Headers $headers
if ($instituciones.Content.Trim() -ne '[]' -or $clima.Content.Trim() -ne '[]') {
  throw 'Hay fichas publicadas sin fuentes aprobadas.'
}
Write-Output 'OK: derivación HTTP orienta sin inventar instituciones, refugios ni clima.'
