// Vibración al tocar (Android: navigator.vibrate). Safari de iPhone no la permite en páginas web.
// Viene activada; se apaga en Accesibilidad (prefs.vibra === false) y se guarda en el perfil (D-027).
export const vibracionActiva = (prefs) => prefs?.vibra !== false

export function vibrar(prefs, patron = 10, nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  if (!vibracionActiva(prefs) || typeof nav?.vibrate !== 'function') return false
  try { return !!nav.vibrate(patron) } catch { return false }
}

const TOCABLES = 'button, a[href], [role=switch], [role=button], [role=tab], input[type=checkbox], input[type=radio], summary'
export function esTocable(target) {
  const el = target?.closest?.(TOCABLES)
  return !!el && !el.disabled && el.getAttribute?.('aria-disabled') !== 'true'
}

// Al activar "Leer en voz alta" la app habla para que se escuche cómo suena.
export const FRASE_VOZ = 'Activaste la opción de leer en voz alta. Esta es la voz que te va a avisar de las inundaciones cerca de ti.'
