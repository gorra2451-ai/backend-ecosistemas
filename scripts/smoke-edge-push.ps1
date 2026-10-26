# Requiere `supabase functions serve enviar-push` en otra terminal.
# Prueba la función en Supabase local, sin enviar ningún Web Push externo.
$ErrorActionPreference = 'Stop'
$env:SUPABASE_TELEMETRY_DISABLED = '1'
$estado = supabase status --output json 2>$null | ConvertFrom-Json
$api = $estado.API_URL.TrimEnd('/')
$funcion = "$api/functions/v1/enviar-push"
$secreto = @{ apikey = $estado.SECRET_KEY }

$sinClave = Invoke-WebRequest -Uri $funcion -Method Post -Body '{}' `
  -ContentType 'application/json' -SkipHttpErrorCheck
$invalido = Invoke-WebRequest -Uri $funcion -Method Post -Headers $secreto -Body '{}' `
  -ContentType 'application/json' -SkipHttpErrorCheck
$ausente = Invoke-WebRequest -Uri $funcion -Method Post -Headers $secreto `
  -Body '{"suscripcion_id":"10000000-0000-4000-8000-000000000999","titulo":"Prueba","mensaje":"Local"}' `
  -ContentType 'application/json' -SkipHttpErrorCheck
if ($sinClave.StatusCode -ne 401 -or $invalido.StatusCode -ne 400 -or $ausente.StatusCode -ne 404) {
  throw 'Fallaron los controles de autenticación, parámetros o búsqueda de suscripción.'
}

$sesion = Invoke-RestMethod -Uri "$api/auth/v1/signup" -Method Post `
  -Headers @{ apikey = $estado.PUBLISHABLE_KEY } -ContentType 'application/json' `
  -Body '{"data":{}}'
$headers = @{ apikey = $estado.PUBLISHABLE_KEY;
  Authorization = "Bearer $($sesion.access_token)" }
$endpoint = "https://push.example.test/$([guid]::NewGuid())"
try {
  $id = Invoke-RestMethod -Uri "$api/rest/v1/rpc/suscribir_push" -Method Post `
    -Headers $headers -ContentType 'application/json' `
    -Body (@{ p_endpoint = $endpoint; p_p256dh = ('A' * 87);
      p_auth = ('B' * 22); p_municipio = 'Guadalajara' } | ConvertTo-Json -Compress)
  $proveedor = Invoke-WebRequest -Uri $funcion -Method Post -Headers $secreto `
    -Body (@{ suscripcion_id = $id; titulo = 'Prueba'; mensaje = 'Local' } |
      ConvertTo-Json -Compress) -ContentType 'application/json' -SkipHttpErrorCheck
  if ($proveedor.StatusCode -ne 422) { throw 'La función no rechazó un proveedor ajeno.' }
} finally {
  Invoke-RestMethod -Uri "$api/rest/v1/rpc/baja_push" -Method Post -Headers $headers `
    -ContentType 'application/json' `
    -Body (@{ p_endpoint = $endpoint } | ConvertTo-Json -Compress) | Out-Null
}
Write-Output 'OK: Edge Function exige clave de servidor, valida solicitud y bloquea proveedor ajeno.'
