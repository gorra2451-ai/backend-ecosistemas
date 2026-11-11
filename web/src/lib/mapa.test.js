import { describe, it, expect, vi } from 'vitest'
import {
  distanciaM, formatoDist, hace, lluviaPara, loCercano, filaCercana, estadoZona, tituloHoja,
  rutaGoogle, textoWhatsApp, reporteParaConfirmar,
  nivelV2, textoNivel, transito, categoria, centrarEn, leerCentro, suscribirCentro, debounce, partirLugar,
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
    expect(f).toMatchObject({ lvl: 'Alto', nivel: 'Riesgo alto', cls: 'p-alto', t: 'Inundación', lugar: 'A 200 m de ti',
      transito: { txt: 'No transitable', cls: 'no' }, m: 'Actualizado hace 10 min · 1 reporte' })
    const [g] = loCercano({ zonas: [zona(200, 'critico', { actualizado_en: null })], ubic: TU }).map((i) => filaCercana(i, ahora, 'del lugar'))
    expect(g).toMatchObject({ m: '2 reportes', nivel: 'Riesgo crítico', cls: 'p-critico', lugar: 'A 200 m del lugar' })
    expect(g.transito.txt).toBe('Transitable con precaución')
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
    expect(e.frase).toBe('2 calles inundadas · la más cerca a 100 m')
    expect(e.sub).toBe('No cruces: zona Alto a 250 m')
    expect(e.zona.celda).toBe('c250')
  })
  it('singular y fecha de actualización', () => {
    const e = estadoZona({ zonas: [zona(100)], ubic: TU, municipio: 'Zapopan', ahora })
    expect(e.frase).toBe('1 calle inundada a 100 m')
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
    expect(rutaGoogle(20.1, -103.2)).toBe('https://www.google.com/maps/dir/?api=1&destination=20.1,-103.2&travelmode=driving')
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

describe('niveles v2 y copy del equipo', () => {
  it('nivelV2 reconoce crítico con o sin acento', () => {
    expect(nivelV2({ nivel: 'critico' })).toBe('critico')
    expect(nivelV2({ nivel: 'Crítico' })).toBe('critico')
    expect(nivelV2({ nivel: 'x' })).toBe('bajo')
    expect(textoNivel('critico')).toBe('Crítico')
  })
  it('crítico gana a alto en "tu zona"', () => {
    const e = estadoZona({ zonas: [zona(100, 'alto'), zona(200, 'critico')], ubic: TU })
    expect(e.sub).toBe('No cruces: zona Alto a 100 m')
    const f = estadoZona({ zonas: [zona(100, 'medio'), zona(200, 'critico')], ubic: TU })
    expect(f.sub).toBe('No cruces: zona Crítico a 200 m')
  })
  it('categoría y tránsito por gravedad', () => {
    expect(categoria({ gravedad: 'bloqueado' })).toBe('Cierre vial')
    expect(categoria({ gravedad: 'sin_riesgo' })).toBe('Encharcamiento')
    expect(categoria({ tipo: 'persona_en_riesgo' })).toBe('Persona en riesgo')
    expect(categoria({})).toBe('Inundación')
    expect(transito({ gravedad: 'bloqueado' }).txt).toBe('No transitable')
    expect(transito({ gravedad: 'limitado' }).cls).toBe('prec')
    expect(transito({}).txt).toBe('Sin información suficiente')
  })
  it('capas: crítico se puede ocultar', () => {
    const f = filtrarCapas({ zonas: [zona(1, 'critico'), zona(2, 'bajo')] }, { ...CAPAS_INICIALES, critico: false })
    expect(f.zonas.map((z) => z.nivel)).toEqual(['bajo'])
  })
})

describe('buscar: centrarEn, debounce y partirLugar', () => {
  it('centrarEn avisa y numera; null limpia', () => {
    let n = 0
    const q = suscribirCentro(() => n++)
    centrarEn({ lat: 20.6, lng: -103.3, nombre: 'Minerva' })
    const a = leerCentro()
    centrarEn({ lat: 20.6, lng: -103.3 })
    expect(leerCentro().seq).toBe(a.seq + 1)
    centrarEn({ lat: NaN, lng: 1 })
    expect(leerCentro()).toBe(null)
    expect(n).toBe(3); q()
  })
  it('debounce llama una vez con el último valor', () => {
    vi.useFakeTimers()
    const f = vi.fn(); const d = debounce(f, 600)
    d('a'); d('ab'); vi.advanceTimersByTime(599); expect(f).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1); expect(f).toHaveBeenCalledWith('ab'); expect(f).toHaveBeenCalledTimes(1)
    d('x'); d.cancelar(); vi.advanceTimersByTime(1000); expect(f).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
  it('partirLugar', () => {
    expect(partirLugar('Plaza del Sol, Jardines del Sol, Zapopan')).toEqual({ t: 'Plaza del Sol', sub: 'Jardines del Sol, Zapopan' })
    expect(partirLugar('')).toEqual({ t: 'Lugar sin nombre', sub: '' })
  })
})

describe('zonasConEtiqueta', () => {
  it('no etiqueta dos celdas contiguas (se enciman); deja la más grave', async () => {
    const { zonasConEtiqueta } = await import('./mapa.js')
    const z = (celda, lat, lng, nivel) => ({ celda, lat, lng, nivel })
    const a = z('a', 20.67, -103.39, 'bajo')
    const b = z('b', 20.67, -103.3871, 'alto')   // ~300 m al este de a: contigua
    const c = z('c', 20.70, -103.39, 'medio')    // ~3.3 km al norte: lejos
    expect(zonasConEtiqueta([a, b, c]).map((x) => x.celda)).toEqual(['b', 'c'])
  })
  it('respeta el máximo', async () => {
    const { zonasConEtiqueta } = await import('./mapa.js')
    const lejos = [0, 1, 2, 3, 4].map((i) => ({ celda: 'z' + i, lat: 20.6 + i * 0.05, lng: -103.3, nivel: 'bajo' }))
    expect(zonasConEtiqueta(lejos, 3)).toHaveLength(3)
  })
})

import { resumenNiveles } from './mapa.js'
describe('resumenNiveles (hoja del mapa)', () => {
  it('cuenta por nivel en orden de gravedad y omite los ceros', () => {
    const items = [{ clase: 'zona', dato: { nivel: 'bajo' } }, { clase: 'riesgo', dato: {} },
      { clase: 'zona', dato: { nivel: 'alto' } }, { clase: 'zona', dato: { nivel: 'bajo' } }]
    expect(resumenNiveles(items)).toEqual([['riesgo', 1], ['alto', 1], ['bajo', 2]])
    expect(resumenNiveles([])).toEqual([])
  })
})

import { zonasConNivelAgua, nivelAgua } from './mapa.js'
describe('D-029 · nivel = altura del agua', () => {
  const z = { celda: 'c', lat: 20.65, lng: -103.40, nivel: 'critico', alguno_no_pasan_carros: false }
  it('la zona toma el peor nivel de agua de sus reportes, no el de confirmaciones', () => {
    const reps = [{ lat: 20.6501, lng: -103.40, gravedad: 'sin_riesgo' }, { lat: 20.6502, lng: -103.40, gravedad: 'limitado' },
      { lat: 20.70, lng: -103.40, gravedad: 'bloqueado' }] // este está lejos
    const [r] = zonasConNivelAgua([z], reps)
    expect(r.nivel).toBe('medio')
    expect(r.nivel_confirmacion).toBe('critico')
  })
  it('sin reportes cercanos usa el respaldo (no pasan → alto; crítico → alto)', () => {
    expect(zonasConNivelAgua([z], [])[0].nivel).toBe('alto')
    expect(zonasConNivelAgua([{ ...z, nivel: 'bajo' }], [])[0].nivel).toBe('bajo')
    expect(zonasConNivelAgua([{ ...z, nivel: 'bajo', alguno_no_pasan_carros: true }], [])[0].nivel).toBe('alto')
  })
  it('persona en riesgo no define altura del agua', () => {
    expect(zonasConNivelAgua([{ ...z, nivel: 'bajo' }], [{ lat: 20.65, lng: -103.40, tipo: 'persona_en_riesgo', gravedad: 'bloqueado' }])[0].nivel).toBe('bajo')
    expect(nivelAgua({ gravedad: 'bloqueado' })).toBe('alto')
  })
})
