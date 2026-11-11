import { describe, it, expect, vi } from 'vitest'
import { vibracionActiva, vibrar, esTocable, FRASE_VOZ } from './haptica.js'

describe('háptica (vibración al tocar, se puede apagar)', () => {
  it('viene activada si nunca se tocó la opción', () => {
    expect(vibracionActiva({})).toBe(true)
    expect(vibracionActiva(undefined)).toBe(true)
    expect(vibracionActiva({ vibra: false })).toBe(false)
  })
  it('vibra solo si está activa y el navegador puede', () => {
    const nav = { vibrate: vi.fn(() => true) }
    expect(vibrar({}, 10, nav)).toBe(true)
    expect(nav.vibrate).toHaveBeenCalledWith(10)
    expect(vibrar({ vibra: false }, 10, nav)).toBe(false)
    expect(vibrar({}, 10, {}, undefined)).toBe(false) // sin vibrate ni documento
  })
  it('reconoce botones, enlaces e interruptores (y no los deshabilitados)', () => {
    const el = (tag, attrs = {}) => ({ closest: (sel) => (sel === '[data-haptica]' ? null : sel.split(',').some((s) => s.trim().startsWith(tag)) ? { tag, ...attrs } : null) })
    expect(esTocable(el('button'))).toBe(true)
    expect(esTocable(el('button', { disabled: true }))).toBe(false)
    expect(esTocable({ closest: () => null })).toBe(false)
    expect(esTocable(null)).toBe(false)
  })
  it('la frase de muestra de la voz dice que se activó', () => {
    expect(FRASE_VOZ).toMatch(/activaste/i)
  })
})

describe('tic háptico de iPhone', () => {
  it('sin navigator.vibrate da click a un interruptor oculto (una sola vez creado)', () => {
    const clicks = []
    const hijos = []
    const doc = {
      body: { appendChild: (n) => hijos.push(n) },
      createElement: (t) => ({ tagName: t, dataset: {}, style: {}, setAttribute() {}, appendChild() {}, click() { clicks.push(t) } }),
    }
    expect(vibrar({}, 10, {}, doc)).toBe(true)
    expect(vibrar({}, 10, {}, doc)).toBe(true)
    expect(hijos).toHaveLength(1)
    expect(clicks).toEqual(['label', 'label'])
    expect(vibrar({ vibra: false }, 10, {}, doc)).toBe(false)
  })
  it('el interruptor oculto no cuenta como toque (no se vuelve un ciclo)', () => {
    expect(esTocable({ closest: (s) => (s === '[data-haptica]' ? {} : { tag: 'input' }) })).toBe(false)
  })
})
