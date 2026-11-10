import { describe, it, expect, vi } from 'vitest'
// api.js se simula: estas pruebas no tocan la red (responder ante una sesión que falla).
vi.mock('./api.js', () => ({ asegurarSesion: vi.fn(), confirmarReporte: vi.fn(), marcarFalso: vi.fn() }))
import { asegurarSesion } from './api.js'
import { elegirCercano, puedePreguntar, haceMin, lugarDe, mensajeConfirmar } from './confirmar.js'

const r = (id, distancia_m, es_propio = false) => ({ id, distancia_m, es_propio, tipo: 'calle' })

describe('elegirCercano', () => {
  it('elige el más cercano que no es propio', () => {
    expect(elegirCercano([r('a', 50, true), r('b', 120), r('c', 80)]).id).toBe('c')
  })
  it('salta los ya preguntados en la sesión', () => {
    expect(elegirCercano([r('c', 80), r('b', 120)], ['c']).id).toBe('b')
  })
  it('null si no hay candidatos', () => {
    expect(elegirCercano([r('a', 10, true)])).toBe(null)
    expect(elegirCercano([], [])).toBe(null)
    expect(elegirCercano(null)).toBe(null)
  })
  it('es_propio null/undefined no cuenta como ajeno', () => {
    expect(elegirCercano([{ id: 'x', distancia_m: 5 }])).toBe(null)
  })
})

describe('puedePreguntar', () => {
  const u = { real: true }
  it('solo con ubicación real, sin pantalla ni overlay', () => {
    expect(puedePreguntar({ ubic: u, screen: null, overlay: null })).toBe(true)
    expect(puedePreguntar({ ubic: { real: false }, screen: null, overlay: null })).toBe(false)
    expect(puedePreguntar({ ubic: u, screen: 'tipo', overlay: null })).toBe(false)
    expect(puedePreguntar({ ubic: u, screen: null, overlay: { tipo: 'confirm' } })).toBe(false)
  })
})

describe('textos', () => {
  const ahora = Date.parse('2026-11-10T12:00:00Z')
  it('haceMin', () => {
    expect(haceMin('2026-11-10T11:56:00Z', ahora)).toBe('hace 4 min')
    expect(haceMin('2026-11-10T11:59:50Z', ahora)).toBe('hace un momento')
    expect(haceMin('2026-11-10T10:00:00Z', ahora)).toBe('hace 2 h')
    expect(haceMin('2026-11-10T10:40:00Z', ahora)).toBe('hace 1 h 20 min')
    expect(haceMin(null, ahora)).toBe(null)
  })
  it('lugarDe (respaldo sin dirección)', () => {
    expect(lugarDe({ tipo: 'calle', distancia_m: 41.6 })).toBe('una calle inundada a 42 m')
  })
  it('mensajeConfirmar cubre los códigos reales', () => {
    expect(mensajeConfirmar('propio_reporte')).toMatch(/tuyo/)
    expect(mensajeConfirmar('reporte_no_activo')).toMatch(/cerró/)
    expect(mensajeConfirmar('raro')).toMatch(/Vuelve a intentar/)
  })
})

import { interpretarVoz, textoGracias, escucharVoz } from './confirmar.js'

describe('interpretarVoz', () => {
  it('reconoce sí', () => {
    expect(interpretarVoz('Sí')).toBe('sigue')
    expect(interpretarVoz('si sigue inundado')).toBe('sigue')
  })
  it('reconoce ya no', () => {
    expect(interpretarVoz('Ya no')).toBe('ya_no')
    expect(interpretarVoz('no')).toBe('ya_no')
    expect(interpretarVoz('ya bajó el agua')).toBe('ya_no')
  })
  it('no confunde palabras que contienen "si"/"no"', () => {
    expect(interpretarVoz('sinaloa')).toBe(null)
    expect(interpretarVoz('noche')).toBe(null)
    expect(interpretarVoz('no sé')).toBe(null)
  })
  it('"es falso" no se acepta por voz', () => {
    expect(interpretarVoz('es falso')).toBe(null)
    expect(interpretarVoz('')).toBe(null)
  })
})

describe('textoGracias', () => {
  it('copy del equipo según medio, sin números inventados (P-29)', () => {
    expect(textoGracias('sigue', 'auto')).toBe('Tu aviso ayuda a otros conductores a evitar la inundación.')
    expect(textoGracias('bajo', 'peaton')).toBe('Tu aviso ayuda a otras personas a no desviarse sin necesidad.')
    for (const a of ['sigue', 'bajo', 'nunca']) expect(textoGracias(a, 'moto')).not.toMatch(/\d/)
  })
})

describe('escucharVoz', () => {
  it('sin soporte responde null', () => {
    let v = 'x'; escucharVoz((r) => { v = r }, null); expect(v).toBe(null)
  })
  it('usa es-MX y entrega la acción', () => {
    let v, inst
    class Fake { constructor() { inst = this } start() { this.onresult({ results: [[{ transcript: 'ya no' }]] }); this.onend() } abort() {} }
    escucharVoz((r) => { v = r }, Fake)
    expect(inst.lang).toBe('es-MX'); expect(v).toBe('ya_no')
  })
})

import {
  clasificarCercanos, esAntiguo, insignia, nivelRiesgo, cambiosMios, velocidadDe, enMovimiento, puedeTocar,
  registrarVoto, notasGracias, responder, permiteSenal, urlDesviar, textoLlegas, MIN_ATENUAR,
} from './confirmar.js'

describe('clasificarCercanos', () => {
  const p = { lat: 20.67, lng: -103.35 }
  const a = (id, dLat, estado = 'activo', es_propio = false) => ({ id, lat: p.lat + dLat, lng: p.lng, estado, es_propio })
  // 0.001° de latitud ≈ 111 m
  it('llegada a ≤150 m (cualquier estado) y alerta de zona activa a ≤400 m', () => {
    const l = [a('lejos', 0.005), a('alerta', 0.003), a('aqui', 0.001, 'pendiente'), a('mio', 0.0002, 'activo', true)]
    const r = clasificarCercanos(l, p)
    expect(r.llegada.id).toBe('aqui'); expect(r.alerta.id).toBe('alerta')
  })
  it('la alerta solo es para activos y no se repite', () => {
    expect(clasificarCercanos([a('x', 0.003, 'pendiente')], p).alerta).toBe(null)
    expect(clasificarCercanos([a('x', 0.003)], p, { alertados: ['x'] }).alerta).toBe(null)
    expect(clasificarCercanos([a('y', 0.001)], p, { preguntados: ['y'] }).llegada).toBe(null)
  })
})

describe('insignia y nivel', () => {
  const ahora = Date.parse('2026-11-10T12:00:00Z')
  it('confirmado por N personas y atenuado tras MIN_ATENUAR', () => {
    const fresco = { confirmaciones_si: 7, ultima_confirmacion: '2026-11-10T11:50:00Z' }
    expect(insignia(fresco, ahora)).toEqual({ antiguo: false, texto: 'Confirmado por 7 personas • hace 10 min' })
    const viejo = { confirmaciones_si: 1, creado_en: new Date(ahora - (MIN_ATENUAR + 5) * 60000).toISOString() }
    expect(esAntiguo(viejo, ahora)).toBe(true)
    expect(insignia(viejo, ahora).texto).toBe('Antiguo · Confirmado por 1 persona • hace 1 h 5 min')
  })
  it('insignia con 0 confirmaciones dice «Esperando confirmaciones»', () => {
    const nuevo = { confirmaciones_si: 0, ultima_confirmacion: '2026-11-10T11:50:00Z' }
    expect(insignia(nuevo, ahora).texto).toBe('Esperando confirmaciones • hace 10 min')
  })
  it('nivel con palabra', () => {
    expect(nivelRiesgo('critico').nombre).toBe('Riesgo crítico')
    expect(nivelRiesgo('alto').estado).toBe('Cerrado')
    expect(nivelRiesgo(null)).toBe(null)
  })
  it('textoLlegas', () => {
    expect(textoLlegas(347, null)).toBe('A 350 m')
    expect(textoLlegas(360, 6)).toBe('A 360 m · llegas en ~1 min')
  })
})

describe('Mi reporte (cambiosMios)', () => {
  it('primera vez solo línea base', () => {
    expect(cambiosMios([{ id: 'a', estado: 'activo' }], null).avisos).toEqual([])
  })
  it('avisa solo cuando cambia el estado visible', () => {
    const prev = { a: 'oculto', b: 'confirmado', c: 'confirmado' }
    const { avisos, estados } = cambiosMios([
      { id: 'a', estado: 'activo', confirmaciones_si: 5 }, { id: 'b', estado: 'activo' }, { id: 'c', estado: 'resuelto' },
      { id: 'nuevo', estado: 'activo' },
    ], prev)
    expect(avisos.map((x) => x.txt)).toEqual(['Tu reporte fue confirmado por 5 personas', 'Tu reporte se resolvió'])
    expect(estados).toEqual({ a: 'confirmado', b: 'confirmado', c: 'resuelto', nuevo: 'confirmado' })
  })
})

describe('movimiento', () => {
  it('usa la velocidad del GPS o la calcula con el punto anterior', () => {
    expect(velocidadDe({ coords: { speed: 9 } })).toBe(9)
    const v = velocidadDe({ coords: { speed: null, latitude: 20.671, longitude: -103.35 }, timestamp: 10_000 }, { lat: 20.67, lng: -103.35, t: 0 })
    expect(v).toBeGreaterThan(10); expect(v).toBeLessThan(12)
    expect(velocidadDe({ coords: { speed: null } }, null)).toBe(null)
  })
  it('> 4 m/s = en movimiento; sin dato conserva el estado', () => {
    expect(enMovimiento(5)).toBe(true); expect(enMovimiento(3)).toBe(false); expect(enMovimiento(null, true)).toBe(true)
  })
  it('solo auto y moto en movimiento bloquean lo táctil', () => {
    expect(puedeTocar('auto', { moviendo: true })).toBe(false)
    expect(puedeTocar('moto', { moviendo: true })).toBe(false)
    expect(puedeTocar('bici', { moviendo: true })).toBe(true)
    expect(puedeTocar('auto', { moviendo: false })).toBe(true)
  })
})

describe('respuestas', () => {
  it('registrarVoto detecta voto repetido (un voto por reporte)', () => {
    expect(registrarVoto('r1', 'sigue')).toBe(false)
    expect(registrarVoto('r1', 'sigue')).toBe(true)
    expect(registrarVoto('r1', 'bajo')).toBe(false)
    expect(registrarVoto('r1', 'nunca')).toBe(true)
  })
  it('notasGracias', () => {
    expect(notasGracias({ repetido: true, estado: 'activo' })).toEqual(['Ya habías respondido este reporte; mantuvimos tu voto.'])
    expect(notasGracias({ estado: 'resuelto' })[0]).toMatch(/ya no aparece en el mapa/)
  })
  it('notasGracias: tu «sí» publicó el reporte (pendiente → activo)', () => {
    expect(notasGracias({ antes: 'pendiente', estado: 'activo' })).toEqual(['Con tu confirmación ya aparece en el mapa.'])
    expect(notasGracias({ antes: 'activo', estado: 'activo' })).toEqual([])
  })
  it('responder no lanza si la sesión falla: devuelve error', async () => {
    asegurarSesion.mockRejectedValueOnce(new Error('sin red'))
    await expect(responder('r9', 'sigue')).resolves.toEqual({ data: null, error: 'desconocido' })
  })
  it('voz «desviar ruta»', () => { expect(interpretarVoz('desviar ruta')).toBe('desviar') })
  it('urlDesviar por medio', () => {
    expect(urlDesviar('moto')).toContain('travelmode=two-wheeler')
    expect(urlDesviar('auto')).toContain('travelmode=driving')
  })
  it('permiteSenal respeta silencio y vibración', () => {
    const ahora = 1000
    expect(permiteSenal({ vibra: true }, ahora)).toEqual({ sonido: true, vibra: true })
    expect(permiteSenal({ vibra: true, silencioHasta: 5000 }, ahora)).toEqual({ sonido: false, vibra: false })
    expect(permiteSenal({}, ahora).vibra).toBe(false)
  })
})
