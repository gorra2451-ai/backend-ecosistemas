// MÓDULO C · Mapa (Equipo Mapa). Barra superior, hoja inferior (min/mid/full), sidebar de escritorio,
// detalle de zona, encabezado de escritorio. Diseño: canvas App.dc.html (§3a) y Web.dc.html (§3b).
import { useEffect, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import Icon, { Logo } from '../components/Icon.jsx'
import { Screen } from '../components/ui.jsx'
import { zonasPublicas, reportesEnArea, alertasClima, reportesCercanos, bboxAlrededor, nivelDeZona, mensajeError } from '../lib/api.js'
import {
  loCercano, filaCercana, estadoZona, lluviaPara, textoLluvia, tituloHoja, distanciaM, formatoDist, hace,
  rutaGoogle, textoWhatsApp, reporteParaConfirmar, textoNivel, RADIO_TU_ZONA_M,
} from '../lib/mapa.js'
import '../styles/mapa.css'

// ---------- Datos compartidos (una sola petición para barra, hoja y sidebar) ----------
const REFRESCO_MS = 60000
let cache = { key: null, prom: null }

function cargar(key, ubic) {
  if (cache.key === key && cache.prom) return cache.prom
  const prom = Promise.all([zonasPublicas(), reportesEnArea(bboxAlrededor(ubic.lat, ubic.lng, 8000)), alertasClima()])
    .then(([z, r, a]) => ({
      zonas: (z.data || []).map((x) => ({ ...x, nivel: nivelDeZona(x) })),
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

  const zonas = d?.zonas || []
  const reportes = d?.reportes || []
  const items = loCercano({ zonas, reportes, ubic })
  const estado = estadoZona({ zonas, ubic, municipio, revisado: d?.revisado })
  const lluvia = lluviaPara(d?.alertas, municipio)
  return {
    cargando: !d, error: d?.error, ubic, municipio, medio, items, estado,
    lluvia: lluvia ? textoLluvia(lluvia, municipio) : '',
    titulo: tituloHoja(medio, items.length === 0),
  }
}

const abrirItem = (ir, it) => (it.clase === 'riesgo' ? ir('zona', { reporte: it.dato }) : ir('zona', { zona: it.dato }))
const MEDIO_TXT = { peaton: 'A pie', bici: 'Bici', auto: 'Auto', transporte_publico: 'Bus' }

// ---------- Piezas ----------
function Leyenda({ desk = false }) {
  const it = (cls, txt) => <span className="legend-item" key={txt}><span className={cls} aria-hidden="true" />{txt}</span>
  return (
    <div className="mp-legend" role="list" aria-label="Leyenda del mapa">
      {[it('mp-sw p-bajo', 'Bajo'), it('mp-sw p-medio', 'Medio'), it('mp-sw p-alto', 'Alto'),
        desk ? it('mp-sw--risk', 'Persona en riesgo') : null, it('mp-sw--pend', 'Sin confirmar'), desk ? null : it('mp-sw--tu', 'Tú')]
        .filter(Boolean).map((el) => <span role="listitem" key={el.key}>{el}</span>)}
    </div>
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

function Fila({ it, onClick }) {
  const f = filaCercana(it)
  return (
    <li>
      <button type="button" className={'row mp-row' + (it.clase === 'riesgo' ? ' mp-row--risk' : '')} onClick={onClick}>
        <span className={'row-swatch ' + f.cls}><span className="mp-pill">{f.lvl}</span></span>
        <span className="mp-row-tx"><span className="mp-row-t">{f.t}</span><span className="mp-row-m">{f.m}</span></span>
        <Icon name="chevron" size={20} />
      </button>
    </li>
  )
}

function ListaCercana({ datos, onCalmaAvisos }) {
  const { ir } = useApp()
  if (datos.cargando) return <p className="mp-cargando" role="status">Cargando lo cercano…</p>
  if (!datos.items.length) {
    return (
      <div className="mp-calma">
        <b>No hay inundaciones activas cerca</b>
        <p>Te avisamos solo si algo cambia en {datos.municipio}. Puedes guardar el celular.</p>
        <button type="button" className="mp-btn-acc" onClick={onCalmaAvisos}>Elegir de dónde quiero avisos</button>
      </div>
    )
  }
  return <ul className="mp-list">{datos.items.map((it) => <Fila key={it.id} it={it} onClick={() => abrirItem(ir, it)} />)}</ul>
}

// ---------- Barra superior (móvil) ----------
export function TopBar() {
  const { ir, setSheet } = useApp()
  const datos = useDatosMapa()
  const { estado, medio } = datos
  const sub = datos.error ? mensajeError(datos.error).titulo : estado.sub
  const alTocarEstado = () => (estado.zona ? ir('zona', { zona: estado.zona }) : setSheet('mid'))
  return (
    <div className="mp-top">
      <div className="only-mobile mp-top" style={{ gap: 8 }}>
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
        <Leyenda />
        <button type="button" className="btn-a11y mp-a11y" onClick={() => ir('ajustes')}>
          <span className="mp-mode-ico mp-a11y-ico"><Icon name="accesibilidad" size={22} stroke={2.4} /></span>
          Accesibilidad
        </button>
      </div>
      <div className="only-desk"><Leyenda desk /></div>
    </div>
  )
}

// ---------- Hoja inferior (móvil) ----------
export function Hoja() {
  const { ir, sheet, setSheet } = useApp()
  const datos = useDatosMapa()
  const n = datos.items.length

  if (sheet === 'full') {
    return (
      <div className="mp-full">
        <button type="button" className="mp-verlista" onClick={() => setSheet('mid')}><Icon name="lista" size={22} />Ver lista</button>
        <BtnReportar onClick={() => ir('tipo')} />
      </div>
    )
  }

  if (sheet === 'mid') {
    return (
      <section className="sheet mp-sheet rise" aria-label="Lo cercano">
        <button type="button" className="mp-handle mp-handle--solo" aria-label="Ocultar lista" onClick={() => setSheet('min')}>
          <span className="sheet-handle" />
        </button>
        <div className="mp-mid-head">
          <h2 className="mp-mid-title">{datos.titulo}</h2>
          <button type="button" className="mp-btn-sm" onClick={() => setSheet('full')}>Mapa completo</button>
        </div>
        <ListaCercana datos={datos} onCalmaAvisos={() => ir('alertas')} />
        <BtnReportar onClick={() => ir('tipo')} />
      </section>
    )
  }

  return (
    <section className="sheet mp-sheet" aria-label="Acciones">
      <button type="button" className="mp-handle" onClick={() => setSheet('mid')} aria-expanded="false">
        <span className="sheet-handle" />
        <span>{n ? `Ver lo cercano · ${n}` : 'Ver lo cercano'}</span>
      </button>
      <div className="mp-row3">
        <button type="button" className="btn" onClick={() => ir('acudo')}>¿A quién acudo?</button>
        <button type="button" className="btn" onClick={() => ir('refugios')}>Refugios</button>
        <button type="button" className="btn" onClick={() => setSheet('full')}>Mapa completo</button>
      </div>
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
      <h2 className="mp-side-h">Lo cercano</h2>
      <ListaCercana datos={datos} onCalmaAvisos={() => ir('alertas')} />
      <div className="mp-side-fill" />
      <BtnReportar invertido onClick={() => ir('tipo')} />
    </div>
  )
}

// ---------- Encabezado (escritorio) ----------
export function DeskHeader() {
  const { ir, screen } = useApp()
  const nav = [[null, 'Mapa'], ['acudo', '¿A quién acudo?'], ['refugios', 'Refugios'], ['alertas', 'Avisos']]
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

// ---------- Detalle de zona (params {zona} o {reporte}) ----------
const TIPO_TXT = { calle: 'Calle inundada', casa: 'Casa inundada', coche: 'Coche en el agua', persona_en_riesgo: 'Persona en riesgo' }

function describir({ zona, reporte }) {
  if (zona) {
    const alto = zona.nivel === 'alto' || zona.alguno_no_pasan_carros
    return {
      punto: zona, titulo: 'Calle inundada', cls: 'p-' + zona.nivel, lvl: textoNivel(zona.nivel),
      consejo: alto ? 'No pasan carros · no cruces'
        : zona.nivel === 'medio' ? 'Agua a media llanta o a la rodilla · mejor espera' : 'Hay agua · se puede pasar con cuidado',
      stats: [[zona.total_reportes ?? 0, 'reportes'], [zona.total_confirmaciones ?? 0, 'confirmaciones'],
        [hace(zona.actualizado_en) || '—', 'actualizado', true]],
      riesgo: false, reporteId: null,
      share: `Calle inundada, nivel ${textoNivel(zona.nivel)}${alto ? ', no pasan carros' : ''}`,
    }
  }
  const riesgo = reporte.tipo === 'persona_en_riesgo'
  const carros = reporte.pasan_carros === false ? 'No pasan carros' : reporte.pasan_carros === true ? 'Pasan carros' : 'Sin dato de carros'
  return {
    punto: reporte, titulo: TIPO_TXT[reporte.tipo] || 'Reporte activo', cls: riesgo ? 'c-risk' : 'c-res',
    lvl: riesgo ? 'Persona en riesgo' : 'Reporte activo',
    consejo: riesgo ? 'Si la ves, llama al 911 · no entres al agua' : carros,
    stats: [[1, 'reporte'], [carros, '', true], [hace(reporte.ultima_confirmacion || reporte.creado_en) || '—', 'últ. confirmación', true]],
    riesgo, reporteId: reporte.id,
    share: riesgo ? 'Persona en riesgo por inundación. Si la ves, llama al 911' : TIPO_TXT[reporte.tipo] || 'Inundación reportada',
  }
}

export function Zona() {
  const { params, ubic, setOverlay, version } = useApp()
  const dato = params?.zona || params?.reporte ? describir(params) : null
  const dist = dato ? distanciaM(ubic, dato.punto) : Infinity
  const cerca = dist <= RADIO_TU_ZONA_M
  const [aConfirmar, setAConfirmar] = useState(null)

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
      <Screen titulo="Zona" label="Detalle de zona">
        <p className="muted">Esta zona ya no está en el mapa. Puede que se haya despejado.</p>
      </Screen>
    )
  }
  const { lat, lng } = dato.punto
  return (
    <Screen label={`Detalle: ${dato.titulo}`} titulo={null}>
      <div style={{ marginTop: -8 }}>
        {Number.isFinite(dist) && <div className="mp-z-dist">{formatoDist(dist)} de ti</div>}
        <h1 className="mp-z-t">{dato.titulo}</h1>
      </div>
      <div className={'mp-z-nivel ' + dato.cls}>
        <span className="mp-z-lvl">{dato.lvl}</span>
        <span className="mp-z-consejo">{dato.consejo}</span>
      </div>
      <div className="mp-z-stats">
        {dato.stats.map(([v, lab, chico], i) => (
          <div className="mp-z-stat" key={i}>
            <div className={chico ? 'mp-z-num mp-z-num--sm' : 'mp-z-num'}>{v}</div>
            {lab && <div className="mp-z-lab">{lab}</div>}
          </div>
        ))}
      </div>
      {dato.riesgo && <a className="mp-link mp-link--911" href="tel:911"><Icon name="telefono" />Llamar al 911</a>}
      {cerca && aConfirmar && (
        <button type="button" className="btn-outline-acc" onClick={() => setOverlay({ tipo: 'confirm', reporte: aConfirmar })}>
          Estoy aquí: confirmar si sigue
        </button>
      )}
      <a className="mp-link mp-link--acc" href={textoWhatsApp({ titulo: dato.share, lat, lng })} target="_blank" rel="noopener noreferrer">
        <Icon name="compartir" />Compartir por WhatsApp
      </a>
      {!dato.riesgo && (
        <a className="mp-link mp-link--line" href={rutaGoogle(lat, lng)} target="_blank" rel="noopener noreferrer">
          <Icon name="mapa" />Ruta alterna (abre Google Maps)
        </a>
      )}
      <p className="mp-z-priv">No mostramos quién lo reportó.</p>
    </Screen>
  )
}
