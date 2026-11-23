import { describe, it, expect } from 'vitest'
import { normalizar, resolverAlias, ALIAS } from './alias.js'

describe('apodos de la ZMG → nombre oficial (testeo: 16 de 20 sin resultados con "la Mine")', () => {
  it('normaliza sin acentos, mayúsculas ni signos', () => {
    expect(normalizar('  La   MINÉ!! ')).toBe('la mine')
    expect(normalizar('Glorieta  Minerva,')).toBe('glorieta minerva')
  })
  it('"la Mine" y variantes van a la Glorieta Minerva', () => {
    for (const q of ['la Mine', 'mine', 'LA MINERVA', 'la minérva', 'Minerva', 'la mine ']) {
      expect(resolverAlias(q)).toBe('Glorieta Minerva, Guadalajara')
    }
  })
  it('otros apodos conocidos', () => {
    expect(resolverAlias('los arcos')).toBe('Los Arcos, Guadalajara')
    expect(resolverAlias('La Estampida')).toBe('La Estampida, Zapopan')
    expect(resolverAlias('parque rojo')).toBe('Parque Revolución, Guadalajara')
  })
  it('lo que no es apodo pasa tal cual (recortado)', () => {
    expect(resolverAlias('  Plaza del Sol ')).toBe('Plaza del Sol')
    expect(resolverAlias('Av. Vallarta 1200')).toBe('Av. Vallarta 1200')
    expect(resolverAlias('minerva 2')).toBe('minerva 2') // solo coincidencia completa
  })
  it('todas las llaves del diccionario ya vienen normalizadas', () => {
    for (const k of Object.keys(ALIAS)) expect(normalizar(k)).toBe(k)
  })
})
