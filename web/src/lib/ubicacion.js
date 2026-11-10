// Pide la posición con un límite propio: el `timeout` del navegador no corre mientras el aviso de
// permiso sigue abierto, y si la persona lo ignora la pantalla se quedaba en "Buscando…" para siempre.
export const LIMITE_GPS_MS = 12000 // solo front · POR CONFIRMAR con los equipos

export function pedirPosicion(geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined, ms = LIMITE_GPS_MS) {
  return new Promise((res) => {
    if (!geo) return res(null)
    let listo = false
    const fin = (v) => { if (!listo) { listo = true; clearTimeout(t); res(v) } }
    const t = setTimeout(() => fin(null), ms)
    geo.getCurrentPosition(
      (p) => fin({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy, real: true }),
      () => fin(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 })
  })
}

// Al recargar la app nadie pedía la ubicación y "Tu zona" se calculaba desde el punto de ejemplo.
// Solo se pide sola si el permiso ya se dio antes (así no aparece el aviso del navegador sin contexto).
export async function permisoConcedido(perms = typeof navigator !== 'undefined' ? navigator.permissions : undefined) {
  try { return !!perms && (await perms.query({ name: 'geolocation' })).state === 'granted' } catch { return false }
}
