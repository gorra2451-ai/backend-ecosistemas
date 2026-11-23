import { describe, it, expect } from 'vitest'
import { htmlDestino, escaparHtml, nombreCorto } from './destino.js'

describe('pin del destino con su nombre', () => {
  it('lleva el nombre corto del lugar', () => {
    expect(nombreCorto('Glorieta Minerva, Vallarta, Guadalajara')).toBe('Glorieta Minerva')
    expect(htmlDestino('Glorieta Minerva, Guadalajara')).toContain('>Glorieta Minerva</div>')
  })
  it('escapa el texto de OpenStreetMap', () => {
    expect(escaparHtml('<img onerror="x">')).toBe('&lt;img onerror=&quot;x&quot;&gt;')
    expect(htmlDestino('<b>x</b>')).not.toContain('<b>')
  })
  it('nombres largos se recortan y sin nombre dice "Destino"', () => {
    expect(nombreCorto('a'.repeat(40))).toHaveLength(28)
    expect(htmlDestino('')).toContain('>Destino</div>')
  })
  it('alto contraste: etiqueta blanca con texto oscuro (no negro sobre negro)', () => {
    expect(htmlDestino('X')).toMatch(/background:#fff;color:#05080F/)
  })
})
