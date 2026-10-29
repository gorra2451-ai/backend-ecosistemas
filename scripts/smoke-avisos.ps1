# Recorrido local: reporte activo -> cola -> trabajador -> reintento.
# El endpoint de prueba está fuera de los proveedores permitidos: no sale ningún push.
$ErrorActionPreference = 'Stop'
$env:SUPABASE_TELEMETRY_DISABLED = '1'
$estado = supabase status --output json 2>$null | ConvertFrom-Json
$api = $estado.API_URL.TrimEnd('/')
$publica = $estado.PUBLISHABLE_KEY
$servicio = @{ apikey = $estado.SECRET_KEY }
$trabajador = "$api/functions/v1/procesar-avisos"

$sinClave = Invoke-WebRequest -Uri $trabajador -Method Post -Body '{}' `
  -ContentType 'application/json' -SkipHttpErrorCheck
if ($sinClave.StatusCode -ne 401) { throw 'El trabajador aceptó una solicitud sin clave.' }

$celda = (docker exec supabase_db_backend_ecosistemas psql -U postgres -tAc `
  "select public.celda_mapa(public.punto(20.94, -103.60))").Trim()
if ($celda -notmatch '^\d+_\d+$') { throw 'No se obtuvo la celda local.' }
$sesion = Invoke-RestMethod -Uri "$api/auth/v1/signup" -Method Post `
  -Headers @{ apikey = $publica } -ContentType 'application/json' -Body '{"data":{}}'
$usuario = @{ apikey = $publica; Authorization = "Bearer $($sesion.access_token)" }
$endpoint = "https://push.example.test/$([guid]::NewGuid())"
$suscripcion = Invoke-RestMethod -Uri "$api/rest/v1/rpc/suscribir_push" -Method Post `
  -Headers $usuario -ContentType 'application/json' `
  -Body (@{ p_endpoint = $endpoint; p_p256dh = ('A' * 87); p_auth = ('B' * 22);
    p_celda = $celda; p_municipio = $null } | ConvertTo-Json -Compress)
$reporteId = [guid]::NewGuid().ToString()
$reporte = Invoke-RestMethod -Uri "$api/rest/v1/rpc/crear_reporte" -Method Post `
  -Headers $usuario -ContentType 'application/json' `
  -Body (@{ p_id = $reporteId; p_tipo = 'persona_en_riesgo'; p_pasan_carros = $false;
    p_lat = 20.94; p_lng = -103.60; p_precision_m = 20 } | ConvertTo-Json -Compress)
if ($reporte.estado -ne 'activo') { throw 'El reporte no activó la zona.' }
$filtro = "?suscripcion_id=eq.$suscripcion&select=id,estado,intentos"
$cola = @(Invoke-RestMethod -Uri "$api/rest/v1/avisos_push$filtro" -Headers $servicio)
if ($cola.Count -ne 1 -or $cola[0].estado -ne 'pendiente') {
  throw 'No se encoló un aviso para la celda.'
}
$respuesta = Invoke-RestMethod -Uri $trabajador -Method Post -Headers $servicio `
  -Body '{}' -ContentType 'application/json'
if ($respuesta.procesados -ne 1 -or $respuesta.reintentos -ne 1 -or $respuesta.enviados -ne 0) {
  throw 'El trabajador no registró el reintento esperado.'
}
$cola = @(Invoke-RestMethod -Uri "$api/rest/v1/avisos_push$filtro" -Headers $servicio)
if ($cola.Count -ne 1 -or $cola[0].estado -ne 'pendiente' -or $cola[0].intentos -ne 1) {
  throw 'El aviso no quedó pendiente con un intento.'
}
Write-Output 'OK: alta por celda, evento, cola privada, trabajador y reintento local.'
