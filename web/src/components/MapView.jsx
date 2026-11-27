// Mapa real (Leaflet + OSM/CARTO, sin llave · D-018). Pinta zonas_publicas, reportes activos,
// mis reportes sin confirmar, refugios y "tú". Se recarga con Realtime y con refrescar().
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { MapContainer, TileLayer, Marker, Circle, Polyline, useMap } from 'react-leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import Icon from './Icon.jsx'
import { htmlPin } from '../lib/pines.js'
import { leerRutas, suscribirRuta, quitarRuta, elegirRuta, rutaActiva, etiquetaCamino } from '../lib/rutas.js'
import { htmlDestino } from '../lib/destino.js'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApp } from '../lib/store.jsx'
import { zonasPublicas, reportesEnArea, refugiosPublicos, escucharCambios, bboxAlrededor } from '../lib/api.js'
import { leerCapas, suscribirCapas, filtrarCapas, zonasConNivelAgua, leerCentro, suscribirCentro, leerEnfoque, suscribirEnfoque, enfocarEn, centroVisible, LIMITES_MAPA, ZOOM_MIN, topAvisoRuta } from '../lib/mapa.js'
import { agruparRafaga } from '../lib/rafaga.js'

const COLOR = { bajo: 'var(--rb)', medio: 'var(--rm)', alto: 'var(--ra)', critico: 'var(--risk)' }

const ICONO_TIPO = { calle: 'calle', casa: 'casa', coche: 'coche', persona_en_riesgo: 'riesgo' }
const svgTipo = {}
const pin = (r) => {
  const k = ICONO_TIPO[r.tipo] || 'calle'
  svgTipo[k] ||= renderToStaticMarkup(<Icon name={k} size={22} stroke={2.4} />)
  return L.divIcon({ html: htmlPin(r, svgTipo[k]), className: '', iconSize: [44, 54], iconAnchor: [22, 52] })
}
const icono = (html, size = 32) => L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })

function Seguir({ ubic, centrarSeq }) {
  const map = useMap()
  // También al llegar el primer GPS real: el mapa se monta antes con el punto de ejemplo (CENTRO_ZMG).
  useEffect(() => { map.setView([ubic.lat, ubic.lng], map.getZoom() < 14 ? 15 : map.getZoom()) }, [centrarSeq, ubic.real]) // eslint-disable-line
  return null
}

// Lugar elegido en Buscar (store centrarEn de lib/mapa.js): centra el mapa y lo marca con su nombre.
// Solo hay un destino a la vez: al elegir otro, este marcador se mueve (no quedan pines viejos).
// Zoom 14: se ven las avenidas principales alrededor, no solo las calles de junto (testeo).
const ZOOM_DESTINO = 14
function CentrarEn() {
  const map = useMap()
  const c = useSyncExternalStore(suscribirCentro, leerCentro)
  useEffect(() => { if (c) map.setView([c.lat, c.lng], Math.min(map.getZoom(), ZOOM_DESTINO)) }, [c?.seq]) // eslint-disable-line
  const icon = useMemo(() => (c ? L.divIcon({ html: htmlDestino(c.nombre), className: '', iconSize: [28, 28], iconAnchor: [14, 14] }) : null), [c?.seq]) // eslint-disable-line
  if (!c) return null
  return <Marker position={[c.lat, c.lng]} zIndexOffset={900} title={c.nombre || 'Destino'} icon={icon} />
}

// Crédito de OpenStreetMap compacto: la licencia (ODbL) obliga a mostrarlo, pero no tiene que tapar el mapa.
// Se ve como "©" y al tocarlo se abre "© OpenStreetMap" (enlace a su página de derechos).
function Creditos() {
  const [abierto, setAbierto] = useState(false)
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
      {abierto && (
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer"
          style={{ position: 'absolute', right: 40, top: 2, whiteSpace: 'nowrap', background: 'var(--s1)', color: 'var(--tx)',
            border: 'var(--bw) solid var(--line)', borderRadius: 10, padding: '4px 8px', font: '600 12px var(--f-body)' }}>
          © OpenStreetMap
        </a>
      )}
      <button type="button" className="mp-creditos" aria-expanded={abierto} aria-label="Créditos del mapa: OpenStreetMap" onClick={() => setAbierto((v) => !v)}
        style={{ width: 32, height: 32, border: 'var(--bw) solid var(--line)', borderRadius: 10, background: 'var(--s1)',
          color: 'var(--mu)', font: '700 15px var(--f-body)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>©</button>
    </div>
  )
}

// Si el contenedor del mapa cambia de tamaño sin que cambie la ventana (se oculta la barra lateral, gira el iPad,
// se abre un panel), Leaflet no se entera y deja franjas grises: se le avisa.
function AjustarTamano() {
  const map = useMap()
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  return null
}

// Alto de lo que tapa la parte de arriba del mapa (barra/tarjeta en celular, leyenda en escritorio). Se vuelve a
// medir al cambiar de tamaño. Lo usan el aviso de ruta y los controles para no quedar debajo de la barra.
function useTopMapa(activo = true, sel = '.map-top .mp-top', clave = '') {
  const map = useMap()
  const [top, setTop] = useState(196)
  useEffect(() => {
    if (!activo) return
    const medir = () => {
      const cont = map.getContainer().getBoundingClientRect()
      const els = sel.split('|').map((x) => document.querySelector(x)).filter(Boolean)
      const arriba = els.length ? { bottom: Math.max(...els.map((el) => el.getBoundingClientRect().bottom)), height: 1 } : null
      setTop(topAvisoRuta(cont.top, arriba?.height ? arriba.bottom : undefined))
    }
    medir()
    const ro = new ResizeObserver(medir)
    // También la barra completa: si cambia de alto (p. ej. se oculta la mini leyenda) lo de abajo se mueve sin cambiar de tamaño
    ;[...sel.split('|'), '.map-top .mp-top'].forEach((x) => document.querySelectorAll(x).forEach((el) => ro.observe(el)))
    const t = setTimeout(medir, 350) // tras la animación de la hoja / el panel
    window.addEventListener('resize', medir)
    return () => { ro.disconnect(); clearTimeout(t); window.removeEventListener('resize', medir) }
  }, [activo, sel, clave]) // eslint-disable-line
  return top
}

// Ruta elegida en "Cómo llegar" (D-031). Lee el MISMO estado que el panel de Buscar (lib/rutas.js):
// la activa con línea gruesa y continua; las otras punteadas y tenues (tocarlas las vuelve activa).
// Las líneas van en el panel de vectores: los pines de alerta (marcadores) quedan siempre encima.
function RutaEnMapa() {
  const map = useMap()
  const e = useSyncExternalStore(suscribirRuta, leerRutas)
  const r = e?.enMapa ? rutaActiva(e) : null
  const lineas = useMemo(() => (e?.enMapa && e.estado === 'listo' ? e.lista.map((x) => x.coords.map(([lng, lat]) => [lat, lng])) : []), [e?.seq, e?.enMapa, e?.lista]) // eslint-disable-line
  const top = useTopMapa(!!r)
  // Con ruta a la vista se esconde la mini leyenda en celular (CSS [data-ruta]): su lugar lo toma el aviso de ruta
  useEffect(() => { if (!r) return; document.documentElement.dataset.ruta = ''; return () => { delete document.documentElement.dataset.ruta } }, [!!r]) // eslint-disable-line
  // Encuadre: la ruta no queda debajo de la barra de arriba ni del aviso de ruta (≈ 70 px)
  useEffect(() => { const l = lineas[e?.elegida]; if (l?.length) map.fitBounds(l, { paddingTopLeft: [40, top + 90], paddingBottomRight: [90, 110] }) }, [lineas, e?.elegida]) // eslint-disable-line
  if (!r) return null
  const nombre = e.destino?.titulo || String(e.destino?.nombre || '').split(',')[0]
  return (
    <>
      {lineas.map((l, i) => i !== e.elegida && (
        <Polyline key={'alt' + i} positions={l} eventHandlers={{ click: () => elegirRuta(i) }}
          pathOptions={{ color: 'var(--mu)', weight: 5, opacity: 0.7, dashArray: '2 10', lineCap: 'round' }} />
      ))}
      <Polyline key={'b' + e.elegida} positions={lineas[e.elegida]} pathOptions={{ color: '#05080F', weight: 11, opacity: 0.6 }} interactive={false} />
      <Polyline key={'a' + e.elegida} positions={lineas[e.elegida]} pathOptions={{ color: 'var(--acc)', weight: 7, opacity: 1 }} interactive={false} />
      <div className="mp-ruta-aviso" ref={(el) => { if (el) { L.DomEvent.disableClickPropagation(el) } }} role="status"
        style={{ position: 'absolute', left: 12, right: 72, top, zIndex: 455, maxWidth: 720, display: 'flex', gap: 8, alignItems: 'center',
          background: 'var(--s1)', border: '2px solid var(--acc)', borderRadius: 14, padding: '6px 6px 6px 12px',
          color: 'var(--tx)', font: '700 14px/1.3 var(--f-body)' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          {nombre && <span style={{ display: 'block', font: '800 15px var(--f-body)' }}>Ruta a {nombre}</span>}
          {r.min} min · {r.km} km · {r.enCamino.length || !r.revisada ? '⚠ ' : ''}{etiquetaCamino(r)}
          {e.lista.length > 1 && <span style={{ display: 'block', fontWeight: 400, color: 'var(--mu2)' }}>Opción {e.elegida + 1} de {e.lista.length} · toca la línea punteada para cambiar</span>}
        </span>
        <button type="button" onClick={quitarRuta} aria-label="Quitar ruta"
          style={{ minHeight: 40, border: 'var(--bw) solid var(--line)', borderRadius: 10, background: 'var(--s2)', color: 'var(--tx)', padding: '0 10px', font: '700 13px var(--f-body)' }}>
          Quitar
        </button>
      </div>
    </>
  )
}

// Pin elegido (alerta): se centra en la parte del mapa que NO tapan la barra de arriba, la hoja ni el panel
// de escritorio (testeo: la tarjeta tapaba el pin). Mide lo que cubre al momento de enfocar.
function Enfocar() {
  const map = useMap()
  const e = useSyncExternalStore(suscribirEnfoque, leerEnfoque)
  useEffect(() => {
    if (!e) return
    const t = setTimeout(() => {
      const cont = map.getContainer().getBoundingClientRect()
      const alto = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect() : null }
      const arriba = alto('.map-top .mp-top')
      const hoja = alto('.map-sheet')
      const panel = window.innerWidth >= 1024 ? alto('.map-area > .screen') : null
      const tapado = {
        top: arriba ? Math.max(0, arriba.bottom - cont.top) : 0,
        bottom: hoja ? Math.max(0, cont.bottom - hoja.top) : 0,
        right: panel ? Math.max(0, cont.right - panel.left) : 0,
      }
      const { dx, dy } = centroVisible({ w: cont.width, h: cont.height }, tapado)
      const z = Math.max(map.getZoom(), 16)
      const p = map.project([e.lat, e.lng], z).subtract([dx, dy])
      map.setView(map.unproject(p, z), z)
    }, 80) // tras cerrar la pantalla / abrir el panel, para medir lo que de verdad tapa
    return () => clearTimeout(t)
  }, [e?.seq]) // eslint-disable-line
  return null
}

const IcoDiana = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" fill="currentColor" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
)

function Controles({ ubic }) {
  const map = useMap()
  const { avisar } = useApp()
  const b = { width: 48, height: 48, border: 'var(--bw) solid var(--line)', borderRadius: 14, background: 'var(--s1)',
    color: 'var(--tx)', fontSize: 26, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }
  const ref = (el) => { if (el) { L.DomEvent.disableClickPropagation(el); L.DomEvent.disableScrollPropagation(el) } }
  // Testeo: 8 de 10 no entendieron "◎" (lo vieron como un ojo). Diana + texto visible. Sin permiso no se va a un
  // punto que la persona no reconoce: se le pide activar la ubicación.
  const recentrar = () => {
    if (!ubic.real) { avisar('Activa tu ubicación para volver a donde estás'); return }
    map.setView([ubic.lat, ubic.lng], Math.max(map.getZoom(), 15))
  }
  // En celular los controles van a la derecha de la mini leyenda (misma altura), no debajo de ella
  // Con ruta a la vista, además debajo del aviso de ruta (en iPhone SE se encimaban)
  const ruta = useSyncExternalStore(suscribirRuta, leerRutas)
  const conRuta = !!(ruta?.enMapa && ruta.estado === 'listo')
  const topBarra = useTopMapa(true, (window.innerWidth < 1024 ? '.map-top .mp-top-row--chips' : '.map-top .mp-top') + (conRuta ? '|.mp-ruta-aviso' : ''), String(conRuta))
  return (
    <div ref={ref} className="mp-controles"
      style={{ position: 'absolute', right: 12, top: `max(40%, ${topBarra}px)`, zIndex: 455, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
      <button className="mp-zoom" style={b} aria-label="Acercar el mapa" onClick={() => map.zoomIn()}>+</button>
      <button className="mp-zoom" style={b} aria-label="Alejar el mapa" onClick={() => map.zoomOut()}>−</button>
      <button className="mp-miubic" aria-label="Mi ubicación" onClick={recentrar}><IcoDiana /><span>Mi ubicación</span></button>
      <Creditos />
    </div>
  )
}

export default function MapView({ centrarSeq = 0 }) {
  const { ubic, version, misReportes, setSeleccion, ir, prefs } = useApp()
  const [zonas, setZonas] = useState([])
  const [reportes, setReportes] = useState([])
  const [refugios, setRefugios] = useState([])
  const [tick, setTick] = useState(0)
  const capas = useSyncExternalStore(suscribirCapas, leerCapas)

  useEffect(() => {
    // Máx. 1 recarga cada 3 s aunque lleguen eventos falsos al canal público (auditoría M2).
    const refrescar = agruparRafaga(() => setTick((t) => t + 1), 3000)
    const dejar = escucharCambios(refrescar)
    return () => { refrescar.cancelar(); dejar() }
  }, [])
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const [z, rep, ref] = await Promise.all([
        zonasPublicas(), reportesEnArea(bboxAlrededor(ubic.lat, ubic.lng, 8000)), refugiosPublicos()])
      if (!vivo) return
      setZonas(zonasConNivelAgua(z.data || [], rep.data || [])) // D-029: nivel = altura del agua
      setReportes(rep.data || [])
      setRefugios(ref.data || [])
    })()
    return () => { vivo = false }
  }, [ubic.lat, ubic.lng, version, tick])

  const activosIds = useMemo(() => new Set(reportes.map((r) => r.id)), [reportes])
  const ver = filtrarCapas({ zonas, reportes, refugios, misReportes }, capas)
  const oscuro = prefs.tema !== 'claro'
  const tiles = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  return (
    <MapContainer center={[ubic.lat, ubic.lng]} zoom={15} zoomControl={false} attributionControl={false}
      minZoom={ZOOM_MIN} maxBounds={LIMITES_MAPA} maxBoundsViscosity={1}
      style={{ position: 'absolute', inset: 0 }}>
      <TileLayer url={tiles} maxZoom={19} minZoom={ZOOM_MIN} />
      <AjustarTamano />
      <Seguir ubic={ubic} centrarSeq={centrarSeq} />
      <Controles ubic={ubic} />
      <CentrarEn />
      <Enfocar />
      <RutaEnMapa />

      {/* D-031: sin halos de zona; cada reporte se marca en su calle */}
      {/* Cada reporte en su calle: ícono del tipo + color/patrón del nivel. Al tocarlo, todos sus datos. */}
      {ver.reportes.map((r) => (
        <Marker key={r.id} position={[r.lat, r.lng]} zIndexOffset={r.tipo === 'persona_en_riesgo' ? 1000 : 500}
          title={r.simulada ? 'Simulación: solo la ves tú' : undefined}
          icon={pin(r)} eventHandlers={{ click: () => { enfocarEn(r); ir('zona', { reporte: r }) } }} />
      ))}

      {ver.misReportes.filter((m) => !activosIds.has(m.id) && Date.now() - m.creado < 3 * 3600e3).map((m) => (
        <Marker key={'m' + m.id} position={[m.lat, m.lng]} icon={icono('<div class="mk-pend" title="Tu reporte · sin confirmar"></div>')}
          eventHandlers={{ click: () => ir('mireporte', { id: m.id }) }} />
      ))}

      {ver.refugios.map((f) => (
        <Marker key={'f' + f.id} position={[f.lat, f.lng]} icon={icono('<div class="mk-ref">⌂</div>', 30)}
          eventHandlers={{ click: () => ir('refugios') }} />
      ))}

      <Circle center={[ubic.lat, ubic.lng]} radius={300}
        pathOptions={{ color: 'var(--acc)', weight: 2, dashArray: '6 6', fillOpacity: 0.04 }} />
      {/* Sin permiso de ubicación no es "Tú": es un punto de ejemplo (testeo) */}
      {ubic.real === false
        ? <Marker position={[ubic.lat, ubic.lng]} title="Punto de ejemplo: no es tu ubicación"
            icon={L.divIcon({ html: '<div class="mk-ejemplo" role="img" aria-label="Punto de ejemplo, no es tu ubicación"><span></span><b>Punto de ejemplo</b></div>',
              className: '', iconSize: [24, 24], iconAnchor: [12, 12] })} />
        : <Marker position={[ubic.lat, ubic.lng]} icon={icono('<div class="mk-you" role="img" aria-label="Tú"></div>', 24)} />}
    </MapContainer>
  )
}
