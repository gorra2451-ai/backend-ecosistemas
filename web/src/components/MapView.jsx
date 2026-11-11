// Mapa real (Leaflet + OSM/CARTO, sin llave · D-018). Pinta zonas_publicas, reportes activos,
// mis reportes sin confirmar, refugios y "tú". Se recarga con Realtime y con refrescar().
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { MapContainer, TileLayer, Marker, Circle, Polyline, useMap } from 'react-leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import Icon from './Icon.jsx'
import { htmlPin } from '../lib/pines.js'
import { leerRuta, suscribirRuta, mostrarRuta } from '../lib/rutas.js'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApp } from '../lib/store.jsx'
import { zonasPublicas, reportesEnArea, refugiosPublicos, escucharCambios, bboxAlrededor } from '../lib/api.js'
import { leerCapas, suscribirCapas, filtrarCapas, zonasConNivelAgua, leerCentro, suscribirCentro } from '../lib/mapa.js'
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

// Lugar elegido en Buscar (store centrarEn de lib/mapa.js): centra el mapa y lo marca.
function CentrarEn() {
  const map = useMap()
  const c = useSyncExternalStore(suscribirCentro, leerCentro)
  useEffect(() => { if (c) map.setView([c.lat, c.lng], 16) }, [c?.seq]) // eslint-disable-line
  if (!c) return null
  return <Marker position={[c.lat, c.lng]} zIndexOffset={900} title={c.nombre || 'Lugar buscado'}
    icon={icono('<div class="mp-sw--lugar" style="width:22px;height:22px;border-width:4px" aria-label="Lugar buscado"></div>', 22)} />
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
      <button type="button" aria-expanded={abierto} aria-label="Créditos del mapa: OpenStreetMap" onClick={() => setAbierto((v) => !v)}
        style={{ width: 32, height: 32, border: 'var(--bw) solid var(--line)', borderRadius: 10, background: 'var(--s1)',
          color: 'var(--mu)', font: '700 15px var(--f-body)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>©</button>
    </div>
  )
}

// Ruta elegida en "Cómo llegar" (D-031): línea gruesa, encuadre y chip para quitarla.
function RutaEnMapa() {
  const map = useMap()
  const r = useSyncExternalStore(suscribirRuta, leerRuta)
  const linea = useMemo(() => (r ? r.coords.map(([lng, lat]) => [lat, lng]) : null), [r])
  useEffect(() => { if (linea?.length) map.fitBounds(linea, { padding: [40, 40] }) }, [linea]) // eslint-disable-line
  if (!r) return null
  return (
    <>
      <Polyline positions={linea} pathOptions={{ color: '#05080F', weight: 10, opacity: 0.6 }} />
      <Polyline positions={linea} pathOptions={{ color: 'var(--acc)', weight: 6 }} />
      <div ref={(el) => { if (el) { L.DomEvent.disableClickPropagation(el) } }}
        style={{ position: 'absolute', left: 12, top: 196, zIndex: 455, display: 'flex', gap: 8, alignItems: 'center',
          background: 'var(--s1)', border: 'var(--bw) solid var(--acc)', borderRadius: 14, padding: '6px 6px 6px 12px',
          color: 'var(--tx)', font: '700 14px var(--f-body)' }}>
        <span>Ruta · {r.min} min · {r.km} km{r.enCamino.length ? ` · ⚠ ${r.enCamino.length} en el camino` : ''}</span>
        <button type="button" onClick={() => mostrarRuta(null)} aria-label="Quitar ruta"
          style={{ minHeight: 36, border: 'var(--bw) solid var(--line)', borderRadius: 10, background: 'var(--s2)', color: 'var(--tx)', padding: '0 10px', font: '700 13px var(--f-body)' }}>
          Quitar
        </button>
      </div>
    </>
  )
}

function Controles({ ubic }) {
  const map = useMap()
  const b = { width: 48, height: 48, border: 'var(--bw) solid var(--line)', borderRadius: 14, background: 'var(--s1)',
    color: 'var(--tx)', fontSize: 26, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }
  const ref = (el) => { if (el) { L.DomEvent.disableClickPropagation(el); L.DomEvent.disableScrollPropagation(el) } }
  return (
    <div ref={ref}
      style={{ position: 'absolute', right: 12, top: '40%', zIndex: 455, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button style={b} aria-label="Acercar el mapa" onClick={() => map.zoomIn()}>+</button>
      <button style={b} aria-label="Alejar el mapa" onClick={() => map.zoomOut()}>−</button>
      <button style={{ ...b, color: 'var(--acc)' }} aria-label="Volver a mi ubicación"
        onClick={() => map.setView([ubic.lat, ubic.lng], 15)}>◎</button>
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
      style={{ position: 'absolute', inset: 0 }}>
      <TileLayer url={tiles} maxZoom={19} />
      <Seguir ubic={ubic} centrarSeq={centrarSeq} />
      <Controles ubic={ubic} />
      <CentrarEn />
      <RutaEnMapa />

      {/* D-031: sin halos de zona; cada reporte se marca en su calle */}
      {/* Cada reporte en su calle: ícono del tipo + color/patrón del nivel. Al tocarlo, todos sus datos. */}
      {ver.reportes.map((r) => (
        <Marker key={r.id} position={[r.lat, r.lng]} zIndexOffset={r.tipo === 'persona_en_riesgo' ? 1000 : 500}
          icon={pin(r)} eventHandlers={{ click: () => ir('zona', { reporte: r }) }} />
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
      <Marker position={[ubic.lat, ubic.lng]} icon={icono('<div class="mk-you" aria-label="Tú"></div>', 24)} />
    </MapContainer>
  )
}
