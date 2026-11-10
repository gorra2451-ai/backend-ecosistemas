import { describe, it, expect } from 'vitest'
import {
  distanciaM, formatoDist, hace, lluviaPara, loCercano, filaCercana, estadoZona, tituloHoja,
  rutaGoogle, textoWhatsApp, reporteParaConfirmar,
  CAPAS_INICIALES, leerCapas, cambiarCapa, restablecerCapas, suscribirCapas, capasModificadas, filtrarCapas,
} from './mapa.js'

const TU = { lat: 20.6497, lng: -103.4016 }
const norte = (m) => ({ lat: TU.lat + m / 111195, lng: TU.lng }) // ~m metros al norte

describe('distanciaM (haversine)', () => {
  it('cero en el mismo punto y ~metros al norte', () => {
    expect(distanciaM(TU, TU)).toBe(0)
    expect(distanciaM(TU, norte(300))).toBeGreaterThan(295)
    expect(distanciaM(TU, norte(300))).toBeLessThan(305)
  })
  it('Guadalajara centro ↔ Plaza del Sol ≈ 5.6 km', () => {
    const d = distanciaM({ lat: 20.6767, lng: -103.3475 }, TU)
    expect(d).toBeGreaterThan(5500); expect(d).toBeLessThan(6500)
  })
  it('sin punto → Infinity', () => expect(distanciaM(null, TU)).toBe(Infinity))
})

describe('formatos', () => {
  it('distancia', () => {
    expect(formatoDist(87)).toBe('90 m')
    expect(formatoDist(3)).toBe('10 m')
    expect(formatoDist(1149)).toBe('1.1 km')
  })
  it('hace N', () => {
    const ahora = Date.parse('2026-11-10T12:00:00Z')
    expect(hace('2026-11-10T11:59:40Z', ahora)).toBe('justo ahora')
    expect(hace('2026-11-10T11:56:00Z', ahora)).toBe('hace 4 min')
    expect(hace('2026-11-10T09:30:00Z', ahora)).toBe('hace 2 h')
    expect(hace(null, ahora)).toBe('')
  })
})

describe('lluviaPara', () => {
  const alertas = [
    { municipio: 'zapopan', nivel: 'medio', titulo: 'Lluvia moderada' },
    { municipio: 'Zapopan', nivel: 'alto', titulo: 'Lluvia fuerte' },
    { municipio: 'tlaquepaque', nivel: 'alto', titulo: 'Tormenta' },
  ]
  it('elige la más alta del municipio, sin importar mayúsculas/acentos', () => {
    expect(lluviaPara(alertas, 'Zapopan').titulo).toBe('Lluvia fuerte')
    expect(lluviaPara([{ municipio: 'tonala', nivel: 'bajo', titulo: 'x' }], 'Tonalá').titulo).toBe('x')
  })
  it('null si no hay', () => expect(lluviaPara(alertas, 'Guadalajara')).toBe(null))
})

const zona = (m, nivel = 'medio', extra = {}) => ({ celda: 'c' + m, ...norte(m), nivel, total_reportes: 2, alguno_no_pasan_carros: false, actualizado_en: '2026-11-10T11:50:00Z', ...extra })

describe('loCercano', () => {
  it('mezcla zonas y persona en riesgo, ordena por distancia y descarta otros tipos', () => {
    const l = loCercano({
      zonas: [zona(900), zona(200)],
      reportes: [{ id: 'r1', tipo: 'persona_en_riesgo', ...norte(500) }, { id: 'r2', tipo: 'calle', ...norte(50) }],
      ubic: TU,
    })
    expect(l.map((i) => i.id)).toEqual(['zc200', 'rr1', 'zc900'])
  })
  it('respeta radio y máximo', () => {
    const zonas = [zona(100), zona(200), zona(300), zona(9000)]
    expect(loCercano({ zonas, ubic: TU, max: 2 })).toHaveLength(2)
    expect(loCercano({ zonas, ubic: TU })).toHaveLength(3)
  })
  it('filas con nivel en palabra y patrón', () => {
    const ahora = Date.parse('2026-11-10T12:00:00Z')
    const [f] = loCercano({ zonas: [zona(200, 'alto', { alguno_no_pasan_carros: true, total_reportes: 1 })], ubic: TU }).map((i) => filaCercana(i, ahora))
    expect(f).toMatchObject({ lvl: 'Alto', cls: 'p-alto', t: 'Zona con agua a 200 m', m: 'No pasan carros · 1 reporte · act. hace 10 min' })
    const [g] = loCercano({ zonas: [zona(200, 'bajo', { actualizado_en: null })], ubic: TU }).map((i) => filaCercana(i, ahora))
    expect(g.m).toBe('Pasan carros · 2 reportes')
  })
})

describe('estadoZona', () => {
  const ahora = Date.parse('2026-11-10T12:00:00Z')
  it('calma si no hay zonas a 300 m', () => {
    const e = estadoZona({ zonas: [zona(800)], ubic: TU, municipio: 'Zapopan', revisado: ahora - 60000, ahora })
    expect(e).toMatchObject({ calma: true, frase: 'Tu zona: sin reportes', sub: 'Zapopan · revisado hace 1 min' })
  })
  it('cuenta calles a 300 m y avisa del Alto', () => {
    const e = estadoZona({ zonas: [zona(100), zona(250, 'alto'), zona(900)], ubic: TU, municipio: 'Zapopan', ahora })
    expect(e.frase).toBe('2 calles inundadas a 300 m')
    expect(e.sub).toBe('No cruces: zona Alto a 250 m')
    expect(e.zona.celda).toBe('c250')
  })
  it('singular y fecha de actualización', () => {
    const e = estadoZona({ zonas: [zona(100)], ubic: TU, municipio: 'Zapopan', ahora })
    expect(e.frase).toBe('1 calle inundada a 300 m')
    expect(e.sub).toBe('Zapopan · actualizado hace 10 min')
  })
})

describe('textos y enlaces', () => {
  it('título según medio', () => {
    expect(tituloHoja('peaton', false)).toBe('¿Salgo o espero?')
    expect(tituloHoja('auto', false)).toBe('¿Sigo o cambio de ruta?')
    expect(tituloHoja('transporte_publico', false)).toBe('Estado de tu zona')
    expect(tituloHoja('auto', true)).toBe('Todo en calma')
  })
  it('ruta y WhatsApp', () => {
    expect(rutaGoogle(20.1, -103.2)).toBe('https://www.google.com/maps/dir/?api=1&destination=20.1,-103.2')
    expect(textoWhatsApp({ titulo: 'Zona Alto', lat: 1, lng: 2 })).toMatch(/^https:\/\/wa\.me\/\?text=/)
  })
  it('reporteParaConfirmar: excluye propios, prefiere id, si no el más cercano', () => {
    const l = [{ id: 'a', es_propio: true, ...norte(10) }, { id: 'b', es_propio: false, ...norte(200) }, { id: 'c', es_propio: false, ...norte(50) }]
    expect(reporteParaConfirmar(l, TU).id).toBe('c')
    expect(reporteParaConfirmar(l, TU, 'b').id).toBe('b')
    expect(reporteParaConfirmar(l, TU, 'a').id).toBe('c')
    expect(reporteParaConfirmar([], TU)).toBe(null)
  })
})

describe('capas del mapa (store + filtro)', () => {
  it('cambia, avisa a suscriptores y se restablece', () => {
    restablecerCapas()
    let n = 0
    const quitar = suscribirCapas(() => { n++ })
    cambiarCapa('alto')
    expect(leerCapas().alto).toBe(false)
    expect(capasModificadas()).toBe(true)
    cambiarCapa('refugios', false)
    cambiarCapa('inventada')
    expect(n).toBe(2)
    restablecerCapas()
    expect(leerCapas()).toEqual(CAPAS_INICIALES)
    expect(capasModificadas()).toBe(false)
    quitar(); cambiarCapa('bajo'); expect(n).toBe(3); restablecerCapas()
  })
  it('filtra zonas por nivel, persona en riesgo, refugios y mis reportes', () => {
    const datos = {
      zonas: [zona(100, 'bajo'), zona(200, 'alto')],
      reportes: [{ id: 'r', tipo: 'persona_en_riesgo' }, { id: 'c', tipo: 'calle' }],
      refugios: [{ id: 1 }], misReportes: [{ id: 'm' }],
    }
    const c = { ...CAPAS_INICIALES, alto: false, riesgo: false, refugios: false, misReportes: false }
    const f = filtrarCapas(datos, c)
    expect(f.zonas.map((z) => z.celda)).toEqual(['c100'])
    expect(f.reportes.map((r) => r.id)).toEqual(['c'])
    expect(f.refugios).toEqual([]); expect(f.misReportes).toEqual([])
    expect(filtrarCapas(datos, CAPAS_INICIALES).zonas).toHaveLength(2)
  })
})
