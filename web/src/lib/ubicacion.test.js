import { describe, it, expect, vi } from 'vitest'
import { pedirPosicion } from './ubicacion.js'

describe('pedirPosicion', () => {
  it('resuelve null si el permiso queda pendiente (timeout del navegador no corre mientras pregunta)', async () => {
    vi.useFakeTimers()
    const geo = { getCurrentPosition: vi.fn() } // nunca llama a ninguna callback
    const p = pedirPosicion(geo, 12000)
    vi.advanceTimersByTime(12000)
    await expect(p).resolves.toBeNull()
    vi.useRealTimers()
  })
  it('devuelve la posición si llega', async () => {
    const geo = { getCurrentPosition: (ok) => ok({ coords: { latitude: 20.6, longitude: -103.3, accuracy: 15 } }) }
    await expect(pedirPosicion(geo)).resolves.toEqual({ lat: 20.6, lng: -103.3, precision: 15, real: true })
  })
  it('null si se niega o no hay geolocalización', async () => {
    await expect(pedirPosicion({ getCurrentPosition: (_ok, err) => err(new Error('denied')) })).resolves.toBeNull()
    await expect(pedirPosicion(undefined)).resolves.toBeNull()
  })
})

describe('permisoConcedido', () => {
  it('true solo si el permiso ya está en granted (no dispara el aviso del navegador)', async () => {
    const { permisoConcedido } = await import('./ubicacion.js')
    const perms = (state) => ({ query: async () => ({ state }) })
    await expect(permisoConcedido(perms('granted'))).resolves.toBe(true)
    await expect(permisoConcedido(perms('prompt'))).resolves.toBe(false)
    await expect(permisoConcedido({ query: async () => { throw new Error('x') } })).resolves.toBe(false)
    await expect(permisoConcedido(undefined)).resolves.toBe(false)
  })
})
