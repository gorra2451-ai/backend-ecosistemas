import { describe, it, expect } from 'vitest'
import {
  normalizarCaso, distanciaM, formatoDistancia, ordenarPorDistancia, urlRuta, base64UrlABytes, municipioParaPush,
} from './ayuda.js'

describe('normalizarCaso', () => {
  it('respeta los casos del contrato y traduce alias', () => {
    expect(normalizarCaso('casa')).toBe('casa')
    expect(normalizarCaso('persona_herida')).toBe('persona_herida')
    expect(normalizarCaso('herida')).toBe('persona_herida')
    expect(normalizarCaso('calle')).toBe('calle')
    expect(normalizarCaso('carro')).toBe('coche')
    expect(normalizarCaso('luz')).toBe('riesgo_electrico')
    expect(normalizarCaso('arbol')).toBe('arbol_caido')
    expect(normalizarCaso('raro')).toBe('otro')
    expect(normalizarCaso(undefined)).toBe('otro')
  })
})

describe('distancias', () => {
  it('calcula ~1.1 km por 0.01° de latitud', () => {
    const d = distanciaM({ lat: 20.65, lng: -103.4 }, { lat: 20.66, lng: -103.4 })
    expect(d).toBeGreaterThan(1100)
    expect(d).toBeLessThan(1125)
    expect(distanciaM(null, { lat: 1, lng: 1 })).toBe(null)
  })
  it('formatea metros y kilómetros', () => {
    expect(formatoDistancia(648)).toBe('650 m')
    expect(formatoDistancia(1430)).toBe('1.4 km')
    expect(formatoDistancia(null)).toBe('')
  })
  it('ordena por cercanía y respeta distancia_m del backend', () => {
    const yo = { lat: 20.65, lng: -103.4 }
    const l = ordenarPorDistancia([{ id: 'lejos', lat: 20.7, lng: -103.4 }, { id: 'cerca', lat: 20.651, lng: -103.4 }, { id: 'b', distancia_m: 5 }], yo)
    expect(l.map((r) => r.id)).toEqual(['b', 'cerca', 'lejos'])
  })
  it('arma link de ruta de Google Maps', () => {
    expect(urlRuta(20.1, -103.2)).toBe('https://www.google.com/maps/dir/?api=1&destination=20.1,-103.2')
  })
})

describe('push', () => {
  it('decodifica base64url', () => {
    expect(Array.from(base64UrlABytes('AQID_-8'))).toEqual([1, 2, 3, 255, 239])
  })
  it('elige un solo municipio para la suscripción', () => {
    expect(municipioParaPush({ Zapopan: true, Tonalá: true }, 'Tonalá')).toBe('Tonalá')
    expect(municipioParaPush({ Tonalá: true }, 'Zapopan')).toBe('Tonalá')
    expect(municipioParaPush({}, 'Zapopan')).toBe('Zapopan')
  })
})

describe('alertas de clima', async () => {
  const { nivelAlerta, textoHace, textoVigencia, mensajeAlerta, urlWhatsApp, urlSms, silenciado, DOS_HORAS_MS } = await import('./ayuda.js')
  it('nivel con número y palabra, cae en bajo si no lo conoce', () => {
    expect(nivelAlerta('alto').texto).toBe('Nivel 3 de 3 (intensa)')
    expect(nivelAlerta('medio').num).toBe(2)
    expect(nivelAlerta('raro').clave).toBe('bajo')
  })
  it('actualizado hace', () => {
    const ahora = Date.parse('2026-11-10T18:00:00Z')
    expect(textoHace('2026-11-10T17:55:00Z', ahora)).toBe('hace 5 min')
    expect(textoHace('2026-11-10T15:00:00Z', ahora)).toBe('hace 3 h')
    expect(textoHace('2026-11-08T18:00:00Z', ahora)).toBe('hace 2 días')
    expect(textoHace(null, ahora)).toBeNull()
  })
  it('vigencia', () => {
    expect(textoVigencia(null, null)).toBeNull()
    expect(textoVigencia(null, '2026-11-10T18:00:00Z')).toMatch(/^Hasta /)
    expect(textoVigencia('2026-11-10T16:00:00Z', '2026-11-10T18:00:00Z')).toMatch(/^De .+ a /)
  })
  it('mensaje y enlaces para compartir', () => {
    const m = mensajeAlerta({ titulo: 'Lluvia fuerte', municipio: 'Zapopan', nivel: 'alto', fuente: 'SMN' }, 'https://x.mx')
    expect(m).toBe('¡Aguas! Lluvia fuerte en Zapopan (nivel 3 de 3, intensa). Fuente: SMN. https://x.mx')
    expect(urlWhatsApp('a b')).toBe('https://wa.me/?text=a%20b')
    expect(urlSms('a&b')).toBe('sms:?&body=a%26b')
  })
  it('silenciar 2 horas', () => {
    expect(silenciado({ silencioHasta: 1000 + DOS_HORAS_MS }, 1000)).toBe(true)
    expect(silenciado({ silencioHasta: 500 }, 1000)).toBe(false)
    expect(silenciado({}, 1000)).toBe(false)
  })
})

describe('ronda 3 · me pasó algo', async () => {
  const { SITUACIONES, CASOS_EQUIPO, mensajeLlamada, urlUbicacion, mensajeUbicacion } = await import('./ayuda.js')
  it('los 6 casos del equipo tienen situación y solo CFE trae teléfono propio', () => {
    expect(CASOS_EQUIPO).toHaveLength(6)
    CASOS_EQUIPO.forEach((c) => expect(SITUACIONES[c].say).toBeTruthy())
    expect(CASOS_EQUIPO.filter((c) => SITUACIONES[c].tel)).toEqual(['riesgo_electrico'])
  })
  it('qué decir al llamar', () => {
    expect(mensajeLlamada({ say: 'hay una persona herida', lugar: 'Zapopan', personas: 2 }))
      .toBe('Estoy en Zapopan. Hay una persona herida. Somos 2 personas.')
    expect(mensajeLlamada({ say: 'x' })).toBe('X. Somos 1 persona.')
  })
  it('ubicación para WhatsApp', () => {
    expect(urlUbicacion(20.123456, -103.4)).toBe('https://www.google.com/maps?q=20.12346,-103.40000')
    expect(mensajeUbicacion('Hola.', 1, 2)).toBe('Hola. Mi ubicación: https://www.google.com/maps?q=1.00000,2.00000')
  })
})

describe('ronda 3 · calles y ¿puedo pasar?', async () => {
  const { grupoMedio, puedoPasar, viasCercanas, claseNivel, urlRutaAlterna, argsPreferencias } = await import('./ayuda.js')
  it('medio → vista', () => {
    expect(grupoMedio('moto')).toBe('manejo')
    expect(grupoMedio('bici')).toBe('camino')
    expect(grupoMedio('transporte_publico')).toBe('camion')
    expect(grupoMedio(undefined)).toBe('camino')
  })
  it('veredicto por nivel y gravedad (gana lo peor)', () => {
    expect(puedoPasar({ nivel: 'critico' })).toBe('no')
    expect(puedoPasar({ nivel: 'bajo', gravedad: 'bloqueado' })).toBe('no')
    expect(puedoPasar({ nivel: 'medio' })).toBe('precaucion')
    expect(puedoPasar({ nivel: 'bajo', gravedad: 'limitado' })).toBe('precaucion')
    expect(puedoPasar({ nivel: 'bajo', gravedad: 'sin_riesgo' })).toBe('si')
    expect(claseNivel('critico')).toBe('ay-p-critico')
    expect(claseNivel('medio')).toBe('p-medio')
  })
  it('vías cercanas: zonas enriquecidas, filtradas y ordenadas', () => {
    const ubic = { lat: 20.65, lng: -103.4 }
    const zonas = [
      { celda: 'a', lat: 20.66, lng: -103.4, nivel: 'bajo', total_reportes: 5 },
      { celda: 'b', lat: 20.651, lng: -103.4, nivel: 'bajo', total_reportes: 6 },
      { celda: 'lejos', lat: 21, lng: -103.4, nivel: 'alto' },
    ]
    const reportes = [{ id: 1, estado: 'activo', tipo: 'calle', lat: 20.6511, lng: -103.4, gravedad: 'bloqueado' }]
    const v = viasCercanas({ zonas, reportes, ubic })
    expect(v.map((x) => x.id)).toEqual(['zb', 'za'])
    expect(v[0].veredicto).toBe('no')
    expect(v[1].veredicto).toBe('si')
    const sinZonas = viasCercanas({ zonas: [], reportes: [...reportes, { id: 2, estado: 'pendiente', tipo: 'calle', lat: 20.65, lng: -103.4 }], ubic })
    expect(sinZonas.map((x) => x.id)).toEqual(['r1'])
  })
  it('ruta alterna y preferencias push', () => {
    expect(urlRutaAlterna({ lat: 1, lng: 2 }, 'camion')).toBe('https://www.google.com/maps/dir/?api=1&origin=1,2&travelmode=transit')
    expect(argsPreferencias({ soloCambios: true, silencioHasta: 1000 + 90 * 60000 }, 1000)).toEqual({ soloCambios: true, soloFuertes: false, silenciarMin: 90 })
    expect(argsPreferencias({ soloFuertes: true }, 1000).silenciarMin).toBe(0)
  })
})
