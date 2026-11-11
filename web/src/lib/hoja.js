// Hoja inferior del mapa: se arrastra con el dedo (feedback del humo en celular, 2026-11-11).
// full = mapa libre (solo Reportar) · min = asa + alerta más cercana + Reportar · mid = lista completa.
import { useRef } from 'react'

export const UMBRAL_ARRASTRE = 36 // px: menos que esto es un toque, no un arrastre
const ORDEN = ['full', 'min', 'mid'] // de más mapa a más lista

export function siguienteHoja(estado, dy) {
  const i = ORDEN.indexOf(estado)
  if (i < 0 || Math.abs(dy) < UMBRAL_ARRASTRE) return null
  return ORDEN[Math.max(0, Math.min(ORDEN.length - 1, i + (dy < 0 ? 1 : -1)))]
}

// Handlers de pointer para la zona arrastrable. El "soltar" se escucha en window: si el dedo termina
// fuera de la hoja (lo normal al bajarla), igual cuenta. Si hubo arrastre, se traga el click que sigue
// (para que soltar el dedo sobre un botón no lo active).
export function useArrastreHoja(estado, setEstado) {
  const arrastro = useRef(false)
  const actual = useRef(estado)
  actual.current = estado
  return {
    onPointerDown: (e) => {
      const y0 = e.clientY
      arrastro.current = false
      const fin = (ev) => {
        window.removeEventListener('pointerup', fin)
        window.removeEventListener('pointercancel', cancelar)
        const sig = siguienteHoja(actual.current, ev.clientY - y0)
        if (sig) { arrastro.current = true; if (sig !== actual.current) setEstado(sig) }
      }
      const cancelar = () => {
        window.removeEventListener('pointerup', fin)
        window.removeEventListener('pointercancel', cancelar)
      }
      window.addEventListener('pointerup', fin)
      window.addEventListener('pointercancel', cancelar)
    },
    onClickCapture: (e) => { if (arrastro.current) { e.stopPropagation(); e.preventDefault(); arrastro.current = false } },
  }
}
