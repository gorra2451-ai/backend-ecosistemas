import { describe, it, expect, vi } from 'vitest'
vi.mock('./supabase.js', () => ({ supabase: {} }))
import {
  pasanCarrosPara, armarReporte, casoAcudo, chipEstado, lineaDeTiempo, etiquetaReporte,
  linkMaps, linkWhatsApp, textoFamilia, leerCola, encolar, quitarDeCola, medidasMax, haceCuanto,
} from './reportar.js'

const memoria = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) } }
const ubic = { lat: 20.6497, lng: -103.4016, precision: 8 }

describe('pasanCarrosPara', () => {
  it('calle usa la respuesta; los demás tipos mandan true (el backend no acepta null)', () => {
    expect(pasanCarrosPara('calle', true)).toBe(true)
    expect(pasanCarrosPara('calle', false)).toBe(false)
    expect(pasanCarrosPara('casa')).toBe(true)
    expect(pasanCarrosPara('coche')).toBe(true)
    expect(pasanCarrosPara('persona_en_riesgo')).toBe(true)
  })
})

describe('armarReporte', () => {
  it('payload para crear_reporte y registro local con el mismo id', () => {
    const { payload, rep } = armarReporte({ tipo: 'calle', detalle: 'no', pasanCarros: false, ubic, id: 'x', ahora: 5 })
    expect(payload).toEqual({ id: 'x', tipo: 'calle', pasanCarros: false, lat: ubic.lat, lng: ubic.lng, precision: 8 })
    expect(rep).toEqual({ id: 'x', tipo: 'calle', detalle: 'no', lat: ubic.lat, lng: ubic.lng, creado: 5 })
  })
  it('nivel del agua en casa NO viaja al backend (solo front)', () => {
    const { payload, rep } = armarReporte({ tipo: 'casa', detalle: 'cintura', ubic, id: 'y' })
    expect(payload).not.toHaveProperty('detalle')
    expect(payload.pasanCarros).toBe(true)
    expect(rep.detalle).toBe('cintura')
  })
})

describe('etiquetas y estado', () => {
  it('etiqueta tipo · detalle', () => {
    expect(etiquetaReporte({ tipo: 'casa', detalle: 'rodilla' })).toBe('Mi casa · Agua a las rodillas')
    expect(etiquetaReporte({ tipo: 'persona_en_riesgo' })).toBe('Persona en riesgo')
  })
  it('caso de ¿A quién acudo? solo para casa y coche', () => {
    expect(casoAcudo('casa')).toBe('casa')
    expect(casoAcudo('coche')).toBe('coche')
    expect(casoAcudo('calle')).toBe(null)
  })
  it('chip según estado', () => {
    expect(chipEstado('pendiente').texto).toBe('Pendiente')
    expect(chipEstado('activo').clase).toBe('chip-act')
    expect(chipEstado('cola').texto).toBe('En cola · sin señal')
  })
  it('línea de tiempo marca el paso actual', () => {
    expect(lineaDeTiempo('pendiente').map((p) => p.k)).toEqual(['done', 'now', 'next', 'next'])
    expect(lineaDeTiempo('activo').map((p) => p.k)).toEqual(['done', 'done', 'now', 'next'])
    expect(lineaDeTiempo('resuelto').map((p) => p.k)).toEqual(['done', 'done', 'done', 'done'])
    expect(lineaDeTiempo('cola').map((p) => p.k)).toEqual(['now', 'next', 'next', 'next'])
  })
  it('hace cuánto', () => {
    expect(haceCuanto(null)).toBe('—')
    expect(haceCuanto(new Date(0).toISOString(), 4 * 60000)).toBe('hace 4 min')
    expect(haceCuanto(new Date(0).toISOString(), 120 * 60000)).toBe('hace 2 h')
  })
})

describe('enlaces', () => {
  it('Google Maps y WhatsApp', () => {
    expect(linkMaps(20.6497, -103.4016)).toBe('https://www.google.com/maps?q=20.649700,-103.401600')
    expect(linkWhatsApp('Hola ñ')).toBe('https://wa.me/?text=Hola%20%C3%B1')
    expect(textoFamilia({ tipo: 'calle', detalle: 'no', lat: 1, lng: 2 })).toContain('no pasan carros')
  })
})

describe('cola sin señal', () => {
  it('encola, no duplica por id y quita', () => {
    const st = memoria()
    expect(leerCola(st)).toEqual([])
    encolar({ payload: { id: 'a' }, rep: { id: 'a' } }, st)
    encolar({ payload: { id: 'a' }, rep: { id: 'a' } }, st)
    encolar({ payload: { id: 'b' }, rep: { id: 'b' } }, st)
    expect(leerCola(st).map((x) => x.payload.id)).toEqual(['a', 'b'])
    expect(quitarDeCola('a', st).map((x) => x.payload.id)).toEqual(['b'])
  })
  it('sin storage no truena', () => {
    expect(leerCola(null)).toEqual([])
  })
})

describe('medidasMax (foto ≤ 1600 px)', () => {
  it('reduce el lado mayor y respeta proporción', () => {
    expect(medidasMax(4000, 3000)).toEqual({ w: 1600, h: 1200 })
    expect(medidasMax(3000, 4000)).toEqual({ w: 1200, h: 1600 })
  })
  it('no agranda fotos chicas', () => {
    expect(medidasMax(800, 600)).toEqual({ w: 800, h: 600 })
    expect(medidasMax(0, 600)).toEqual({ w: 0, h: 0 })
  })
})
