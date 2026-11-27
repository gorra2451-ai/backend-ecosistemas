// Revisión de Leo (2026-11-26, acordado con Diego): en "Persona en riesgo" el 911 se ve desde que se abre la
// pantalla, con o sin GPS, y el aviso al mapa se publica SOLO al tocar "Publicar aviso en mi ubicación".
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'

const crearReporte = vi.fn(async () => ({ data: { estado: 'activo' }, error: null }))
const app = {
  ir: () => {}, setSheet: () => {}, prefs: { voz: false, a11y: [] }, avisar: () => {}, refrescar: () => {},
  agregarMiReporte: () => {}, pedirUbicacion: async () => null, params: {},
  ubic: { lat: 20.6497123, lng: -103.4016456, precision: 12, real: true },
}
vi.mock('../lib/store.jsx', () => ({ useApp: () => app }))
vi.mock('../lib/api.js', () => ({
  crearReporte: (...a) => crearReporte(...a), reportesCercanos: async () => ({ data: [] }), mensajeError: () => ({ titulo: '' }),
  misReportes: async () => ({ data: [] }), buscarLugar: async () => ({}), textoBusqueda: (x) => x,
}))

describe('Persona en riesgo: 911 primero, publicar solo con botón', async () => {
  const { Riesgo } = await import('./Reportar.jsx')
  beforeEach(() => { crearReporte.mockClear(); app.params = {} })

  it('con GPS: 911 visible, botón para publicar con el punto a la vista, y nada se publica al abrir', () => {
    app.ubic = { lat: 20.6497123, lng: -103.4016456, precision: 12, real: true }
    const h = renderToString(<Riesgo />)
    expect(h).toContain('href="tel:911"')
    expect(h).toContain('Publicar aviso en mi ubicación')
    expect(h).toContain('20.64971, -103.40165') // el punto que se va a compartir
    expect(h).not.toContain('Poniendo tu aviso en el mapa')
    expect(h).not.toContain('Tu aviso ya está en el mapa')
    expect(h).not.toContain('No pudimos poner tu aviso') // bug visto en Chrome: salía al abrir
    expect(h.indexOf('tel:911')).toBeLessThan(h.indexOf('Publicar aviso en mi ubicación'))
    expect(crearReporte).not.toHaveBeenCalled()
  })

  it('sin GPS: 911 visible y el botón de publicar no se puede usar (dice por qué)', () => {
    app.ubic = { lat: 20.67, lng: -103.35, real: false }
    const h = renderToString(<Riesgo />)
    expect(h).toContain('href="tel:911"')
    expect(h).toMatch(/<button[^>]*disabled[^>]*>[^<]*(<[^>]+>)*[^<]*Publicar aviso en mi ubicación/)
    expect(h).toContain('Sin tu ubicación no podemos publicar el aviso')
    expect(h).not.toContain('No pudimos poner tu aviso')
    expect(crearReporte).not.toHaveBeenCalled()
  })
})
