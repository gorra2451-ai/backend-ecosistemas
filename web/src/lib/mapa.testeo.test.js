// Hallazgos del testeo de usabilidad (carril A1 · mapa). Lógica pura de textos, filtros y encuadre.
import { describe, it, expect, beforeEach } from 'vitest'
import {
  estadoZona, textoHora, filtrosActivos, textoFiltros, filtrarCapas, CAPAS_INICIALES, filaCercana, loCercano,
  zonasConNivelAgua, etiquetaMedio, avisoMedio, centroVisible, abrirPanel, leerPanel, suscribirPanel,
  enfocarEn, leerEnfoque, categoriaBase,
} from './mapa.js'
import { haySimulacion, cargarEscenario, quitarSimulaciones, simularInundacion } from './simulacion.js'

const TU = { lat: 20.6497, lng: -103.4016, real: true }
const EJEMPLO = { ...TU, real: false }
const norte = (m) => ({ lat: TU.lat + m / 111195, lng: TU.lng })
const zona = (m, nivel = 'medio', extra = {}) => ({ celda: 'c' + m, ...norte(m), nivel, total_reportes: 2, alguno_no_pasan_carros: false, actualizado_en: '2026-11-10T11:50:00Z', ...extra })

describe('tarjeta de estado: sin reportes ≠ sin riesgo', () => {
  const revisado = new Date(2026, 10, 10, 14, 5).getTime()
  it('textoHora da HH:MM de 24 h', () => {
    expect(textoHora(revisado)).toBe('14:05')
    expect(textoHora(new Date(2026, 10, 10, 9, 0).getTime())).toBe('09:00')
    expect(textoHora(null)).toBe('')
  })
  it('sin reportes nombra la zona, avisa que no es "segura" y da la hora (no "revisado justo ahora")', () => {
    const e = estadoZona({ zonas: [], ubic: TU, municipio: 'Zapopan', revisado })
    expect(e.frase).toBe('Sin reportes registrados en Zapopan')
    expect(e.aviso).toBe('Sin reportes no significa sin riesgo')
    expect(e.sub).toBe('Reportes actualizados a las 14:05')
    expect(e.donde).toBe('Zapopan')
    expect(e.ejemplo).toBe(false)
    expect(JSON.stringify(e)).not.toMatch(/justo ahora|tiempo real|Tu zona: sin reportes/)
  })
  it('sin permiso de ubicación habla del punto de ejemplo, no de "tu zona"', () => {
    const e = estadoZona({ zonas: [], ubic: EJEMPLO, municipio: 'Zapopan', revisado })
    expect(e.frase).toBe('Sin reportes registrados cerca del punto de ejemplo')
    expect(e.donde).toBe('Punto de ejemplo · no es tu ubicación')
    expect(e.ejemplo).toBe(true)
  })
  it('con calles inundadas también da la hora de actualización', () => {
    const e = estadoZona({ zonas: [zona(100)], ubic: TU, municipio: 'Zapopan', revisado })
    expect(e.frase).toBe('1 calle inundada a 100 m')
    expect(e.hora).toBe('Reportes actualizados a las 14:05')
  })
})

describe('filtros activos', () => {
  it('cuenta lo que difiere de lo inicial y lo dice en texto', () => {
    expect(filtrosActivos(CAPAS_INICIALES)).toBe(0)
    expect(filtrosActivos({ ...CAPAS_INICIALES, alto: false })).toBe(1)
    expect(filtrosActivos({ ...CAPAS_INICIALES, alto: false, refugios: false })).toBe(2)
    expect(textoFiltros(1)).toBe('Filtros: 1 activo')
    expect(textoFiltros(2)).toBe('Filtros: 2 activos')
    expect(textoFiltros(0)).toBe('')
  })
  it('el filtro de nivel también oculta los pines de reporte de ese nivel (no solo la lista)', () => {
    const reportes = [{ id: 'a', tipo: 'calle', gravedad: 'bloqueado' }, { id: 'b', tipo: 'casa', gravedad: 'sin_riesgo' },
      { id: 'c', tipo: 'coche', nivel: 'critico' }, { id: 'r', tipo: 'persona_en_riesgo' }]
    const f = filtrarCapas({ reportes }, { ...CAPAS_INICIALES, alto: false })
    expect(f.reportes.map((r) => r.id)).toEqual(['b', 'r'])
  })
})

describe('tarjetas: nivel de riesgo y estado de verificación por separado', () => {
  const ahora = Date.parse('2026-11-10T12:00:00Z')
  it('zona publicada = confirmada; trae su tipo para usar el mismo ícono que el mapa', () => {
    const [it0] = loCercano({ zonas: [zona(200, 'alto', { tipo: 'coche' })], ubic: TU })
    const f = filaCercana(it0, ahora)
    expect(f.verif).toEqual({ txt: 'Confirmado', cls: 'ok' })
    expect(f.tipo).toBe('coche')
    expect(f.sim).toBe(false)
  })
  it('persona en riesgo pendiente: "Sin confirmar · aún nadie lo confirma", ícono de persona', () => {
    const [it0] = loCercano({ zonas: [], reportes: [{ id: 'r', tipo: 'persona_en_riesgo', estado: 'pendiente', ...norte(100) }], ubic: TU })
    const f = filaCercana(it0, ahora)
    expect(f.verif).toEqual({ txt: 'Sin confirmar · aún nadie lo confirma', cls: 'sin' })
    expect(f.tipo).toBe('persona_en_riesgo')
  })
  it('las simuladas se marcan aparte (también persona en riesgo) y el título va sin prefijo', () => {
    const [z] = loCercano({ zonas: [zona(100, 'medio', { simulada: true })], ubic: TU })
    expect(filaCercana(z, ahora)).toMatchObject({ sim: true, t: 'Inundación' })
    const [r] = loCercano({ zonas: [], reportes: [{ id: 'r', tipo: 'persona_en_riesgo', simulada: true, ...norte(100) }], ubic: TU })
    expect(filaCercana(r, ahora)).toMatchObject({ sim: true, t: 'Persona en riesgo' })
    expect(categoriaBase({ simulada: true, gravedad: 'bloqueado' })).toBe('Cierre vial')
  })
  it('la zona toma el tipo del reporte que define su nivel', () => {
    const z = { celda: 'c', lat: 20.65, lng: -103.40, nivel: 'bajo' }
    const reps = [{ lat: 20.6501, lng: -103.40, tipo: 'casa', gravedad: 'sin_riesgo' }, { lat: 20.6502, lng: -103.40, tipo: 'coche', gravedad: 'bloqueado' }]
    expect(zonasConNivelAgua([z], reps)[0].tipo).toBe('coche')
    expect(zonasConNivelAgua([z], [])[0].tipo).toBe(null)
  })
})

describe('cómo me muevo hoy', () => {
  it('etiqueta visible y aviso al cambiar', () => {
    expect(etiquetaMedio('auto')).toBe('En auto')
    expect(etiquetaMedio('peaton')).toBe('A pie')
    expect(etiquetaMedio('xx')).toBe('A pie')
    expect(avisoMedio('bici')).toBe('Alertas adaptadas para bici')
    expect(avisoMedio('peaton')).toBe('Alertas adaptadas para ir a pie')
    expect(avisoMedio('transporte_publico')).toBe('Alertas adaptadas para transporte público')
  })
})

describe('centrar en la parte visible del mapa', () => {
  it('sin nada encima no se mueve', () => {
    expect(centroVisible({ w: 400, h: 800 }, {})).toEqual({ dx: 0, dy: 0 })
  })
  it('con barra arriba y hoja abajo, el centro baja/sube a la franja libre', () => {
    // libre: y de 200 a 500 → centro 350; centro del mapa 400 → dy -50
    expect(centroVisible({ w: 400, h: 800 }, { top: 200, bottom: 300 })).toEqual({ dx: 0, dy: -50 })
  })
  it('panel a la derecha (escritorio): el centro se corre a la izquierda', () => {
    expect(centroVisible({ w: 1200, h: 800 }, { right: 560 })).toEqual({ dx: -280, dy: 0 })
  })
  it('si lo tapado no deja espacio, no se mueve', () => {
    expect(centroVisible({ w: 400, h: 300 }, { top: 200, bottom: 200 })).toEqual({ dx: 0, dy: 0 })
  })
})

describe('stores: panel de leyenda/filtros y enfoque', () => {
  it('abre en la pestaña pedida y avisa', () => {
    let n = 0
    const q = suscribirPanel(() => { n++ })
    abrirPanel('filtros'); expect(leerPanel()).toBe('filtros')
    abrirPanel('nada'); expect(leerPanel()).toBe('leyenda')
    abrirPanel(null); expect(leerPanel()).toBe(null)
    q(); expect(n).toBe(3)
  })
  it('enfocarEn numera cada pedido', () => {
    enfocarEn({ lat: 1, lng: 2 }); const a = leerEnfoque()
    enfocarEn({ lat: 1, lng: 2 }); const b = leerEnfoque()
    expect(b.seq).toBe(a.seq + 1)
    enfocarEn({ lat: NaN, lng: 2 }); expect(leerEnfoque()).toBe(null)
  })
})

describe('simulaciones', () => {
  beforeEach(() => quitarSimulaciones())
  it('haySimulacion refleja si hay datos de práctica cargados', () => {
    expect(haySimulacion()).toBe(false)
    simularInundacion(TU, 'medio'); expect(haySimulacion()).toBe(true)
    quitarSimulaciones(); expect(haySimulacion()).toBe(false)
    cargarEscenario(TU); expect(haySimulacion()).toBe(true)
  })
})

import { LIMITES_MAPA, ZMG_RECT, ZOOM_MIN, topAvisoRuta } from './mapa.js'
describe('límites del mapa (escritorio)', () => {
  it('la ZMG completa cabe dentro de los límites, con margen', () => {
    const [[s, o], [n, e]] = LIMITES_MAPA
    expect(s).toBeLessThan(ZMG_RECT.sur); expect(o).toBeLessThan(ZMG_RECT.oeste)
    expect(n).toBeGreaterThan(ZMG_RECT.norte); expect(e).toBeGreaterThan(ZMG_RECT.este)
    expect(ZOOM_MIN).toBeGreaterThanOrEqual(9)
  })
  it('el aviso de ruta queda debajo de la barra de arriba, no a media pantalla', () => {
    expect(topAvisoRuta(76, 76 + 70)).toBe(78) // escritorio: fila de leyenda ~70 px
    expect(topAvisoRuta(0, 188)).toBe(196) // celular: igual que antes
    expect(topAvisoRuta(100, undefined)).toBe(12)
  })
})
