import { describe, it, expect } from 'vitest'
import { siguienteHoja, UMBRAL_ARRASTRE } from './hoja.js'

describe('siguienteHoja (arrastrar la hoja del mapa con el dedo)', () => {
  it('arrastrar hacia arriba la abre un nivel', () => {
    expect(siguienteHoja('full', -80)).toBe('min')
    expect(siguienteHoja('min', -80)).toBe('mid')
    expect(siguienteHoja('mid', -80)).toBe('mid')
  })
  it('arrastrar hacia abajo la baja un nivel hasta dejar el mapa libre', () => {
    expect(siguienteHoja('mid', 80)).toBe('min')
    expect(siguienteHoja('min', 80)).toBe('full')
    expect(siguienteHoja('full', 80)).toBe('full')
  })
  it('un movimiento corto no cuenta como arrastre', () => {
    expect(siguienteHoja('min', UMBRAL_ARRASTRE - 1)).toBe(null)
    expect(siguienteHoja('min', -(UMBRAL_ARRASTRE - 1))).toBe(null)
  })
  it('estado desconocido (hoja de enviado) no cambia', () => {
    expect(siguienteHoja('sent', 120)).toBe(null)
  })
})
