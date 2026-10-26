# Prueba HTTP local de suscripción y baja Web Push, sin enviar notificaciones.
$ErrorActionPreference = 'Stop'
$env:SUPABASE_TELEMETRY_DISABLED = '1'
$estado = supabase status --output json 2>$null | ConvertFrom-Json
$api = $estado.API_URL.TrimEnd('/')
$key = $estado.PUBLISHABLE_KEY
$sesion = Invoke-RestMethod -Method Post -Uri "$api/auth/v1/signup" `
  -Headers @{ apikey = $key } -ContentType 'application/json' -Body '{"data":{}}'
$headers = @{ apikey = $key; Authorization = "Bearer $($sesion.access_token)" }
$endpoint = "https://fcm.googleapis.com/fcm/send/$([guid]::NewGuid())"
$datos = @{ p_endpoint = $endpoint; p_p256dh = ('A' * 87);
  p_auth = ('B' * 22); p_municipio = 'Guadalajara' } | ConvertTo-Json -Compress
$id = Invoke-RestMethod -Method Post -Uri "$api/rest/v1/rpc/suscribir_push" `
  -Headers $headers -ContentType 'application/json' -Body $datos
if ($id -notmatch '^[0-9a-f-]{36}$') { throw 'No se creó la suscripción.' }

$lecturaBloqueada = $false
try {
  Invoke-WebRequest -Method Get -Uri "$api/rest/v1/suscripciones_push?select=*" `
    -Headers $headers | Out-Null
} catch {
  $lecturaBloqueada = $_.Exception.Response.StatusCode -eq 403
}
if (-not $lecturaBloqueada) { throw 'El usuario pudo leer claves de push directamente.' }

$servicio = @{ apikey = $estado.SECRET_KEY }
$filas = Invoke-RestMethod -Method Get `
  -Uri "$api/rest/v1/suscripciones_push?id=eq.$id&select=id,municipio" -Headers $servicio
if (@($filas).Count -ne 1 -or $filas[0].municipio -ne 'guadalajara') {
  throw 'El servicio no encontró la suscripción.'
}
$baja = Invoke-RestMethod -Method Post -Uri "$api/rest/v1/rpc/baja_push" `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ p_endpoint = $endpoint } | ConvertTo-Json -Compress)
if ($baja -ne $true) { throw 'No se dio de baja el dispositivo.' }
Write-Output 'OK: alta por RPC, claves ocultas al cliente, lectura de servicio y baja.'
