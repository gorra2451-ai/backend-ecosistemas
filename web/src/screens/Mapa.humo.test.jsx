// Humo del carril A1 (testeo): las pantallas del mapa se pintan sin tronar y muestran el copy nuevo. Sin DOM (SSR).
import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'

const app = {
  ir: () => {}, setSheet: () => {}, prefs: { voz: true, a11y: [] }, setPrefs: () => {}, pedirUbicacion: async () => null, avisar: () => {},
  ubic: { lat: 20.6497, lng: -103.4016, real: false }, version: 0, municipio: 'Zapopan', medio: 'auto', sheet: 'min',
  refrescar: () => {}, setOverlay: () => {}, params: {},
}
vi.mock('react', async (o) => { const r = await o(); return { ...r, default: r.default, useSyncExternalStore: (s, g) => g() } })
vi.mock('../lib/store.jsx', () => ({ useApp: () => app }))
vi.mock('../lib/api.js', () => ({
  zonasPublicas: async () => ({ data: [] }), reportesEnArea: async () => ({ data: [] }), alertasClima: async () => ({ data: [] }),
  guardarAccesibilidad: async () => {}, reportesCercanos: async () => ({ data: [] }), bboxAlrededor: () => ({}), mensajeError: () => ({ titulo: '' }),
  buscarLugar: async () => ({}), textoBusqueda: (x) => x, direccionDe: async () => ({ data: null }),
}))

describe('smoke render', async () => {
  const M = await import('./Mapa.jsx')
  it('TopBar, Hoja (min/full/mid), Sidebar, Mas', () => {
    let h = renderToString(<M.TopBar />)
    expect(h).toContain('En auto'); expect(h).toContain('Leyenda'); expect(h).toContain('Filtrar'); expect(h).toContain('punto de ejemplo')
    h = renderToString(<M.Hoja />); expect(h).toContain('Banqueta')
    app.sheet = 'full'; expect(renderToString(<M.Hoja />)).toContain('Cubre llanta')
    app.sheet = 'mid'; expect(renderToString(<M.Hoja />)).toContain('Alertas')
    expect(renderToString(<M.Sidebar />)).toContain('Buscando reportes')
    h = renderToString(<M.Mas />); expect(h).toContain('Privacidad y permisos'); expect(h).toContain('Coche atrapado')
    expect(h.indexOf('Leyenda del mapa')).toBeLessThan(h.indexOf('Simulaciones') === -1 ? Infinity : h.indexOf('Simulaciones'))
  })
  it('Zona con reporte simulado y con zona', () => {
    app.params = { reporte: { id: 'x', tipo: 'persona_en_riesgo', lat: 20.65, lng: -103.4, simulada: true, estado: 'pendiente' } }
    let h = renderToString(<M.Zona />)
    expect(h).toContain('Simulación'); expect(h).toContain('Estado de verificación'); expect(h).toContain('aún nadie lo confirma')
    app.params = { zona: { celda: 'c', lat: 20.65, lng: -103.4, nivel: 'alto', tipo: 'coche', alguno_no_pasan_carros: true } }
    h = renderToString(<M.Zona />)
    expect(h).toContain('No transitable · no cruces'); expect(h).toContain('Nivel de riesgo'); expect(h).toContain('WhatsApp')
  })
})
