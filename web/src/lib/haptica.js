// Vibración al tocar. Android: navigator.vibrate. iPhone (Safari 18+): tic háptico con un interruptor oculto.
// Viene activada; se apaga en Accesibilidad (prefs.vibra === false) y se guarda en el perfil (D-027).
export const vibracionActiva = (prefs) => prefs?.vibra !== false

// iPhone (Safari 18+): no hay navigator.vibrate, pero tocar un <input type=checkbox switch> da un "tic" háptico.
// Se usa un interruptor oculto y se le da click DENTRO del toque del usuario (fuera de un gesto no vibra).
let interruptor = null
function ticIOS(doc) {
  if (!doc?.body) return false
  if (!interruptor) {
    interruptor = doc.createElement('label')
    interruptor.setAttribute('aria-hidden', 'true')
    interruptor.dataset.haptica = '1'
    interruptor.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none'
    const i = doc.createElement('input')
    i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1
    interruptor.appendChild(i)
    doc.body.appendChild(interruptor)
  }
  try { interruptor.click(); return true } catch { return false }
}

export function vibrar(prefs, patron = 10, nav = typeof navigator !== 'undefined' ? navigator : undefined,
  doc = typeof document !== 'undefined' ? document : undefined) {
  if (!vibracionActiva(prefs)) return false
  if (typeof nav?.vibrate === 'function') { try { return !!nav.vibrate(patron) } catch { return false } }
  return ticIOS(doc)
}

const TOCABLES = 'button, a[href], [role=switch], [role=button], [role=tab], input[type=checkbox], input[type=radio], summary'
export function esTocable(target) {
  if (target?.closest?.('[data-haptica]')) return false // el interruptor oculto del tic de iPhone
  const el = target?.closest?.(TOCABLES)
  return !!el && !el.disabled && el.getAttribute?.('aria-disabled') !== 'true'
}

// Al activar "Leer en voz alta" la app habla para que se escuche cómo suena.
export const FRASE_VOZ = 'Activaste la opción de leer en voz alta. Esta es la voz que te va a avisar de las inundaciones cerca de ti.'
