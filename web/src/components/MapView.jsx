// Mapa real (Leaflet + OSM/CARTO, sin llave · D-018). Pinta zonas_publicas, reportes activos,
// mis reportes sin confirmar, refugios y "tú". Se recarga con Realtime y con refrescar().
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { MapContainer, TileLayer, Rectangle, Marker, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApp } from '../lib/store.jsx'
import { zonasPublicas, reportesEnArea, refugiosPublicos, escucharCambios, bboxAlrededor } from '../lib/api.js'
import { leerCapas, suscribirCapas, filtrarCapas, nivelV2, zonasConEtiqueta, leerCentro, suscribirCentro } from '../lib/mapa.js'
import { agruparRafaga } from '../lib/rafaga.js'

const CELDA_M = 300 // parametros.tamano_celda_m (POR CONFIRMAR)
const COLOR = { bajo: 'var(--rb)', medio: 'var(--rm)', alto: 'var(--ra)', critico: 'var(--risk)' }
const TEXTO = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto', critico: 'Crítico' }

const icono = (html, size = 32) => L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
const etiqueta = (z) => L.divIcon({
  className: '', iconSize: null, iconAnchor: [-14, 14], // sin iconSize Leaflet fija 12×12 y aplasta la caja
  html: `<div class="zone-label" style="position:static;white-space:nowrap"><span class="p-${z.nivel}" style="width:18px;height:18px;border-radius:5px;display:inline-block"></span>
    <span><b style="font-size:14px">${z.simulada ? 'Simulación · ' : ''}${TEXTO[z.nivel]}${z.alguno_no_pasan_carros ? ' · no pasan' : ''}</b><br><span style="font-size:13px;color:var(--mu)">${z.total_reportes} reporte${z.total_reportes === 1 ? '' : 's'}</span></span></div>`,
})

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
      setZonas((z.data || []).map((x) => ({ ...x, nivel: nivelV2(x) })))
      setReportes(rep.data || [])
      setRefugios(ref.data || [])
    })()
    return () => { vivo = false }
  }, [ubic.lat, ubic.lng, version, tick])

  const dLat = CELDA_M / 2 / 111320
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

      {ver.zonas.map((z) => {
        const dLng = dLat / Math.cos((z.lat * Math.PI) / 180)
        return (
          <Rectangle key={z.celda} bounds={[[z.lat - dLat, z.lng - dLng], [z.lat + dLat, z.lng + dLng]]}
            pathOptions={{ color: COLOR[z.nivel], fillColor: COLOR[z.nivel], fillOpacity: 0.45, weight: 2 }}
            eventHandlers={{ click: () => { setSeleccion({ tipo: 'zona', ...z }); ir('zona', { zona: z }) } }} />
        )
      })}
      {zonasConEtiqueta(ver.zonas).map((z) => (
        <Marker key={'l' + z.celda} position={[z.lat, z.lng]} icon={etiqueta(z)}
          eventHandlers={{ click: () => { setSeleccion({ tipo: 'zona', ...z }); ir('zona', { zona: z }) } }} />
      ))}

      {ver.reportes.filter((r) => r.tipo === 'persona_en_riesgo').map((r) => (
        <Marker key={r.id} position={[r.lat, r.lng]} zIndexOffset={1000}
          icon={icono('<div class="mk-risk" aria-label="Persona en riesgo">!</div>')}
          eventHandlers={{ click: () => ir('zona', { reporte: r }) }} />
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
