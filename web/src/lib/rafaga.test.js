import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { agruparRafaga } from './rafaga.js'

describe('agruparRafaga (Realtime: eventos falsos no deben disparar N recargas)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('el primer evento recarga de inmediato', () => {
    const fn = vi.fn()
    const g = agruparRafaga(fn, 3000)
    g()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('50 eventos en 1 s = 1 recarga inmediata + 1 al cerrar la ventana', () => {
    const fn = vi.fn()
    const g = agruparRafaga(fn, 3000)
    for (let i = 0; i < 50; i++) { g(); vi.advanceTimersByTime(20) }
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(3000)
    expect(fn).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(10000)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('una ráfaga continua de 10 s recarga como máximo 1 vez cada 3 s', () => {
    const fn = vi.fn()
    const g = agruparRafaga(fn, 3000)
    for (let i = 0; i < 100; i++) { g(); vi.advanceTimersByTime(100) }
    vi.advanceTimersByTime(3000)
    expect(fn.mock.calls.length).toBeLessThanOrEqual(5)
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(4)
  })

  it('un evento suelto después de la ventana vuelve a ser inmediato', () => {
    const fn = vi.fn()
    const g = agruparRafaga(fn, 3000)
    g()
    vi.advanceTimersByTime(5000)
    g()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('cancelar evita la recarga pendiente (al desmontar el mapa)', () => {
    const fn = vi.fn()
    const g = agruparRafaga(fn, 3000)
    g(); g()
    g.cancelar()
    vi.advanceTimersByTime(5000)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
