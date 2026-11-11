import { describe, it, expect } from 'vitest'
import { velocidadDe, enMovimiento } from './confirmar.js'
// Condición real: sin coords.speed (ubicación por Wi-Fi/celda, laptops, algunos Android) la posición "brinca"
// dentro de su margen de error aunque el teléfono esté quieto. Un brinco de ~24 m con precisión ±30 m en 2 s
// NO es ir en auto, pero daba 12 m/s (≈43 km/h) y bloqueaba los toques como si fuera manejando.
const pos = (lat, lng, t, accuracy, speed = null) => ({ coords: { latitude: lat, longitude: lng, accuracy, speed }, timestamp: t })

describe('velocidadDe con ruido real del GPS', () => {
  it('quieto con brinco dentro del margen de error → no cuenta como movimiento', () => {
    const prev = { lat: 20.6736, lng: -103.344, t: 0, precision: 30 }
    const v = velocidadDe(pos(20.67382, -103.344, 2000, 30), prev)
    expect(enMovimiento(v, false)).toBe(false)
  })
  it('avance real mayor al margen → sí cuenta (≈ 40 km/h)', () => {
    const prev = { lat: 20.6736, lng: -103.344, t: 0, precision: 10 }
    const v = velocidadDe(pos(20.6736 + 0.001, -103.344, 10000, 10), prev) // ~111 m en 10 s
    expect(v).toBeGreaterThan(10)
    expect(enMovimiento(v, false)).toBe(true)
  })
  it('si el GPS trae speed, se usa tal cual', () => {
    expect(velocidadDe(pos(0, 0, 0, 5, 12), null)).toBe(12)
  })
})
