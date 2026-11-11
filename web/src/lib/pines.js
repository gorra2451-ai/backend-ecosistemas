// Pines de reporte "en la calle" (D-028): cada reporte activo se ve en su punto exacto con el ícono de su tipo
// y el color/patrón de su nivel. Reemplaza los cuadros de 300 m del mapa (siguen en la lista y en "Tu zona").
import { GRAVEDAD, TIPO_LARGO } from './reportar.js'

const NIVELES = ['bajo', 'medio', 'alto', 'critico']
export function nivelPin(r) {
  if (r?.tipo === 'persona_en_riesgo') return 'riesgo'
  if (NIVELES.includes(r?.nivel)) return r.nivel
  return GRAVEDAD.find((g) => g.k === r?.gravedad)?.nivel || 'bajo'
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
export function etiquetaPin(r) {
  const n = nivelPin(r)
  const base = n === 'riesgo' ? 'Persona en riesgo' : `${TIPO_LARGO[r?.tipo] || 'Reporte'} · riesgo ${n === 'critico' ? 'crítico' : n}`
  return (r?.simulada ? 'Simulación · ' : '') + base
}

// svgIcono: el <svg> del tipo ya convertido a texto (MapView lo arma con Icon.jsx).
export function htmlPin(r, svgIcono) {
  const n = nivelPin(r)
  return `<div class="pin pin--${n}${r?.simulada ? ' pin--sim' : ''}" role="img" aria-label="${esc(etiquetaPin(r))}">`
    + `<span class="pin-cab p-${n === 'riesgo' ? 'riesgo' : n}">${svgIcono}</span><span class="pin-pico"></span></div>`
}
