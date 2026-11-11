// MÓDULO C · Mapa (Equipo Mapa · Cauce ZMG). Barra superior con búsqueda, hoja inferior (min/mid/full = "Alertas"),
// sidebar de escritorio, detalle de alerta (Zona), Buscar y Más. Ronda 3: flujo y copy del equipo; look del design system.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../lib/store.jsx'
import Icon, { Logo } from '../components/Icon.jsx'
import { Screen, PorConfirmar } from '../components/ui.jsx'
import {
  zonasPublicas, reportesEnArea, alertasClima, guardarAccesibilidad, reportesCercanos, bboxAlrededor, mensajeError, buscarLugar, textoBusqueda, direccionDe,
} from '../lib/api.js'
import {
  loCercano, filaCercana, estadoZona, lluviaPara, textoLluvia, distanciaM, formatoDist, hace,
  rutaGoogle, textoWhatsApp, reporteParaConfirmar, textoNivel, RADIO_TU_ZONA_M, nivelV2, categoria, transito,
  leerCapas, suscribirCapas, cambiarCapa, restablecerCapas, capasModificadas, filtrarCapas,
  centrarEn, partirLugar, resumenNiveles,
} from '../lib/mapa.js'
import { urlRutaAlterna, grupoMedio } from '../lib/ayuda.js'
import { hablar } from '../lib/confirmar.js'
import { fraseEstado, ubicacionReal } from '../lib/vozAlertas.js'
import { useArrastreHoja } from '../lib/hoja.js'
import NivelAgua from '../components/NivelAgua.jsx'
import { simularInundacion, quitarSimulaciones, leerSimulacion, suscribirSimulacion, ESCENARIOS, cargarEscenario } from '../lib/simulacion.js'
import { MODO_PRUEBA } from '../lib/prueba.js'
import { vibrar } from '../lib/haptica.js'
import { a11yActivo, alternarA11y } from '../lib/onboarding.js'
import '../styles/mapa.css'

// ---------- Datos compartidos (una sola petición para barra, hoja y sidebar) ----------
const REFRESCO_MS = 60000
let cache = { key: null, prom: null }

function cargar(key, ubic) {
  if (cache.key === key && cache.prom) return cache.prom
  const prom = Promise.all([zonasPublicas(), reportesEnArea(bboxAlrededor(ubic.lat, ubic.lng, 8000)), alertasClima()])
    .then(([z, r, a]) => ({
      zonas: (z.data || []).map((x) => ({ ...x, nivel: nivelV2(x) })),
      reportes: r.data || [],
      alertas: a.data || [],
      error: z.error || r.error || null,
      revisado: Date.now(),
    }))
  cache = { key, prom }
  return prom
}

function useDatosMapa() {
  const { ubic, version, municipio, medio } = useApp()
  const [d, setD] = useState(null)
  const [minuto, setMinuto] = useState(() => Math.floor(Date.now() / REFRESCO_MS))
  useEffect(() => {
    const t = setInterval(() => setMinuto(Math.floor(Date.now() / REFRESCO_MS)), 15000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    let vivo = true
    cargar(`${ubic.lat.toFixed(5)},${ubic.lng.toFixed(5)}|${version}|${minuto}`, ubic).then((x) => { if (vivo) setD(x) })
    return () => { vivo = false }
  }, [ubic.lat, ubic.lng, version, minuto]) // eslint-disable-line

  const capas = useSyncExternalStore(suscribirCapas, leerCapas)
  const zonas = d?.zonas || []
  const reportes = d?.reportes || []
  // La lista respeta las capas; la frase de "tu zona" no (no ocultamos peligro cercano).
  const items = loCercano({ ...filtrarCapas({ zonas, reportes }, capas), ubic })
  const estado = estadoZona({ zonas, ubic, municipio, revisado: d?.revisado })
  const lluvia = lluviaPara(d?.alertas, municipio)
  return {
    cargando: !d, error: d?.error, ubic, municipio, medio, items, estado, zonas, reportes, capas,
    lluvia: lluvia ? textoLluvia(lluvia, municipio) : '',
    fuenteLluvia: lluvia?.fuente || '',
    filtrado: capasModificadas(capas),
  }
}

const abrirItem = (ir, it) => (it.clase === 'riesgo' ? ir('zona', { reporte: it.dato }) : ir('zona', { zona: it.dato }))
const MEDIO_TXT = { peaton: 'A pie', moto: 'Moto', bici: 'Bici', auto: 'Auto', transporte_publico: 'Bus' }

// ---------- Piezas ----------
function Leyenda({ desk = false, filtrado = false, onCapas }) {
  const it = (cls, txt) => <span className="legend-item" key={txt}><span className={cls} aria-hidden="true" />{txt}</span>
  return (
    <div className="mp-legend-row">
      <div className="mp-legend" role="list" aria-label="Leyenda del mapa">
        {[it('mp-sw p-bajo', 'Bajo'), it('mp-sw p-medio', 'Medio'), it('mp-sw p-alto', 'Alto'), it('mp-sw p-critico', 'Crítico'),
          desk ? it('mp-sw--risk', 'Persona en riesgo') : null, it('mp-sw--pend', 'Sin confirmar'), desk ? null : it('mp-sw--tu', 'Tú')]
          .filter(Boolean).map((el) => <span role="listitem" key={el.key}>{el}</span>)}
      </div>
      <button type="button" className="mp-capas-btn" onClick={onCapas} aria-haspopup="dialog">
        <IcoCapas />{filtrado ? 'Filtros · activos' : 'Filtros y leyenda'}
      </button>
    </div>
  )
}

// Ícono propio (no está en Icon.jsx).
const IcoCapas = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" />
  </svg>
)

// ---------- Filtros y leyenda (panel) · equipo Mapa, pantallas 5 y 6 ----------
// Orden del equipo: capas del mapa → nivel de riesgo → leyenda. Sus capas "Inundación / Encharcamiento / Zona de
// riesgo / Cierre vial" no aplican a las zonas (no traen gravedad); "Rutas alternativas" no existe (sin ruteo propio).
const CAPAS = [
  ['riesgo', 'Persona en riesgo', 'Alguien necesita ayuda · llama al 911', 'mp-sw--risk'],
  ['refugios', 'Refugios', 'Lugares para resguardarte', 'mp-sw--ref'],
  ['misReportes', 'Mis reportes en verificación', 'Lo que reportaste y aún no se confirma', 'mp-sw--pend'],
]
const NIVELES_UI = [['bajo', 'Bajo'], ['medio', 'Medio'], ['alto', 'Alto'], ['critico', 'Crítico']]

// Leyenda de símbolos (la usan el panel y "Más").
export function LeyendaSimbolos() {
  const fila = (sw, t, d) => (
    <li key={t}><span className={sw} aria-hidden="true" /><b>{t}</b><span>{d}</span></li>
  )
  return (
    <ul className="mp-capas-sim">
      {fila('mp-sw p-bajo', 'Riesgo bajo · puntos', 'Agua confirmada por 5 a 9 personas')}
      {fila('mp-sw p-medio', 'Riesgo medio · rayas', 'Confirmada por 10 a 14 personas')}
      {fila('mp-sw p-alto', 'Riesgo alto · diagonales', 'Confirmada por 15 a 19 personas')}
      {fila('mp-sw p-critico', 'Riesgo crítico · cuadrícula', 'Confirmada por 20 personas o más')}
      {fila('mp-sw--risk', 'Persona en riesgo', 'Alguien necesita ayuda · llama al 911')}
      {fila('mp-sw--ref', 'Refugio', 'Lugar para resguardarte')}
      {fila('mp-sw--pend', 'En verificación', 'Tu reporte, aún sin confirmar')}
      {fila('mp-sw--tu', 'Tu ubicación', 'Punto con anillo de 300 m: tu zona')}
      {fila('mp-sw--lugar', 'Lugar buscado', 'El punto que elegiste en Buscar')}
    </ul>
  )
}

function Fuentes({ fuenteLluvia }) {
  return (
    <ul className="mp-capas-fuentes">
      <li><b>Reportes ciudadanos anónimos.</b> Un reporte aparece en el mapa cuando otras 5 personas cerca lo confirman.</li>
      <li><b>Avisos de lluvia:</b> {fuenteLluvia ? `alertas de clima vigentes (hoy: ${fuenteLluvia}).` : <>alertas de clima vigentes · fuente oficial <PorConfirmar /></>}</li>
      <li><b>Búsqueda de lugares y mapa base:</b> OpenStreetMap.</li>
      <li><b>Rutas:</b> Google Maps. No conoce nuestras alertas: revisa el mapa antes de salir.</li>
    </ul>
  )
}

function PanelCapas({ onCerrar, fuenteLluvia }) {
  const capas = useSyncExternalStore(suscribirCapas, leerCapas)
  const { prefs, setPrefs } = useApp()
  const dalton = a11yActivo(prefs, 'dalton')
  // Junto a la leyenda: ahí es donde se nota si los colores no se distinguen.
  const alternarDalton = () => {
    const p = alternarA11y(prefs, 'dalton')
    setPrefs(p)
    guardarAccesibilidad({ daltonismo: a11yActivo(p, 'dalton') }).catch(() => {})
  }
  const cerrarRef = useRef(null)
  useEffect(() => {
    cerrarRef.current?.focus()
    const tecla = (e) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])
  return createPortal(
    <div className="mp-capas-fondo" onClick={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <section className="mp-capas" role="dialog" aria-modal="true" aria-labelledby="mp-capas-t">
        <div className="mp-capas-head">
          <h2 id="mp-capas-t">Filtros y leyenda</h2>
          <button ref={cerrarRef} type="button" className="mp-capas-x" onClick={onCerrar} aria-label="Cerrar filtros y leyenda">
            <Icon name="cerrar" size={22} />
          </button>
        </div>
        <button type="button" role="switch" aria-checked={dalton} className="mp-capa mp-capa--dalton" onClick={alternarDalton}>
          <span className="mp-capa-tx"><b>Modo para daltonismo</b><span>Colores azul → naranja, sin rojo ni verde</span></span>
          <span className="mp-capa-r">{dalton ? 'Sí' : 'No'}<span className="switch" aria-hidden="true"><i /></span></span>
        </button>
        <h3 className="mp-capas-h overline">Capas del mapa</h3>
        <ul className="mp-capas-lista">
          {CAPAS.map(([k, t, d, sw]) => (
            <li key={k}>
              <button type="button" role="switch" aria-checked={capas[k]} className="mp-capa" onClick={() => cambiarCapa(k)}>
                <span className={sw} aria-hidden="true" />
                <span className="mp-capa-tx"><b>{t}</b><span>{d}</span></span>
                <span className="mp-capa-r">{capas[k] ? 'Sí' : 'No'}<span className="switch" aria-hidden="true"><i /></span></span>
              </button>
            </li>
          ))}
        </ul>
        <h3 className="mp-capas-h overline" id="mp-niv-t">Nivel de riesgo</h3>
        <div className="mp-chips" role="group" aria-labelledby="mp-niv-t">
          {NIVELES_UI.map(([k, t]) => (
            <button key={k} type="button" className="mp-chip" aria-pressed={capas[k]} onClick={() => cambiarCapa(k)}>
              <span className={'mp-sw p-' + k} aria-hidden="true" />{capas[k] && <Icon name="check" size={16} stroke={3} />}{t}
            </button>
          ))}
        </div>
        <p className="mp-capas-nota">Tu zona siempre te avisa de todo, aunque ocultes una capa.</p>
        <h3 className="mp-capas-h overline">Leyenda</h3>
        <LeyendaSimbolos />
        <h3 className="mp-capas-h overline">Fuentes</h3>
        <Fuentes fuenteLluvia={fuenteLluvia} />
        <div className="mp-capas-acc">
          <button type="button" className="btn" onClick={restablecerCapas} disabled={!capasModificadas(capas)}>Restablecer filtros</button>
          <button type="button" className="btn btn-primary mp-btn-prim" onClick={onCerrar}>Aplicar filtros</button>
        </div>
      </section>
    </div>,
    document.body,
  )
}

function BtnReportar({ onClick, invertido = false }) {
  return (
    <button type="button" className={invertido ? 'mp-report-inv' : 'btn-report'} onClick={onClick}>
      <span className="wave" aria-hidden="true" />
      <Icon name="mas" size={30} stroke={2.4} />
      <span>Reportar</span>
    </button>
  )
}

function Badge({ t }) {
  if (!t) return null
  return <span className={'mp-badge mp-badge--' + t.cls}>{t.cls === 'no' && <IcoProhibido />}{t.txt}</span>
}
const IcoProhibido = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" />
  </svg>
)

function Fila({ it, onClick, desde }) {
  const f = filaCercana(it, Date.now(), desde)
  return (
    <li>
      <button type="button" className={'row mp-row' + (it.clase === 'riesgo' ? ' mp-row--risk' : '')} onClick={onClick}
        aria-label={[f.t, f.lugar, f.nivel, f.transito?.txt, f.m].filter(Boolean).join(', ')}>
        <span className={'row-swatch ' + f.cls}><span className="mp-pill">{f.lvl}</span></span>
        <span className="mp-row-tx">
          <span className="mp-row-t">{f.t}</span>
          <span className="mp-row-l">{f.lugar}</span>
          {f.transito && <span className="mp-badges"><Badge t={f.transito} /></span>}
          {f.m && <span className="mp-row-m">{f.m}</span>}
        </span>
        <Icon name="chevron" size={20} />
      </button>
    </li>
  )
}

function ListaCercana({ datos, onCalmaAvisos }) {
  const { ir } = useApp()
  if (datos.cargando) return <p className="mp-cargando" role="status">Cargando lo cercano…</p>
  if (!datos.items.length && datos.filtrado) {
    return (
      <div className="mp-calma">
        <b>Nada que mostrar con tus capas</b>
        <p>Ocultaste algunas capas del mapa. Tu zona te sigue avisando de todo.</p>
        <button type="button" className="mp-btn-acc" onClick={restablecerCapas}>Mostrar todo otra vez</button>
      </div>
    )
  }
  if (!datos.items.length) {
    return (
      <div className="mp-calma">
        <b>No hay alertas activas cerca</b>
        <p>Te avisamos solo si algo cambia en {datos.municipio}. Puedes guardar el celular.</p>
        <button type="button" className="mp-btn-acc" onClick={onCalmaAvisos}>Elegir de dónde quiero avisos</button>
      </div>
    )
  }
  return <ul className="mp-list">{datos.items.map((it) => <Fila key={it.id} it={it} onClick={() => abrirItem(ir, it)} />)}</ul>
}

// ---------- Barra superior (móvil) ----------
export function TopBar() {
  const { ir, setSheet, prefs, pedirUbicacion } = useApp()
  const datos = useDatosMapa()
  const { estado, medio } = datos
  // Escuchar: sin GPS real pide la ubicación y lee con ESA posición (no con el store aún sin actualizar).
  const escuchar = async () => {
    const decir = (ubic) => hablar(fraseEstado({ zonas: datos.zonas, ubic, municipio: datos.municipio }))
    if (ubicacionReal(datos.ubic)) return decir(datos.ubic)
    // Se habla YA, dentro del toque: Safari iOS bloquea speechSynthesis que arranca fuera de un gesto,
    // y esto la desbloquea para la frase que llega después del GPS (hasta 12 s).
    hablar('Buscando tu ubicación.')
    const u = await pedirUbicacion().catch(() => null)
    decir(ubicacionReal(u) ? u : null)
  }
  const sub = datos.error ? mensajeError(datos.error).titulo : estado.sub
  const alTocarEstado = () => (estado.zona ? ir('zona', { zona: estado.zona }) : setSheet('mid'))
  const [capasAbierto, setCapasAbierto] = useState(false)
  const abrirCapas = () => setCapasAbierto(true)
  const cerrarCapas = useCallback(() => setCapasAbierto(false), [])
  return (
    <div className="mp-top">
      <div className="only-mobile mp-top" style={{ gap: 8 }}>
        <div className="mp-top-row">
          <button type="button" className="mp-search" onClick={() => ir('buscar')}>
            <IcoLupa /><span>Buscar dirección, colonia o lugar</span>
          </button>
          <button type="button" className="mp-mas" onClick={() => ir('mas')} aria-label="Más: leyenda, fuentes, seguridad y configuración">
            <IcoMenu /><span>Más</span>
          </button>
          {prefs.voz && (
            <button type="button" className="mp-mas" disabled={datos.cargando} aria-label="Escuchar el estado de tu zona"
              onClick={escuchar}>
              <Icon name="voz" /><span>Escuchar</span>
            </button>
          )}
        </div>
        <div className="mp-top-row">
          <button type="button" className="top-mode mp-mode" onClick={() => ir('onb')}
            aria-label={`Cambiar cómo me muevo hoy: ${MEDIO_TXT[medio] || 'A pie'}`}>
            <span className="mp-mode-ico"><Icon name={MEDIO_TXT[medio] ? medio : 'peaton'} /></span>
            <span className="mp-mode-tx">{MEDIO_TXT[medio] || 'A pie'}</span>
          </button>
          <button type="button" className="top-status mp-status" onClick={alTocarEstado} aria-live="polite">
            {datos.lluvia && <span className="mp-rain"><Icon name="lluvia" size={15} stroke={2.4} />{datos.lluvia}</span>}
            <span className="mp-frase">{datos.cargando ? 'Revisando tu zona…' : estado.frase}</span>
            {!datos.cargando && sub && <span className="mp-sub">{sub}</span>}
          </button>
        </div>
        <div className="mp-top-row mp-top-row--chips">
          <button type="button" className="mp-capas-btn mp-capas-btn--sm" onClick={abrirCapas} aria-haspopup="dialog">
            <IcoCapas />{datos.filtrado ? 'Leyenda · filtros activos' : 'Leyenda y filtros'}
          </button>
          {/* Accesibilidad siempre a un toque (humo 2026-11-11: "se perdió la parte de accesibilidad") */}
          <button type="button" className="mp-capas-btn mp-capas-btn--sm" onClick={() => ir('ajustes')}>
            <Icon name="accesibilidad" size={20} />Accesibilidad
          </button>
        </div>
      </div>
      <div className="only-desk"><Leyenda desk filtrado={datos.filtrado} onCapas={abrirCapas} /></div>
      {capasAbierto && <PanelCapas fuenteLluvia={datos.fuenteLluvia} onCerrar={cerrarCapas} />}
    </div>
  )
}

const IcoLupa = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
  </svg>
)
const IcoMenu = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

// Tarjeta de lo más cercano (D-028): dibujo de hasta dónde llega el agua + datos clave, sin repetir el título.
function TarjetaCercana({ it, onClick }) {
  const f = filaCercana(it)
  const riesgo = it.clase === 'riesgo'
  const nivel = riesgo ? null : nivelV2(it.dato)
  return (
    <button type="button" className={'mp-near' + (riesgo ? ' mp-near--riesgo' : '')} onClick={onClick}
      aria-label={[`Lo más cerca de ti: ${f.t}`, f.lugar, f.nivel, f.transito?.txt, f.m].filter(Boolean).join(', ')}>
      <span className={'mp-near-art' + (nivel ? ' p-' + nivel : '')} aria-hidden="true">
        {riesgo ? <Icon name="riesgo" size={36} stroke={2.4} /> : <NivelAgua nivel={nivel === 'critico' ? 'alto' : nivel} size={64} />}
      </span>
      <span className="mp-row-tx">
        <span className="overline mp-near-o">Lo más cerca · {f.lugar.replace(/^A /, 'a ')}</span>
        <span className="mp-row-t">{f.t}</span>
        <span className="mp-badges"><span className="mp-badge mp-badge--nivel">{f.nivel}</span><Badge t={f.transito} /></span>
        {f.m && <span className="mp-row-m">{f.m}</span>}
      </span>
      <Icon name="chevron" size={20} />
    </button>
  )
}

const RESUMEN_TXT = { riesgo: 'en riesgo', critico: 'crítico', alto: 'alto', medio: 'medio', bajo: 'bajo' }
function ResumenNiveles({ items }) {
  const r = resumenNiveles(items)
  if (!r.length) return <span className="mp-resumen mp-resumen--calma">Sin alertas cerca</span>
  return (
    <span className="mp-resumen">
      {r.map(([k, n]) => (
        <span key={k} className="mp-res-pill"><span className={'mp-sw ' + (k === 'riesgo' ? 'mp-sw--risk' : 'p-' + k)} aria-hidden="true" />
          <b>{n}</b> {RESUMEN_TXT[k]}</span>
      ))}
    </span>
  )
}

// ---------- Hoja inferior (móvil) ----------
// Se arrastra con el dedo (arriba = más lista, abajo = más mapa) y también responde a toques en el asa.
// ¿A quién acudo? y Refugios viven en la pestaña Ayuda: la hoja solo lleva lo cercano y Reportar.
const IcoBajar = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
)

export function Hoja() {
  const { ir, sheet, setSheet } = useApp()
  const datos = useDatosMapa()
  const n = datos.items.length
  const arrastre = useArrastreHoja(sheet, setSheet)

  if (sheet === 'full') {
    return (
      <div className="mp-full mp-arrastre" {...arrastre}>
        <button type="button" className="mp-handle mp-handle--solo mp-handle--full" aria-label="Mostrar alertas cercanas" onClick={() => setSheet('min')}>
          <span className="sheet-handle" />
        </button>
        <div className="mp-full-row">
          <button type="button" className="mp-verlista" onClick={() => setSheet('mid')}><Icon name="lista" size={22} />{n ? `Alertas · ${n}` : 'Alertas'}</button>
          <BtnReportar onClick={() => ir('tipo')} />
        </div>
      </div>
    )
  }

  if (sheet === 'mid') {
    return (
      <section className="sheet mp-sheet rise" aria-label="Lo cercano">
        <div className="mp-arrastre" {...arrastre}>
          <button type="button" className="mp-handle mp-handle--solo" aria-label="Ocultar lista" onClick={() => setSheet('min')}>
            <span className="sheet-handle" />
          </button>
          <div className="mp-mid-head">
            <div>
              <h2 className="mp-mid-title">Alertas</h2>
              <p className="mp-mid-sub">Consulta las condiciones actuales de tu zona</p>
            </div>
          </div>
        </div>
        <ListaCercana datos={datos} onCalmaAvisos={() => ir('alertas')} />
        <BtnReportar onClick={() => ir('tipo')} />
      </section>
    )
  }

  return (
    <section className="sheet mp-sheet mp-arrastre" aria-label="Acciones" {...arrastre}>
      <div className="mp-min-head">
        <button type="button" className="mp-handle mp-handle--min" onClick={() => setSheet('mid')} aria-expanded="false"
          aria-label={n ? `Ver las ${n} alertas cercanas` : 'Ver alertas cercanas'}>
          <span className="sheet-handle" />
          <span className="mp-min-t"><b>Cerca de ti</b><ResumenNiveles items={datos.items} /></span>
        </button>
        <button type="button" className="mp-ocultar" onClick={() => setSheet('full')} aria-label="Ocultar y ver solo el mapa">
          <IcoBajar />
        </button>
      </div>
      {datos.items[0] && <TarjetaCercana it={datos.items[0]} onClick={() => abrirItem(ir, datos.items[0])} />}
      <BtnReportar onClick={() => ir('tipo')} />
    </section>
  )
}

// ---------- Sidebar (escritorio) ----------
export function Sidebar() {
  const { ir } = useApp()
  const datos = useDatosMapa()
  const { estado } = datos
  const sub = datos.error ? mensajeError(datos.error).titulo : estado.sub
  return (
    <div className="mp-side" style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
      {datos.lluvia && <div className="mp-rain mp-side-rain"><Icon name="lluvia" size={18} />{datos.lluvia}</div>}
      <button type="button" className="mp-side-card" aria-live="polite"
        onClick={() => estado.zona && ir('zona', { zona: estado.zona })} disabled={!estado.zona}
        style={{ cursor: estado.zona ? 'pointer' : 'default' }}>
        <span className="mp-sub">Tu zona · {datos.municipio}</span>
        <span className="mp-frase">{datos.cargando ? 'Revisando tu zona…' : estado.frase}</span>
        {!datos.cargando && sub && <span className="mp-sub">{sub}</span>}
      </button>
      <button type="button" className="mp-search mp-search--side" onClick={() => ir('buscar')}>
        <IcoLupa /><span>Buscar dirección, colonia o lugar</span>
      </button>
      <h2 className="mp-side-h">Alertas cerca de ti</h2>
      <ListaCercana datos={datos} onCalmaAvisos={() => ir('alertas')} />
      <div className="mp-side-fill" />
      <BtnReportar invertido onClick={() => ir('tipo')} />
    </div>
  )
}

// ---------- Encabezado (escritorio) ----------
export function DeskHeader() {
  const { ir, screen } = useApp()
  const nav = [[null, 'Mapa'], ['buscar', 'Buscar'], ['acudo', '¿A quién acudo?'], ['refugios', 'Refugios'], ['alertas', 'Avisos'], ['mas', 'Más']]
  const activo = nav.some(([id]) => id === screen) ? screen : screen === 'acudoresp' ? 'acudo' : null
  return (
    <>
      <div className="mp-brand"><Logo size={40} /><span>¡Aguas!</span></div>
      <nav className="mp-nav" aria-label="Principal">
        {nav.map(([id, txt]) => (
          <button key={txt} type="button" aria-current={activo === id ? 'page' : undefined} onClick={() => ir(id)}>{txt}</button>
        ))}
      </nav>
      <div className="mp-head-right">
        <span className="mp-sello"><Icon name="escudo" size={20} stroke={2} />Anónimo. No guardamos dónde estás.</span>
        <button type="button" className="mp-head-a11y" onClick={() => ir('ajustes')}><Icon name="accesibilidad" size={20} />Accesibilidad</button>
      </div>
    </>
  )
}

// ---------- Detalle de alerta (params {zona} o {reporte}) · equipo Mapa, pantallas 8–13 ----------
const hora = (f) => {
  const t = Date.parse(f)
  return Number.isFinite(t) ? new Date(t).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) + ' h' : null
}

// Consejos generales (equipo, pantallas 8 y 15). Sin datos inventados.
const QUE_HACER = {
  riesgo: ['Si la ves, llama al 911.', 'No entres al agua para rescatar.', 'Aléjate de cables y postes caídos.'],
  no: ['Evita esta vialidad.', 'No intentes cruzar la zona inundada.', 'Consulta una ruta alternativa.'],
  prec: ['Si puedes, espera o toma otra ruta.', 'Si pasas, ve despacio y sin hacer olas.', 'No cruces si no ves el piso.'],
  sin: ['Evita cruzar si no ves el piso.', 'Consulta una ruta alternativa.', 'Vuelve a revisar el mapa en unos minutos.'],
}

function describir({ zona, reporte }) {
  if (zona) {
    const tr = transito(zona)
    return {
      punto: zona, titulo: categoria(zona), cls: 'p-' + zona.nivel, lvl: 'Riesgo ' + textoNivel(zona.nivel).toLowerCase(),
      consejo: tr.cls === 'no' ? 'No pasan carros · no cruces' : 'Pasan carros con precaución',
      transito: tr, confirmada: true,
      filas: [['Nivel de riesgo', textoNivel(zona.nivel)], ['Confirmaciones', zona.total_confirmaciones ?? 0], ['Reportes en la zona', zona.total_reportes ?? 0]],
      reportado: null, actualizado: zona.actualizado_en,
      riesgo: false, reporteId: null, consejos: QUE_HACER[tr.cls],
      share: `${categoria(zona)}, riesgo ${textoNivel(zona.nivel).toLowerCase()}${tr.cls === 'no' ? ', no transitable' : ''}`,
    }
  }
  const riesgo = reporte.tipo === 'persona_en_riesgo'
  const tr = transito(reporte)
  const nivel = reporte.nivel ? nivelV2(reporte) : null
  return {
    punto: reporte, titulo: categoria(reporte), cls: riesgo ? 'c-risk' : nivel ? 'p-' + nivel : 'c-res',
    lvl: riesgo ? 'Persona en riesgo' : nivel ? 'Riesgo ' + textoNivel(nivel).toLowerCase() : 'En verificación',
    consejo: riesgo ? 'Si la ves, llama al 911 · no entres al agua' : tr.txt,
    transito: riesgo ? null : tr, confirmada: riesgo || reporte.estado !== 'pendiente',
    filas: [nivel && !riesgo && ['Nivel de riesgo', textoNivel(nivel)],
      Number.isFinite(reporte.confirmaciones_si) && ['Confirmaciones "sí"', reporte.confirmaciones_si]].filter(Boolean),
    reportado: reporte.creado_en, actualizado: reporte.ultima_confirmacion || reporte.creado_en,
    riesgo, reporteId: reporte.id, consejos: QUE_HACER[riesgo ? 'riesgo' : tr.cls],
    share: riesgo ? 'Persona en riesgo por inundación. Si la ves, llama al 911' : categoria(reporte),
  }
}

// punto = zona o reporte (ubicación ya pública), nunca el GPS del dispositivo.
function useDireccion(punto) {
  const [dir, setDir] = useState(null)
  useEffect(() => {
    if (!punto) return
    let vivo = true
    setDir(null)
    direccionDe(punto.lat, punto.lng).then(({ data }) => { if (vivo) setDir(data || null) }).catch(() => {})
    return () => { vivo = false }
  }, [punto?.lat, punto?.lng]) // eslint-disable-line
  return dir
}

export function Zona() {
  const { params, ubic, setOverlay, version, ir, medio } = useApp()
  const dato = params?.zona || params?.reporte ? describir(params) : null
  const dist = dato ? distanciaM(ubic, dato.punto) : Infinity
  const cerca = dist <= RADIO_TU_ZONA_M
  const [aConfirmar, setAConfirmar] = useState(null)
  const direccion = useDireccion(dato?.punto)

  useEffect(() => {
    if (!dato || !cerca) { setAConfirmar(null); return }
    let vivo = true
    reportesCercanos(ubic.lat, ubic.lng, RADIO_TU_ZONA_M).then(({ data }) => {
      if (vivo) setAConfirmar(reporteParaConfirmar(data, dato.punto, dato.reporteId))
    })
    return () => { vivo = false }
  }, [dato?.punto?.lat, dato?.punto?.lng, dato?.reporteId, cerca, ubic.lat, ubic.lng, version]) // eslint-disable-line

  if (!dato) {
    return (
      <Screen titulo="Alerta" label="Detalle de alerta">
        <p className="muted">Esta alerta ya no está en el mapa. Puede que se haya despejado.</p>
      </Screen>
    )
  }
  const { lat, lng } = dato.punto
  const verEnMapa = () => { centrarEn({ lat, lng, nombre: dato.titulo }); ir(null) }
  const actualizado = hace(dato.actualizado)
  return (
    <Screen label={`Detalle de alerta: ${dato.titulo}`} titulo={null}>
      <div className="mp-z-head">
        <h1 className="mp-z-t">{dato.titulo}</h1>
        <span className={'mp-badge mp-badge--nivel'}>{dato.lvl}</span>
      </div>
      <div className="mp-z-lugar">
        <b>{direccion || 'Ubicación aproximada'}</b>
        {Number.isFinite(dist) && <span>{formatoDist(dist)} de ti{actualizado ? ` · Actualizado ${actualizado}` : ''}</span>}
      </div>
      <div className={'mp-z-nivel ' + dato.cls}>
        <span className="mp-z-lvl">{dato.lvl}</span>
        <span className="mp-z-consejo">{dato.consejo}</span>
      </div>

      {dato.riesgo && <a className="mp-link btn-danger mp-link--911" href="tel:911"><Icon name="telefono" />Llamar al 911</a>}

      <section className="mp-card" aria-labelledby="mp-cond">
        <h2 id="mp-cond">Condiciones actuales</h2>
        {dato.transito && <div><Badge t={dato.transito} /></div>}
        <dl className="mp-dl">
          {dato.filas.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </section>

      <section className="mp-card" aria-labelledby="mp-info">
        <h2 id="mp-info">Información del reporte</h2>
        <div>
          <span className={'mp-badge ' + (dato.confirmada ? 'mp-badge--ok' : 'mp-badge--sin')}>
            {dato.confirmada && <Icon name="escudo" size={14} stroke={2.4} />}
            {dato.confirmada ? 'Información confirmada' : 'En verificación'}
          </span>
        </div>
        <dl className="mp-dl">
          {hora(dato.reportado) && <div><dt>Reportado</dt><dd>{hora(dato.reportado)}</dd></div>}
          <div><dt>Actualizado</dt><dd>{hora(dato.actualizado) || '—'}</dd></div>
          <div><dt>Fuente</dt><dd>Reportes ciudadanos anónimos</dd></div>
        </dl>
      </section>

      <section className="mp-card mp-card--acc" aria-labelledby="mp-hacer">
        <h2 id="mp-hacer">¿Qué debes hacer?</h2>
        <ul>{dato.consejos.map((c) => <li key={c}>{c}</li>)}</ul>
      </section>

      {cerca && aConfirmar && (
        <button type="button" className="btn-outline-acc" onClick={() => setOverlay({ tipo: 'confirm', reporte: aConfirmar })}>
          Estoy aquí: confirmar si sigue
        </button>
      )}
      {!dato.riesgo && (
        <>
          <a className="mp-link mp-link--acc" href={urlRutaAlterna(ubic, grupoMedio(medio))} target="_blank" rel="noopener noreferrer">
            <Icon name="mapa" />Ver rutas alternativas (Google Maps)
          </a>
          <p className="mp-z-nota">Google Maps no conoce esta alerta: elige una ruta que no pase por aquí.</p>
        </>
      )}
      <button type="button" className="btn" onClick={verEnMapa}>Ver en el mapa</button>
      <a className="mp-link mp-link--line" href={textoWhatsApp({ titulo: dato.share, lat, lng })} target="_blank" rel="noopener noreferrer">
        <Icon name="compartir" />Compartir por WhatsApp
      </a>
      <p className="mp-z-priv">No mostramos quién lo reportó.</p>
    </Screen>
  )
}

// ---------- Buscar un lugar · equipo Mapa, pantalla 4 ----------
// Nombres del equipo como atajos: al tocarlos se buscan en OpenStreetMap (no guardamos coordenadas propias).
// Sin autocompletar (reglas de Nominatim): se busca solo al enviar (Enter o "Buscar") o al tocar un atajo.
const SUGERENCIAS = ['Centro Histórico, Guadalajara', 'Zapopan Centro', 'Colonia Americana', 'Av. López Mateos',
  'Plaza del Sol', 'Expo Guadalajara', 'Parque Revolución', 'Glorieta Minerva']

export function Buscar() {
  const { ir, params } = useApp()
  const datos = useDatosMapa()
  const [q, setQ] = useState(params?.q || '')
  const [res, setRes] = useState({ estado: 'vacio', lista: [] }) // vacio | buscando | listo | error
  const [lugar, setLugar] = useState(null)
  const pedido = useRef(0)
  const inputRef = useRef(null)

  async function buscar(v) {
    const texto = textoBusqueda(v)
    const n = ++pedido.current
    if (!texto) { setRes({ estado: v.trim() ? 'corto' : 'vacio', lista: [] }); return }
    setRes((r) => ({ ...r, estado: 'buscando' }))
    let r
    try { r = await buscarLugar(texto) } catch { r = { data: null, error: 'sin_red' } }
    if (n !== pedido.current) return // llegó tarde: ya se buscó otra cosa
    setRes(r.error ? { estado: 'error', lista: [] } : { estado: 'listo', lista: r.data || [] })
  }
  useEffect(() => () => { pedido.current++ }, [])
  useEffect(() => { inputRef.current?.focus(); if (q) buscar(q) }, []) // eslint-disable-line

  // Teclear solo cambia el texto; si se borra todo, vuelven los atajos. No consulta a Nominatim.
  function escribir(v) {
    setQ(v); setLugar(null)
    if (!v.trim()) { pedido.current++; setRes({ estado: 'vacio', lista: [] }) }
  }
  const atajo = (s) => { setQ(s); setLugar(null); buscar(s) }
  const elegir = (l) => { setLugar(l); centrarEn(l) }
  const cancelar = () => (q ? (escribir(''), inputRef.current?.focus()) : ir(null))

  const cercaDelLugar = lugar ? loCercano({ ...filtrarCapas({ zonas: datos.zonas, reportes: datos.reportes }, datos.capas), ubic: lugar }) : []
  const { t, sub } = partirLugar(lugar?.nombre)

  return (
    <Screen titulo="Buscar un lugar" label="Buscar un lugar">
      <form className="mp-buscar" role="search" onSubmit={(e) => { e.preventDefault(); inputRef.current?.blur(); buscar(q) }}>
        <label className="mp-buscar-campo">
          <IcoLupa />
          <span className="sr-only">Buscar dirección, colonia o lugar</span>
          <input ref={inputRef} type="search" value={q} onChange={(e) => escribir(e.target.value)} enterKeyHint="search"
            placeholder="Buscar dirección, colonia o lugar" autoComplete="off" />
        </label>
        <button type="submit" className="btn-text mp-cancelar" disabled={res.estado === 'buscando'}>Buscar</button>
        <button type="button" className="btn-text mp-cancelar" onClick={cancelar}>Cancelar</button>
      </form>

      {lugar ? (
        <>
          <div className="mp-lugar">
            <span className="mp-lugar-ico"><Icon name="pin" /></span>
            <div><b>{t}</b>{sub && <span>{sub}</span>}</div>
          </div>
          <div className="mp-lugar-acc">
            <button type="button" className="btn btn-primary mp-btn-prim" onClick={() => ir(null)}><Icon name="mapa" />Ver en el mapa</button>
            <a className="mp-link mp-link--line" href={rutaGoogle(lugar.lat, lugar.lng)} target="_blank" rel="noopener noreferrer">
              Cómo llegar (Google Maps)
            </a>
          </div>
          <h2 className="mp-side-h">Alertas cerca de este lugar</h2>
          {datos.cargando ? <p className="mp-cargando" role="status">Cargando alertas…</p>
            : cercaDelLugar.length
              ? <ul className="mp-list mp-list--libre">{cercaDelLugar.map((it) => <Fila key={it.id} it={it} desde="del lugar" onClick={() => abrirItem(ir, it)} />)}</ul>
              : <div className="mp-calma"><b>Sin alertas activas cerca</b><p>No hay inundaciones confirmadas cerca de este lugar ahora. Revisa antes de salir.</p></div>}
          <button type="button" className="btn-text" onClick={() => { setLugar(null); inputRef.current?.focus() }}>Elegir otro lugar</button>
        </>
      ) : (
        <div aria-live="polite">
          {res.estado === 'buscando' && <p className="mp-cargando" role="status">Buscando…</p>}
          {res.estado === 'corto' && <p className="mp-aviso">Escribe al menos 3 letras y toca Buscar.</p>}
          {res.estado === 'error' && <p className="mp-aviso">No pudimos buscar. Revisa tu conexión y vuelve a intentar.</p>}
          {res.estado === 'listo' && !res.lista.length && <p className="mp-aviso">No encontramos ese lugar en la zona metropolitana de Guadalajara.</p>}
          {res.estado === 'listo' && res.lista.length > 0 && (
            <ul className="mp-res">
              {res.lista.map((l, i) => {
                const p = partirLugar(l.nombre)
                return (
                  <li key={i}>
                    <button type="button" onClick={() => elegir(l)}>
                      <Icon name="pin" size={22} /><span><b>{p.t}</b>{p.sub && <span>{p.sub}</span>}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {res.estado === 'vacio' && (
            <>
              <p className="mp-cargando">Escribe al menos 3 letras y toca Buscar, o elige un lugar:</p>
              <ul className="mp-res">
                {SUGERENCIAS.map((s) => (
                  <li key={s}><button type="button" onClick={() => atajo(s)}><Icon name="pin" size={22} /><span><b>{s}</b></span></button></li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Screen>
  )
}

// ---------- Simulaciones (modo prueba) ----------
// Para el testeo: una inundación falsa a ~150 m para ver mapa, lista, "Tu zona", voz y vibración sin que llueva.
// Solo en este teléfono (lib/simulacion.js): no se manda nada a la nube.
function Simulaciones() {
  const { ir, ubic, prefs, avisar, refrescar, setSheet } = useApp()
  const sim = useSyncExternalStore(suscribirSimulacion, leerSimulacion)
  const activa = sim.reportes.length === 1 ? sim.zonas[0] : null
  const escenario = sim.reportes.length > 1
  const simular = (e) => {
    simularInundacion(ubic, e.nivel)
    refrescar(); setSheet('min'); ir(null)
    vibrar(prefs, [120, 80, 120])
    avisar(`Simulación: ${e.titulo.toLowerCase()} a unos 150 m. Solo la ves tú.`)
    if (prefs.voz) hablar(`Simulación. Inundación de ${e.titulo.toLowerCase()} a unos 150 metros de ti.`)
  }
  const cargar = () => {
    cargarEscenario(ubic)
    refrescar(); setSheet('mid'); ir(null)
    vibrar(prefs, [60, 40, 60])
    avisar('Escenario de prueba: 8 reportes de todos los tipos cerca de ti. Solo los ves tú.')
  }
  const quitar = () => { quitarSimulaciones(); refrescar(); avisar('Simulación quitada') }
  return (
    <section className="mp-card mp-sim" aria-labelledby="mp-sim-t">
      <h2 id="mp-sim-t">Simulaciones de prueba</h2>
      <p>Reportes falsos cerca de ti para ver cómo te avisa la app. <b>Solo los ves tú</b>; no se mandan a nadie.</p>
      <button type="button" className="btn btn-primary mp-btn-prim" aria-pressed={escenario} onClick={cargar}>
        Cargar escenario de prueba (8 reportes)
      </button>
      <p className="mp-sim-o">O una sola inundación a ~150 m:</p>
      <div className="mp-sim-grid">
        {ESCENARIOS.map((e) => (
          <button key={e.nivel} type="button" className="mp-sim-btn" aria-pressed={activa?.nivel === e.nivel} onClick={() => simular(e)}>
            <span className={'mp-sw p-' + e.nivel} aria-hidden="true" />
            <span><b>{e.titulo}</b><span>{e.desc}</span></span>
          </button>
        ))}
      </div>
      {(activa || escenario) && <button type="button" className="btn" onClick={quitar}>Quitar simulaciones</button>}
    </section>
  )
}

// ---------- Más · equipo Mapa, pantalla 15 ----------
function Seccion({ titulo, children, abierta = false }) {
  return (
    <details className="mp-card mp-det" open={abierta}>
      <summary><h2>{titulo}</h2><Icon name="chevron" size={20} /></summary>
      <div className="mp-det-c">{children}</div>
    </details>
  )
}

export function Mas() {
  const { ir } = useApp()
  const datos = useDatosMapa()
  return (
    <Screen titulo="Más" label="Más: leyenda, fuentes, seguridad y configuración">
      {MODO_PRUEBA && <Simulaciones />}
      <Seccion titulo="Leyenda de símbolos" abierta><LeyendaSimbolos /></Seccion>
      <Seccion titulo="Fuentes de información"><Fuentes fuenteLluvia={datos.fuenteLluvia} /></Seccion>
      <Seccion titulo="Recomendaciones de seguridad">
        <ul className="mp-puntos">
          <li>Evita cruzar vialidades inundadas.</li>
          <li>No atravieses corrientes de agua, ni a pie ni en auto.</li>
          <li>Atiende las indicaciones de las autoridades.</li>
          <li>Busca alternativas ante cierres.</li>
          <li>Aléjate de cables caídos y zonas con riesgo eléctrico.</li>
          <li>Si alguien está en peligro, llama al 911.</li>
        </ul>
      </Seccion>
      <Seccion titulo="Cómo interpretar las alertas">
        <p>El nivel sale de cuántas personas confirmaron que sigue el agua: <b>Bajo</b> (5 a 9), <b>Medio</b> (10 a 14),
          {' '}<b>Alto</b> (15 a 19) y <b>Crítico</b> (20 o más). Cada nivel tiene su patrón para no depender del color.</p>
        <p><b>No transitable</b> quiere decir que alguien reportó que no pasan carros. Una alerta desaparece cuando la gente
          confirma que el agua bajó. Que no haya alerta no garantiza que la calle esté seca.</p>
      </Seccion>
      <section className="mp-card" aria-labelledby="mp-conf">
        <h2 id="mp-conf">Configuración</h2>
        <ul className="mp-conf">
          <li><button type="button" onClick={() => ir('preferencias')}><Icon name="campana" />Notificaciones<Icon name="chevron" size={20} /></button></li>
          <li><button type="button" onClick={() => ir('preferencias')}><Icon name="pin" />De dónde quiero avisos<Icon name="chevron" size={20} /></button></li>
          <li><button type="button" onClick={() => ir('ajustes')}><Icon name="accesibilidad" />Accesibilidad y apariencia<Icon name="chevron" size={20} /></button></li>
          <li><button type="button" onClick={() => ir('onb')}><Icon name="peaton" />Cómo me muevo hoy<Icon name="chevron" size={20} /></button></li>
        </ul>
      </section>
      <section className="mp-card" aria-labelledby="mp-acerca">
        <h2 id="mp-acerca">Acerca de</h2>
        <p>¡Aguas! es un prototipo para consultar y reportar inundaciones en la zona metropolitana de Guadalajara.
          Es anónimo: no guardamos dónde estás, solo la ubicación de cada reporte.</p>
      </section>
    </Screen>
  )
}
