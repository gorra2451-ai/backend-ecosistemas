import { describe, it, expect } from 'vitest'
import { codigoError, mensajeError, nivelDeZona, bboxAlrededor } from './api.js'

describe('codigoError', () => {
  it('saca el código del mensaje de Postgres', () => {
    expect(codigoError({ message: 'fuera_de_zmg' })).toBe('fuera_de_zmg')
    expect(codigoError({ message: 'ERROR: limite_por_hora' })).toBe('limite_por_hora')
  })
  it('sin red o desconocido', () => {
    expect(codigoError({ message: 'Failed to fetch' })).toBe('sin_red')
    expect(codigoError({ message: 'algo raro' })).toBe('desconocido')
    expect(codigoError(null)).toBe(null)
  })
})

describe('mensajeError', () => {
  it('tiene copy del design system para los errores del contrato', () => {
    expect(mensajeError('fuera_de_zmg').titulo).toBe('Este punto está fuera de la ZMG')
    expect(mensajeError('limite_por_hora').titulo).toBe('Ya enviaste varios reportes esta hora')
    expect(mensajeError('duplicado_cercano').titulo).toBe('Ya reportaste este punto')
    expect(mensajeError('xyz').titulo).toBeTruthy()
  })
})

describe('nivelDeZona', () => {
  it('normaliza el nivel de zonas_publicas', () => {
    expect(nivelDeZona({ nivel: 'alto' })).toBe('alto')
    expect(nivelDeZona({ nivel: 'MEDIO' })).toBe('medio')
    expect(nivelDeZona({ nivel: 'critico' })).toBe('critico')
    expect(nivelDeZona({ nivel: null })).toBe('bajo')
  })
})

describe('bboxAlrededor', () => {
  it('arma un área válida para reportes_activos_en_area', () => {
    const b = bboxAlrededor(20.67, -103.35, 2000)
    expect(b.min_lat).toBeLessThan(b.max_lat)
    expect(b.min_lng).toBeLessThan(b.max_lng)
    expect(b.max_lat - b.min_lat).toBeCloseTo(0.036, 2)
  })
})
