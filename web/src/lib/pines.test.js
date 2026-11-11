import { describe, it, expect } from 'vitest'
import { nivelPin, htmlPin, etiquetaPin } from './pines.js'

describe('pines de reporte en la calle', () => {
  it('el nivel sale de la altura del agua (gravedad) o, si no hay, del nivel publicado', () => {
    expect(nivelPin({ nivel: 'alto' })).toBe('alto')
    expect(nivelPin({ nivel: 'bajo', gravedad: 'bloqueado' })).toBe('alto') // D-029: manda la altura del agua
    expect(nivelPin({ gravedad: 'limitado' })).toBe('medio')
    expect(nivelPin({ gravedad: 'bloqueado' })).toBe('alto')
    expect(nivelPin({})).toBe('bajo')
    expect(nivelPin({ tipo: 'persona_en_riesgo', nivel: 'alto' })).toBe('riesgo')
  })
  it('el html lleva el ícono, la clase de nivel y marca las simulaciones', () => {
    const h = htmlPin({ tipo: 'casa', gravedad: 'limitado' }, '<svg id="i"></svg>')
    expect(h).toContain('<svg id="i"></svg>')
    expect(h).toContain('pin--medio')
    expect(h).not.toContain('pin--sim')
    expect(htmlPin({ tipo: 'calle', simulada: true }, '')).toContain('pin--sim')
  })
  it('etiqueta accesible con tipo y nivel', () => {
    expect(etiquetaPin({ tipo: 'coche', gravedad: 'bloqueado' })).toBe('Coche atrapado · riesgo alto')
    expect(etiquetaPin({ tipo: 'persona_en_riesgo' })).toBe('Persona en riesgo')
    expect(etiquetaPin({ tipo: 'calle', simulada: true })).toBe('Simulación · Calle inundada · riesgo bajo')
  })
})
