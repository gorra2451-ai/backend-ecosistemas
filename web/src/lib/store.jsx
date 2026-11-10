// Estado global y navegación. Sin router: una pantalla activa (`screen`) sobre el mapa,
// igual que App.dc.html. ir('tipo') abre una pantalla; ir(null) vuelve al mapa.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// Centro por defecto si no hay permiso de ubicación: Plaza del Sol, Zapopan (ejemplo del design system).
export const CENTRO_ZMG = { lat: 20.6497, lng: -103.4016, precision: 500, real: false }

const leer = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin storage */ } }

const Ctx = createContext(null)

export function AppProvider({ children }) {
  const [screen, setScreen] = useState(() => (leer('aguas.onboarded', false) ? null : 'acceso'))
  const [params, setParams] = useState({})
  const [sheet, setSheet] = useState('min')          // min | mid | full | sent
  const [overlay, setOverlay] = useState(null)        // { tipo:'confirm', reporte } | null
  const [toast, setToastState] = useState(null)
  const [ubic, setUbic] = useState(CENTRO_ZMG)
  const [medio, setMedioState] = useState(() => leer('aguas.medio', 'peaton'))
  const [municipio, setMunicipio] = useState(() => leer('aguas.municipio', 'Zapopan'))
  const [prefs, setPrefsState] = useState(() => leer('aguas.prefs', { tema: 'oscuro', a11y: [] }))
  const [misReportes, setMisReportes] = useState(() => leer('aguas.misReportes', []))
  const [seleccion, setSeleccion] = useState(null)    // zona o reporte seleccionado en el mapa
  const [version, setVersion] = useState(0)           // sube para forzar recarga del mapa

  const ir = useCallback((s, p = {}) => { setScreen(s); setParams(p) }, [])
  const avisar = useCallback((texto) => { setToastState(texto); setTimeout(() => setToastState(null), 3200) }, [])
  const terminarOnboarding = useCallback(() => guardar('aguas.onboarded', true), [])
  const setMedio = (m) => { setMedioState(m); guardar('aguas.medio', m) }
  const setPrefs = (p) => { setPrefsState(p); guardar('aguas.prefs', p) }
  const agregarMiReporte = (rep) => setMisReportes((l) => { const n = [rep, ...l.filter((x) => x.id !== rep.id)].slice(0, 20); guardar('aguas.misReportes', n); return n })
  const refrescar = () => setVersion((v) => v + 1)

  useEffect(() => { guardar('aguas.municipio', municipio) }, [municipio])
  useEffect(() => {
    const el = document.documentElement
    el.dataset.theme = prefs.tema === 'claro' ? 'light' : 'dark'
    el.dataset.a11y = (prefs.a11y || []).join(' ')
  }, [prefs])

  const pedirUbicacion = useCallback(() => new Promise((res) => {
    if (!navigator.geolocation) return res(null)
    navigator.geolocation.getCurrentPosition(
      (p) => { const u = { lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy, real: true }; setUbic(u); res(u) },
      () => res(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 })
  }), [])

  const value = useMemo(() => ({
    screen, params, ir, sheet, setSheet, overlay, setOverlay, toast, avisar, ubic, setUbic, pedirUbicacion,
    medio, setMedio, municipio, setMunicipio, prefs, setPrefs, misReportes, agregarMiReporte,
    seleccion, setSeleccion, version, refrescar, terminarOnboarding,
  }), [screen, params, ir, sheet, overlay, toast, avisar, ubic, pedirUbicacion, medio, municipio, prefs, misReportes, seleccion, version, terminarOnboarding])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useApp = () => useContext(Ctx)
