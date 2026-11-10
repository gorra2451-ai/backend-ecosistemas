import { describe, it, expect } from 'vitest'
import { cambiosParaVoz, fraseEstado, metrosVoz, RADIO_VOZ_M } from './vozAlertas.js'

const TU = { lat: 20.6497, lng: -103.4016 }
const norte = (m) => ({ lat: TU.lat + m / 111195, lng: TU.lng }) // ~m metros al norte
const zona = (celda, nivel, m, extra = {}) => ({ celda, nivel, ...norte(m), total_reportes: 1, ...extra })

describe('metrosVoz', () => {
  it('redondea a decenas y lo dice en palabras', () => {
    expect(metrosVoz(398)).toBe('400 metros')
    expect(metrosVoz(3)).toBe('10 metros')
    expect(metrosVoz(1450)).toBe('1.4 kilómetros')
  })
})

describe('cambiosParaVoz', () => {
  it('primera carga (anteriores = null) no habla', () => {
    expect(cambiosParaVoz(null, [zona('a', 'alto', 100)], TU, 400)).toEqual([])
  })

  it('zona nueva dentro del radio → una frase con nivel y distancia', () => {
    expect(cambiosParaVoz([], [zona('a', 'medio', 398)], TU, 400))
      .toEqual(['Nueva zona inundada, nivel medio, a 400 metros.'])
  })

  it('zona nueva fuera del radio no se lee', () => {
    expect(cambiosParaVoz([], [zona('a', 'alto', 900)], TU, 400)).toEqual([])
  })

  it('lo que no cambió no se repite', () => {
    const z = [zona('a', 'medio', 100)]
    expect(cambiosParaVoz(z, z, TU, 400)).toEqual([])
  })

  it('una zona que sube de nivel se lee; si baja, no', () => {
    expect(cambiosParaVoz([zona('a', 'medio', 200)], [zona('a', 'critico', 200)], TU, 400))
      .toEqual(['Zona inundada subió a nivel crítico, a 200 metros.'])
    expect(cambiosParaVoz([zona('a', 'alto', 200)], [zona('a', 'bajo', 200)], TU, 400)).toEqual([])
  })

  it('reconoce el nivel con acento (crítico) igual que nivelV2', () => {
    expect(cambiosParaVoz([zona('a', 'alto', 50)], [zona('a', 'crítico', 50)], TU, 400))
      .toEqual(['Zona inundada subió a nivel crítico, a 50 metros.'])
  })

  it('ordena por cercanía y lee máximo 2; el resto como "y N zonas más"', () => {
    const act = [zona('a', 'bajo', 350), zona('b', 'alto', 100), zona('c', 'medio', 200), zona('d', 'bajo', 300)]
    expect(cambiosParaVoz([], act, TU, 400)).toEqual([
      'Nueva zona inundada, nivel alto, a 100 metros.',
      'Nueva zona inundada, nivel medio, a 200 metros; y 2 zonas más.',
    ])
  })

  it('"y 1 zona más" en singular', () => {
    const act = [zona('a', 'bajo', 100), zona('b', 'bajo', 200), zona('c', 'bajo', 300)]
    expect(cambiosParaVoz([], act, TU, 400)[1]).toMatch(/; y 1 zona más\.$/)
  })

  it('sin ubicación no habla', () => {
    expect(cambiosParaVoz([], [zona('a', 'alto', 10)], null, 400)).toEqual([])
  })

  it('el radio por defecto es RADIO_VOZ_M', () => {
    expect(RADIO_VOZ_M).toBeGreaterThan(0)
    expect(cambiosParaVoz([], [zona('a', 'medio', RADIO_VOZ_M - 20)], TU)).toHaveLength(1)
    expect(cambiosParaVoz([], [zona('a', 'medio', RADIO_VOZ_M + 50)], TU)).toEqual([])
  })
})

describe('fraseEstado (botón Escuchar)', () => {
  it('sin zonas: dice que tu zona está sin reportes', () => {
    expect(fraseEstado({ zonas: [], ubic: TU, municipio: 'Zapopan' })).toBe('Tu zona: sin reportes. Zapopan.')
  })

  it('con zona grave cerca: frase y aviso de no cruzar, con unidades en palabras', () => {
    const f = fraseEstado({ zonas: [zona('a', 'alto', 120)], ubic: TU, municipio: 'Zapopan' })
    expect(f).toBe('1 calle inundada a 300 metros. No cruces: zona Alto a 120 metros.')
  })

  it('sin ubicación ni municipio no truena', () => {
    expect(fraseEstado({ zonas: [], ubic: null })).toBe('Tu zona: sin reportes.')
  })
})
