import { describe, it, expect, vi } from 'vitest'
import { codigoError, mensajeError, nivelDeZona, bboxAlrededor, textoBusqueda } from './api.js'

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

describe('errores de evidencia y confirmación (backend PR #14)', () => {
  it('reconoce video_deshabilitado y reporte_no_activo', () => {
    expect(codigoError({ message: 'ERROR: video_deshabilitado' })).toBe('video_deshabilitado')
    expect(codigoError({ message: 'reporte_no_activo' })).toBe('reporte_no_activo')
  })
  it('copy claro para la persona', () => {
    expect(mensajeError('video_deshabilitado').titulo).toBe('Por ahora solo fotos: los videos guardan tu ubicación.')
    expect(mensajeError('reporte_no_activo').titulo).toBe('Este reporte ya cerró: no se puede confirmar.')
  })
})

describe('textoBusqueda (Nominatim: solo al enviar, mínimo 3 letras)', () => {
  it('recorta y exige 3 letras', () => {
    expect(textoBusqueda('  Zapopan ')).toBe('Zapopan')
    expect(textoBusqueda('ab')).toBe(null)
    expect(textoBusqueda('  ab  ')).toBe(null)
    expect(textoBusqueda('')).toBe(null)
    expect(textoBusqueda(null)).toBe(null)
    expect(textoBusqueda('abc')).toBe('abc')
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

describe('crearLimitador (Nominatim: máx. 1 petición/s para toda la app)', () => {
  it('llamadas concurrentes salen separadas por al menos el intervalo', async () => {
    vi.useFakeTimers()
    const { crearLimitador } = await import('./api.js')
    const lim = crearLimitador(1100)
    const salidas = []
    const tarea = () => { salidas.push(Date.now()); return Promise.resolve('ok') }
    const ps = [lim(tarea), lim(tarea), lim(tarea)]
    await vi.advanceTimersByTimeAsync(5000)
    await Promise.all(ps)
    expect(salidas).toHaveLength(3)
    expect(salidas[1] - salidas[0]).toBeGreaterThanOrEqual(1100)
    expect(salidas[2] - salidas[1]).toBeGreaterThanOrEqual(1100)
    vi.useRealTimers()
  })
  it('un error en una llamada no traba la fila', async () => {
    vi.useFakeTimers()
    const { crearLimitador } = await import('./api.js')
    const lim = crearLimitador(1100)
    const p1 = lim(() => Promise.reject(new Error('x'))).catch(() => 'falló')
    const p2 = lim(() => Promise.resolve('ok'))
    await vi.advanceTimersByTimeAsync(3000)
    expect(await p1).toBe('falló')
    expect(await p2).toBe('ok')
    vi.useRealTimers()
  })
})
