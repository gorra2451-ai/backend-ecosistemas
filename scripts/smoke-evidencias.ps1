# Prueba HTTP local de Auth anónima, Storage y agregar_evidencia.
# No imprime llaves ni tokens; crea solo datos de prueba en Supabase local.
$ErrorActionPreference = 'Stop'
$env:SUPABASE_TELEMETRY_DISABLED = '1'

$estado = supabase status --output json 2>$null | ConvertFrom-Json
if (-not $estado.API_URL -or -not $estado.PUBLISHABLE_KEY) {
  throw 'Supabase local no está disponible.'
}
$api = $estado.API_URL.TrimEnd('/')
$key = $estado.PUBLISHABLE_KEY

function Crear-Sesion {
  $sesion = Invoke-RestMethod -Method Post -Uri "$api/auth/v1/signup" `
    -Headers @{ apikey = $key } -ContentType 'application/json' -Body '{"data":{}}'
  if (-not $sesion.access_token) { throw 'Auth no devolvió sesión anónima.' }
  return $sesion.access_token
}

$token = Crear-Sesion
$otroToken = Crear-Sesion
$headers = @{ apikey = $key; Authorization = "Bearer $token" }
$otroHeaders = @{ apikey = $key; Authorization = "Bearer $otroToken" }
$reporteId = [guid]::NewGuid().ToString()
$archivoId = [guid]::NewGuid().ToString()
$ruta = "$reporteId/$archivoId.png"
$reporte = Invoke-RestMethod -Method Post -Uri "$api/rest/v1/rpc/crear_reporte" `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ p_id = $reporteId; p_tipo = 'calle'; p_pasan_carros = $false;
      p_lat = 20.95; p_lng = -103.70; p_precision_m = 20 } | ConvertTo-Json -Compress)
if ($reporte.id -ne $reporteId) { throw 'No se creó el reporte propio.' }
if ($reporte.estado -ne 'pendiente') { throw 'El reporte de prueba debía iniciar pendiente.' }

# PNG válido de 1×1 px. Es deliberadamente pequeño y sin ubicación EXIF.
$png = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
$subidaAjenaBloqueada = $false
try {
  Invoke-WebRequest -Method Post -Uri "$api/storage/v1/object/evidencias/$ruta" `
    -Headers $otroHeaders -ContentType 'image/png' -Body $png | Out-Null
} catch {
  $subidaAjenaBloqueada = $_.Exception.Response.StatusCode -in @(400, 401, 403)
}
if (-not $subidaAjenaBloqueada) { throw 'Un usuario ajeno pudo subir al reporte.' }

Invoke-WebRequest -Method Post -Uri "$api/storage/v1/object/evidencias/$ruta" `
  -Headers $headers -ContentType 'image/png' -Body $png | Out-Null
$registrada = Invoke-RestMethod -Method Post -Uri "$api/rest/v1/rpc/agregar_evidencia" `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ p_reporte_id = $reporteId; p_ruta = $ruta; p_tipo = 'foto' } | ConvertTo-Json -Compress)
if ($registrada -notmatch '^[0-9a-f-]{36}$') { throw 'No se registró la evidencia.' }

$filas = Invoke-RestMethod -Method Get -Uri "$api/rest/v1/evidencias?select=id,reporte_id,ruta_storage,tipo&reporte_id=eq.$reporteId" `
  -Headers $headers
if (@($filas).Count -ne 1 -or $filas[0].ruta_storage -ne $ruta) {
  throw 'La evidencia no aparece en la lectura del autor.'
}
$filasAjenas = Invoke-RestMethod -Method Get `
  -Uri "$api/rest/v1/evidencias?select=id&reporte_id=eq.$reporteId" -Headers $otroHeaders
if (@($filasAjenas).Count -ne 0) { throw 'Un tercero pudo leer evidencia pendiente.' }

$reporteActivoId = [guid]::NewGuid().ToString()
$rutaActiva = "$reporteActivoId/$([guid]::NewGuid().ToString()).png"
$activo = Invoke-RestMethod -Method Post -Uri "$api/rest/v1/rpc/crear_reporte" `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ p_id = $reporteActivoId; p_tipo = 'persona_en_riesgo'; p_pasan_carros = $false;
      p_lat = 20.94; p_lng = -103.65; p_precision_m = 20 } | ConvertTo-Json -Compress)
if ($activo.estado -ne 'activo') { throw 'El reporte urgente de prueba debía iniciar activo.' }
Invoke-WebRequest -Method Post -Uri "$api/storage/v1/object/evidencias/$rutaActiva" `
  -Headers $headers -ContentType 'image/png' -Body $png | Out-Null
Invoke-RestMethod -Method Post -Uri "$api/rest/v1/rpc/agregar_evidencia" `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ p_reporte_id = $reporteActivoId; p_ruta = $rutaActiva; p_tipo = 'foto' } | ConvertTo-Json -Compress) | Out-Null
$lecturaAjena = Invoke-WebRequest -Method Get `
  -Uri "$api/storage/v1/object/authenticated/evidencias/$rutaActiva" -Headers $otroHeaders
if ($lecturaAjena.StatusCode -ne 200) { throw 'Un tercero no pudo leer evidencia activa.' }
$anonHeaders = @{ apikey = $key; Authorization = "Bearer $($estado.ANON_KEY)" }
$lecturaPublica = Invoke-WebRequest -Method Get `
  -Uri "$api/storage/v1/object/authenticated/evidencias/$rutaActiva" -Headers $anonHeaders
if ($lecturaPublica.StatusCode -ne 200) { throw 'El público no pudo leer evidencia activa.' }
Write-Output 'OK: Auth anónima, Storage privado, rechazo de subida ajena, RPC y lectura pública solo de evidencia activa.'
