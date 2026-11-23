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
  textoWhatsApp, reporteParaConfirmar, textoNivel, RADIO_TU_ZONA_M, nivelV2, categoria, transito,
  leerCapas, suscribirCapas, cambiarCapa, restablecerCapas, capasModificadas, filtrarCapas,
  centrarEn, partirLugar, resumenNiveles, zonasConNivelAgua, nivelAgua,
  filtrosActivos, textoFiltros, etiquetaMedio, avisoMedio, abrirPanel, leerPanel, suscribirPanel, enfocarEn,
  categoriaBase, verificacion,
} from '../lib/mapa.js'
import { hablar } from '../lib/confirmar.js'
import { fraseEstado, ubicacionReal } from '../lib/vozAlertas.js'
import { useArrastreHoja } from '../lib/hoja.js'
import { pedirRutas, leerRutas, suscribirRuta, rutasPara, rutaActiva, elegirRuta, verRutaEnMapa, olvidarSiOtroDestino, debeRecalcular, claveDestino } from '../lib/rutas.js'
import { avisoCorto, sugerenciasSinResultado, vistaLugar, encabezadoLugar, estadoCaminoDestino, POPULARES } from '../lib/buscar.js'
import '../styles/buscar.css'
import { etiquetaPin } from '../lib/pines.js'
import NivelAgua from '../components/NivelAgua.jsx'
import {
  simularInundacion, quitarSimulaciones, leerSimulacion, suscribirSimulacion, ESCENARIOS, cargarEscenario, haySimulacion,
  AVISO_CARGAR_SIM, AVISO_QUITAR_SIM,
} from '../lib/simulacion.js'
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
      zonas: zonasConNivelAgua(z.data || [], r.data || []), // D-029: nivel = altura del agua
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

const abrirItem = (ir, it) => {
  enfocarEn(it.dato) // escritorio: el pin queda en la parte del mapa que no tapa el panel
  return it.clase === 'riesgo' ? ir('zona', { reporte: it.dato }) : ir('zona', { zona: it.dato })
}

// ---------- Piezas ----------
// Mismo ícono por tipo en el mapa (pin), la lista "Cerca de ti", la tarjeta y la leyenda (testeo: "persona en
// riesgo" cambiaba de forma). Círculo del color del tipo + ícono; el nivel va aparte (letra y patrón).
const ICONO_TIPO = { calle: 'calle', casa: 'casa', coche: 'coche', persona_en_riesgo: 'riesgo' }
export function IconoTipo({ tipo, size = 36, nivel }) {
  if (!ICONO_TIPO[tipo]) return null
  const letra = { bajo: 'B', medio: 'M', alto: 'A', critico: 'A' }[nivel]
  return (
    <span className={'mp-tipo mp-tipo--' + tipo} style={{ width: size, height: size }} aria-hidden="true">
      <Icon name={ICONO_TIPO[tipo]} size={Math.round(size * 0.6)} stroke={2.4} />
      {letra && tipo !== 'persona_en_riesgo' && <span className={'mp-tipo-niv p-' + (nivel === 'critico' ? 'alto' : nivel)}><b>{letra}</b></span>}
    </span>
  )
}
const LETRA = { bajo: 'B', medio: 'M', alto: 'A' }
const SwNivel = ({ n }) => <span className={'mp-sw mp-sw--letra p-' + n} aria-hidden="true"><b>{LETRA[n]}</b></span>
export const EtiquetaSim = () => <span className="mp-simtag">Simulación</span>

function Leyenda({ desk = false }) {
  const it = (cls, txt) => <span className="legend-item" key={txt}><span className={cls} aria-hidden="true" />{txt}</span>
  return (
    <div className="mp-legend-row">
      <div className="mp-legend" role="list" aria-label="Leyenda del mapa">
        {[it('mp-sw p-bajo', 'Bajo'), it('mp-sw p-medio', 'Medio'), it('mp-sw p-alto', 'Alto'),
          desk ? it('mp-sw--risk', 'Persona en riesgo') : null, it('mp-sw--pend', 'Sin confirmar'), desk ? null : it('mp-sw--tu', 'Tú')]
          .filter(Boolean).map((el) => <span role="listitem" key={el.key}>{el}</span>)}
      </div>
      <BotonesPanel />
    </div>
  )
}

// Dos accesos separados (testeo: "Leyenda y filtros" mezclaba funciones; 2 de 10 no encontraron el filtro).
function BotonesPanel({ sm = false }) {
  const capas = useSyncExternalStore(suscribirCapas, leerCapas)
  const n = filtrosActivos(capas)
  const cls = 'mp-capas-btn' + (sm ? ' mp-capas-btn--sm' : '')
  return (
    <>
      <button type="button" className={cls} onClick={() => abrirPanel('leyenda')} aria-haspopup="dialog">
        <Icon name="lista" size={20} />Leyenda
      </button>
      <button type="button" className={cls + (n ? ' mp-capas-btn--on' : '')} onClick={() => abrirPanel('filtros')} aria-haspopup="dialog">
        <IcoFiltro />{n ? textoFiltros(n) : 'Filtrar'}
      </button>
      {n > 0 && (
        <button type="button" className={cls + ' mp-capas-btn--todos'} onClick={restablecerCapas}>Ver todos</button>
      )}
    </>
  )
}

// Mini leyenda fija en una esquina del mapa: letras de nivel y qué significan; un toque abre la leyenda completa.
function MiniLeyenda() {
  return (
    <button type="button" className="mp-minileyenda" onClick={() => abrirPanel('leyenda')} aria-label="Abrir la leyenda del mapa. B: el agua no pasa de la banqueta. M: a media llanta. A: cubre la llanta.">
      <span><SwNivel n="bajo" />Banqueta</span>
      <span><SwNivel n="medio" />Media llanta</span>
      <span><SwNivel n="alto" />Cubre llanta</span>
      <span className="mp-minileyenda-mas">Leyenda<Icon name="chevron" size={14} stroke={2.6} /></span>
    </button>
  )
}

const IcoFiltro = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 5h16l-6 7.5V19l-4 2v-8.5z" />
  </svg>
)

// ---------- Panel: "Leyenda del mapa" y "Filtrar reportes" en pestañas separadas ----------
const NIVELES_UI = [['bajo', 'Bajo', 'Banqueta'], ['medio', 'Medio', 'Media llanta'], ['alto', 'Alto', 'Cubre la llanta']] // D-029

// Leyenda de símbolos (la usan el panel y "Más"). Íconos iguales a los del mapa.
export function LeyendaSimbolos() {
  const fila = (sw, t, d) => (
    <li key={t}>{sw}<b>{t}</b><span>{d}</span></li>
  )
  const sw = (cls) => <span className={cls} aria-hidden="true" />
  return (
    <>
      <h4 className="mp-ley-h">Tipo de reporte · ícono del pin</h4>
      <ul className="mp-capas-sim">
        {fila(<IconoTipo tipo="calle" size={28} />, 'Calle inundada', 'Agua en la calle o la banqueta')}
        {fila(<IconoTipo tipo="casa" size={28} />, 'Casa inundada', 'Entró agua a una casa o local')}
        {fila(<IconoTipo tipo="coche" size={28} />, 'Coche atrapado', 'Un vehículo quedó en el agua')}
        {fila(<IconoTipo tipo="persona_en_riesgo" size={28} />, 'Persona en riesgo', 'Alguien necesita ayuda · llama al 911')}
      </ul>
      <h4 className="mp-ley-h">Nivel del agua · aro y letra del pin</h4>
      <ul className="mp-capas-sim">
        {fila(<SwNivel n="bajo" />, 'B · Bajo', 'El agua no sube de la banqueta')}
        {fila(<SwNivel n="medio" />, 'M · Medio', 'Llega a media llanta')}
        {fila(<SwNivel n="alto" />, 'A · Alto', 'Cubre la llanta: no pasan carros')}
      </ul>
      <h4 className="mp-ley-h">Otros símbolos</h4>
      <ul className="mp-capas-sim">
        {fila(sw('mp-sw--ref'), 'Refugio', 'Lugar para resguardarte')}
        {fila(sw('mp-sw--pend'), 'Sin confirmar', 'Tu reporte: aún nadie lo confirma (no quiere decir menos riesgo)')}
        {fila(sw('mp-sw--tu'), 'Tu ubicación', 'Punto con anillo de 300 m. Sin permiso de ubicación es un punto de ejemplo')}
        {fila(sw('mp-sw--lugar'), 'Lugar buscado', 'El punto que elegiste en Buscar')}
        {fila(sw('mp-sw--sim'), 'Simulación', 'Borde punteado: datos de práctica que solo ves tú')}
      </ul>
    </>
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

function Interruptor({ k, t, d, sw, capas }) {
  return (
    <li>
      <button type="button" role="switch" aria-checked={capas[k]} className="mp-capa" onClick={() => cambiarCapa(k)}>
        {sw}
        <span className="mp-capa-tx"><b>{t}</b><span>{d}</span></span>
        <span className="mp-capa-r">{capas[k] ? 'Sí' : 'No'}<span className="switch" aria-hidden="true"><i /></span></span>
      </button>
    </li>
  )
}

function PanelCapas({ pestana, onCerrar, fuenteLluvia }) {
  const capas = useSyncExternalStore(suscribirCapas, leerCapas)
  const n = filtrosActivos(capas)
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
  const filtros = pestana === 'filtros'
  const tab = (k, t) => (
    <button type="button" role="tab" id={'mp-tab-' + k} aria-selected={pestana === k} aria-controls="mp-capas-cuerpo"
      className="mp-tab" onClick={() => abrirPanel(k)}>{t}{k === 'filtros' && n > 0 && <span className="mp-tab-n">{n}</span>}</button>
  )
  return createPortal(
    <div className="mp-capas-fondo" onClick={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <section className="mp-capas" role="dialog" aria-modal="true" aria-labelledby="mp-capas-t">
        <div className="mp-capas-head">
          <h2 id="mp-capas-t">{filtros ? 'Filtrar reportes' : 'Leyenda del mapa'}</h2>
          <button ref={cerrarRef} type="button" className="mp-capas-x" onClick={onCerrar} aria-label="Cerrar">
            <Icon name="cerrar" size={22} />
          </button>
        </div>
        <div className="mp-tabs" role="tablist" aria-label="Leyenda o filtros">
          {tab('leyenda', 'Leyenda del mapa')}{tab('filtros', 'Filtrar reportes')}
        </div>
        {/* Solo el cuerpo se desplaza (testeo: en el celular el panel "no me deja" bajar) */}
        <div className="mp-capas-cuerpo" id="mp-capas-cuerpo" role="tabpanel" aria-labelledby={'mp-tab-' + pestana}>
          {filtros ? (
            <>
              <p className="mp-capas-nota">Elige qué ver en el mapa y en la lista. Tu zona te sigue avisando de todo, aunque ocultes algo.</p>
              <h3 className="mp-capas-h overline" id="mp-niv-t">Nivel del agua</h3>
              <div className="mp-chips" role="group" aria-labelledby="mp-niv-t">
                {NIVELES_UI.map(([k, t, d]) => (
                  <button key={k} type="button" className="mp-chip" aria-pressed={capas[k]} onClick={() => cambiarCapa(k)}>
                    <SwNivel n={k} />{capas[k] && <Icon name="check" size={16} stroke={3} />}<span>{t}<small>{d}</small></span>
                  </button>
                ))}
              </div>
              <h3 className="mp-capas-h overline">Tipo de reporte</h3>
              <ul className="mp-capas-lista">
                <Interruptor k="riesgo" t="Persona en riesgo" d="Alguien necesita ayuda · llama al 911" sw={<IconoTipo tipo="persona_en_riesgo" size={28} />} capas={capas} />
              </ul>
              <h3 className="mp-capas-h overline">Estado de verificación</h3>
              <ul className="mp-capas-lista">
                <Interruptor k="misReportes" t="Mis reportes sin confirmar" d="Aún nadie lo confirma. No quiere decir menos riesgo" sw={<span className="mp-sw--pend" aria-hidden="true" />} capas={capas} />
              </ul>
              <h3 className="mp-capas-h overline">Lugares</h3>
              <ul className="mp-capas-lista">
                <Interruptor k="refugios" t="Refugios" d="Lugares para resguardarte" sw={<span className="mp-sw--ref" aria-hidden="true" />} capas={capas} />
              </ul>
            </>
          ) : (
            <>
              <LeyendaSimbolos />
              <button type="button" role="switch" aria-checked={dalton} className="mp-capa mp-capa--dalton" onClick={alternarDalton}>
                <span className="mp-capa-tx"><b>Modo para daltonismo</b><span>Colores azul → naranja, sin rojo ni verde</span></span>
                <span className="mp-capa-r">{dalton ? 'Sí' : 'No'}<span className="switch" aria-hidden="true"><i /></span></span>
              </button>
              <h3 className="mp-capas-h overline">Fuentes</h3>
              <Fuentes fuenteLluvia={fuenteLluvia} />
            </>
          )}
        </div>
        {filtros && (
          <div className="mp-capas-acc">
            <button type="button" className="btn" onClick={restablecerCapas} disabled={!n}>Ver todos</button>
            <button type="button" className="btn btn-primary mp-btn-prim" onClick={onCerrar}>Listo</button>
          </div>
        )}
      </section>
    </div>,
    document.body,
  )
}

// Panel montado una sola vez (en TopBar); lo abren la barra, la mini leyenda y "Más".
function PanelMapa({ fuenteLluvia }) {
  const p = useSyncExternalStore(suscribirPanel, leerPanel)
  const cerrar = useCallback(() => abrirPanel(null), [])
  return p ? <PanelCapas pestana={p} onCerrar={cerrar} fuenteLluvia={fuenteLluvia} /> : null
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
// Nivel de riesgo y estado de verificación con su propia etiqueta (testeo: "Sin confirmar" ≠ menos riesgo).
const EtqNivel = ({ f }) => <span className="mp-badge mp-badge--nivel"><small>Nivel de riesgo</small>{f.tipo === 'persona_en_riesgo' ? 'Persona en riesgo' : f.lvl}</span>
const EtqVerif = ({ v }) => v ? (
  <span className={'mp-badge mp-badge--' + (v.cls === 'ok' ? 'ok' : 'sin')}><small>Verificación</small>{v.cls === 'ok' && <Icon name="escudo" size={14} stroke={2.4} />}{v.txt}</span>
) : null

function Fila({ it, onClick, desde }) {
  const f = filaCercana(it, Date.now(), desde)
  return (
    <li>
      <button type="button" className={'row mp-row' + (it.clase === 'riesgo' ? ' mp-row--risk' : '') + (f.sim ? ' mp-row--sim' : '')} onClick={onClick}
        aria-label={[f.sim && 'Simulación', f.t, f.lugar, 'Nivel de riesgo: ' + (f.tipo === 'persona_en_riesgo' ? 'persona en riesgo' : f.lvl), f.transito?.txt, 'Verificación: ' + f.verif.txt, f.m].filter(Boolean).join(', ')}>
        {f.tipo ? <IconoTipo tipo={f.tipo} nivel={it.clase === 'riesgo' ? null : it.dato.nivel} size={44} />
          : <span className={'row-swatch ' + f.cls}><span className="mp-pill">{f.lvl}</span></span>}
        <span className="mp-row-tx">
          {f.sim && <EtiquetaSim />}
          <span className="mp-row-t">{f.t}</span>
          <span className="mp-row-l">{f.lugar}</span>
          <span className="mp-badges"><EtqNivel f={f} /><Badge t={f.transito} /><EtqVerif v={f.verif} /></span>
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
        <b>Nada que mostrar con tus filtros</b>
        <p>Ocultaste algunos reportes. Tu zona te sigue avisando de todo.</p>
        <button type="button" className="mp-btn-acc" onClick={restablecerCapas}>Ver todos</button>
      </div>
    )
  }
  if (!datos.items.length) {
    return (
      <div className="mp-calma">
        <b>Sin reportes registrados cerca</b>
        <p>Sin reportes no significa sin riesgo: si ves agua en la calle, no cruces. Te avisamos si alguien reporta algo en {datos.municipio}.</p>
        <button type="button" className="mp-btn-acc" onClick={onCalmaAvisos}>Elegir de dónde quiero avisos</button>
      </div>
    )
  }
  return <ul className="mp-list">{datos.items.map((it) => <Fila key={it.id} it={it} onClick={() => abrirItem(ir, it)} />)}</ul>
}

// Avisos fijos sobre el mapa: modo práctica (simulaciones) y punto de ejemplo (sin permiso de ubicación).
function AvisoPractica() {
  const { refrescar, avisar } = useApp()
  useSyncExternalStore(suscribirSimulacion, leerSimulacion)
  if (!haySimulacion()) return null
  return (
    <div className="mp-practica" role="status">
      <span><b>Modo práctica</b> · datos falsos</span>
      <button type="button" onClick={() => { quitarSimulaciones(); refrescar(); avisar(AVISO_QUITAR_SIM) }}>Quitar simulaciones</button>
    </div>
  )
}

function useUsarUbicacion() {
  const { pedirUbicacion, avisar } = useApp()
  return async () => {
    const u = await pedirUbicacion().catch(() => null)
    if (!u?.real) avisar('No pudimos usar tu ubicación. Revisa el permiso de ubicación de tu navegador.')
  }
}
function AvisoEjemplo() {
  const { ubic } = useApp()
  const usar = useUsarUbicacion()
  if (ubic.real !== false) return null
  return (
    <div className="mp-ejemplo-bar">
      <span>Estás viendo un <b>punto de ejemplo</b>, no tu ubicación.</span>
      <button type="button" onClick={usar}><Icon name="centrar" size={18} />Usar mi ubicación</button>
    </div>
  )
}

// Tarjeta de estado (barra superior y sidebar). Nombra la zona, avisa que sin reportes no es sin riesgo.
function EstadoTx({ datos }) {
  const { estado } = datos
  const sub = datos.error ? mensajeError(datos.error).titulo : estado.sub
  if (datos.cargando) return <span className="mp-frase">Buscando reportes…</span>
  return (
    <>
      {estado.donde && (
        <span className="mp-donde">
          <b>{estado.donde}</b>
          {!estado.ejemplo && <span className="mp-priv"><Icon name="escudo" size={13} stroke={2.4} />Ubicación aproximada · no la guardamos</span>}
        </span>
      )}
      <span className={'mp-frase' + (estado.calma ? ' mp-frase--calma' : '')}>{estado.frase}</span>
      {estado.aviso && <span className="mp-aviso-riesgo"><Icon name="alerta" size={14} stroke={2.4} />{estado.aviso}</span>}
      {sub && <span className="mp-sub">{sub}</span>}
    </>
  )
}

// ---------- Barra superior (móvil) ----------
export function TopBar() {
  const { ir, setSheet, prefs, pedirUbicacion, avisar } = useApp()
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
  const alTocarEstado = () => (estado.zona ? ir('zona', { zona: estado.zona }) : setSheet('mid'))
  // Aviso breve al cambiar cómo se mueve (testeo: no se notaba que el selector cambia las alertas).
  const medioPrevio = useRef(medio)
  useEffect(() => {
    if (medioPrevio.current !== medio) avisar(avisoMedio(medio))
    medioPrevio.current = medio
  }, [medio]) // eslint-disable-line
  return (
    <div className="mp-top">
      <AvisoPractica />
      <div className="only-mobile mp-top" style={{ gap: 8 }}>
        <div className="mp-top-row">
          <button type="button" className="mp-search" onClick={() => ir('buscar')}>
            <IcoLupa /><span>Buscar dirección, colonia o lugar</span>
          </button>
          {/* "Más" vive ahora en la barra de abajo (D-030) */}
          {prefs.voz && (
            <button type="button" className="mp-mas" disabled={datos.cargando} aria-label="Escuchar el estado de tu zona"
              onClick={escuchar}>
              <Icon name="voz" />
            </button>
          )}
        </div>
        <div className="mp-top-row">
          {/* Ícono + texto del medio actual (testeo: 4 de 10 no encontraron el selector) */}
          <button type="button" className="top-mode mp-mode mp-mode--sm" onClick={() => ir('onb')}
            aria-label={`Cómo me muevo hoy: ${etiquetaMedio(medio)}. Cambiar`}>
            <span className="mp-mode-ico"><Icon name={['peaton', 'moto', 'bici', 'auto', 'transporte_publico'].includes(medio) ? medio : 'peaton'} /></span>
            <span className="mp-mode-tx">{etiquetaMedio(medio)}</span>
          </button>
          <button type="button" className="top-status mp-status" onClick={alTocarEstado} aria-live="polite">
            {datos.lluvia && <span className="mp-rain"><Icon name="lluvia" size={15} stroke={2.4} />{datos.lluvia}</span>}
            <EstadoTx datos={datos} />
          </button>
        </div>
        <div className="mp-top-row mp-top-row--chips">
          <BotonesPanel sm />
          {/* Accesibilidad siempre a un toque (humo 2026-11-11: "se perdió la parte de accesibilidad") */}
          <button type="button" className="mp-capas-btn mp-capas-btn--sm" onClick={() => ir('ajustes')}>
            <Icon name="accesibilidad" size={20} />Accesibilidad
          </button>
        </div>
      </div>
      <div className="only-desk"><Leyenda desk /></div>
      <AvisoEjemplo />
      <PanelMapa fuenteLluvia={datos.fuenteLluvia} />
    </div>
  )
}

const IcoLupa = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
  </svg>
)

// Tarjeta de lo más cercano (D-028): dibujo de hasta dónde llega el agua + datos clave, sin repetir el título.
function TarjetaCercana({ it, onClick }) {
  const f = filaCercana(it)
  const riesgo = it.clase === 'riesgo'
  const nivel = riesgo ? null : nivelV2(it.dato)
  return (
    <button type="button" className={'mp-near' + (riesgo ? ' mp-near--riesgo' : '') + (f.sim ? ' mp-near--sim' : '')} onClick={onClick}
      aria-label={[f.sim && 'Simulación', `Lo más cerca de ti: ${f.t}`, f.lugar, 'Nivel de riesgo: ' + (riesgo ? 'persona en riesgo' : f.lvl), f.transito?.txt, 'Verificación: ' + f.verif.txt, f.m].filter(Boolean).join(', ')}>
      <span className={'mp-near-art' + (nivel ? ' p-' + nivel : '')} aria-hidden="true">
        {riesgo ? <IconoTipo tipo="persona_en_riesgo" size={52} />
          : <>
            <NivelAgua nivel={nivel === 'critico' ? 'alto' : nivel} size={64} />
            {f.tipo && <span className="mp-near-tipo"><IconoTipo tipo={f.tipo} size={28} /></span>}
          </>}
      </span>
      <span className="mp-row-tx">
        {f.sim && <EtiquetaSim />}
        <span className="overline mp-near-o">Lo más cerca · {f.lugar.replace(/^A /, 'a ')}</span>
        <span className="mp-row-t">{f.t}</span>
        <span className="mp-badges"><EtqNivel f={f} /><Badge t={f.transito} /><EtqVerif v={f.verif} /></span>
        {f.m && <span className="mp-row-m">{f.m}</span>}
      </span>
      <Icon name="chevron" size={20} />
    </button>
  )
}

const RESUMEN_TXT = { riesgo: 'en riesgo', critico: 'crítico', alto: 'alto', medio: 'medio', bajo: 'bajo' }
function ResumenNiveles({ items }) {
  const r = resumenNiveles(items)
  if (!r.length) return <span className="mp-resumen mp-resumen--calma">Sin reportes registrados</span>
  return (
    <span className="mp-resumen">
      {r.map(([k, n]) => (
        <span key={k} className="mp-res-pill">
          {k === 'riesgo' ? <IconoTipo tipo="persona_en_riesgo" size={18} /> : <SwNivel n={k === 'critico' ? 'alto' : k} />}
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
        <MiniLeyenda />
        <button type="button" className="mp-handle mp-handle--solo mp-handle--full" aria-label="Mostrar alertas cercanas" onClick={() => setSheet('min')}>
          <span className="sheet-handle" />
        </button>
        <button type="button" className="mp-verlista mp-verlista--pill" onClick={() => setSheet('mid')}>
          <Icon name="lista" size={22} />{n ? `Ver alertas cercanas · ${n}` : 'Ver alertas cercanas'}
        </button>
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
              <p className="mp-mid-sub">Reportes cerca de ti · nivel de riesgo y verificación por separado</p>
            </div>
          </div>
        </div>
        <ListaCercana datos={datos} onCalmaAvisos={() => ir('alertas')} />
      </section>
    )
  }

  return (
    <section className="sheet mp-sheet mp-arrastre" aria-label="Acciones" {...arrastre}>
      <MiniLeyenda />
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
      {/* Reportar = botón "+" de la barra de abajo (D-030) */}
    </section>
  )
}

// ---------- Sidebar (escritorio) ----------
export function Sidebar() {
  const { ir } = useApp()
  const datos = useDatosMapa()
  const { estado } = datos
  return (
    <div className="mp-side" style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
      {datos.lluvia && <div className="mp-rain mp-side-rain"><Icon name="lluvia" size={18} />{datos.lluvia}</div>}
      <button type="button" className="mp-side-card" aria-live="polite"
        onClick={() => estado.zona && ir('zona', { zona: estado.zona })} disabled={!estado.zona}
        style={{ cursor: estado.zona ? 'pointer' : 'default' }}>
        <EstadoTx datos={datos} />
        {!datos.cargando && !estado.calma && estado.hora && <span className="mp-sub">{estado.hora}</span>}
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

const personas = (n) => `${n ?? 0} ${n === 1 ? 'persona' : 'personas'}`

function describir({ zona, reporte }) {
  if (zona) {
    const tr = transito(zona)
    return {
      punto: zona, titulo: categoriaBase(zona), sim: !!zona.simulada, tipo: zona.tipo || null, cls: 'p-' + zona.nivel, lvl: textoNivel(zona.nivel),
      consejo: tr.cls === 'no' ? 'No transitable · no cruces' : 'Pasan carros con precaución',
      transito: tr, verif: verificacion(zona),
      filas: [['Altura del agua', textoNivel(zona.nivel)], ['Confirmado por', personas(zona.total_confirmaciones)], ['Reportes en la zona', zona.total_reportes ?? 0]],
      reportado: null, actualizado: zona.actualizado_en,
      riesgo: false, reporteId: null, consejos: QUE_HACER[tr.cls], agua: zona.nivel,
      share: `${categoria(zona)}, riesgo ${textoNivel(zona.nivel).toLowerCase()}${tr.cls === 'no' ? ', no transitable' : ''}`,
    }
  }
  const riesgo = reporte.tipo === 'persona_en_riesgo'
  const tr = transito(reporte)
  const nivel = nivelAgua(reporte) || (reporte.nivel ? (nivelV2(reporte) === 'critico' ? 'alto' : nivelV2(reporte)) : null) // D-029
  return {
    punto: reporte, titulo: categoriaBase(reporte), sim: !!reporte.simulada, tipo: reporte.tipo || null,
    cls: riesgo ? 'c-risk' : nivel ? 'p-' + nivel : 'c-res',
    lvl: riesgo ? 'Persona en riesgo' : nivel ? textoNivel(nivel) : 'Sin dato de altura',
    consejo: riesgo ? 'Llama al 911 · no entres al agua' : tr.cls === 'no' ? 'No transitable · no cruces' : tr.txt,
    transito: riesgo ? null : tr, verif: verificacion(reporte),
    filas: [nivel && !riesgo && ['Altura del agua', textoNivel(nivel)],
      Number.isFinite(reporte.confirmaciones_si) && ['Confirmado por', personas(reporte.confirmaciones_si)]].filter(Boolean),
    reportado: reporte.creado_en, actualizado: reporte.ultima_confirmacion || reporte.creado_en,
    riesgo, reporteId: reporte.id, consejos: QUE_HACER[riesgo ? 'riesgo' : tr.cls], agua: riesgo ? null : nivel,
    share: (reporte.simulada ? 'Simulación · ' : '') + (riesgo ? 'Persona en riesgo por inundación. Si la ves, llama al 911' : categoriaBase(reporte)),
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
  const { params, ubic, setOverlay, version, ir, setSheet } = useApp()
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
  // Testeo: al volver al mapa el pin queda en la parte visible (no debajo de la hoja ni del panel).
  const verEnMapa = () => {
    if (!dato.reporteId) centrarEn({ lat, lng, nombre: dato.titulo }) // las zonas no tienen pin propio: se marca el punto
    setSheet('min'); ir(null); enfocarEn({ lat, lng })
  }
  const actualizado = hace(dato.actualizado)
  return (
    <Screen label={`Detalle de alerta: ${dato.sim ? 'simulación, ' : ''}${dato.titulo}`} titulo={null}>
      {dato.sim && <EtiquetaSim />}
      <div className="mp-z-head">
        {dato.tipo && <IconoTipo tipo={dato.tipo} size={40} />}
        <h1 className="mp-z-t">{dato.titulo}</h1>
      </div>
      <div className="mp-z-lugar">
        <b className="mp-z-calle">{direccion || 'Ubicación aproximada'}</b>
        {Number.isFinite(dist) && <span>{formatoDist(dist)} de ti{actualizado ? ` · Actualizado ${actualizado}` : ''}</span>}
      </div>
      {/* Jerarquía (testeo): primero qué pasa y qué hacer; el nivel y la verificación, con su etiqueta, debajo. */}
      <div className={'mp-z-nivel ' + dato.cls}>
        <span className="mp-z-consejo">{dato.transito?.cls === 'no' && <IcoProhibido />}{dato.consejo}</span>
        <span className="mp-z-lvl"><small>Nivel de riesgo</small>{dato.lvl}</span>
        {dato.agua && <span className="mp-z-agua"><NivelAgua nivel={dato.agua} size={84} /></span>}
      </div>
      <div className="mp-z-verif">
        <span className="mp-z-etq">Estado de verificación</span>
        <span className={'mp-badge ' + (dato.verif.cls === 'ok' ? 'mp-badge--ok' : 'mp-badge--sin')}>
          {dato.verif.cls === 'ok' && <Icon name="escudo" size={14} stroke={2.4} />}{dato.verif.txt}
        </span>
      </div>

      {dato.riesgo && <a className="mp-link btn-danger mp-link--911" href="tel:911"><Icon name="telefono" />Llamar al 911</a>}

      <section className="mp-card mp-card--acc mp-z-hacer" aria-labelledby="mp-hacer">
        <h2 id="mp-hacer">¿Qué debes hacer?</h2>
        <ul>{dato.consejos.map((c) => <li key={c}>{c}</li>)}</ul>
      </section>

      <a className="mp-link mp-link--wa" href={textoWhatsApp({ titulo: dato.share, lat, lng })} target="_blank" rel="noopener noreferrer">
        <Icon name="compartir" />Compartir por WhatsApp
      </a>
      {cerca && aConfirmar && (
        <button type="button" className="btn-outline-acc" onClick={() => setOverlay({ tipo: 'confirm', reporte: aConfirmar })}>
          Estoy aquí: confirmar si sigue
        </button>
      )}
      {!dato.riesgo && (
        <>
          <button type="button" className="mp-link mp-link--acc" onClick={() => ir('buscar', { destino: { lat, lng, nombre: direccion || dato.titulo } })}>
            <Icon name="mapa" />Cómo llegar · ver rutas
          </button>
          <p className="mp-z-nota">Te mostramos qué reportes hay en cada camino para que elijas el más seguro.</p>
        </>
      )}
      <button type="button" className="btn btn-ghost" onClick={verEnMapa}>Ver en el mapa</button>
      {/* Datos completos plegados (auditoría: la pantalla tenía 5 tarjetas antes de las acciones) */}
      <details className="mp-card mp-det mp-z-datos">
        <summary><h2>Más datos del reporte</h2><Icon name="chevron" size={20} /></summary>
        <div className="mp-det-c">
      <section aria-labelledby="mp-cond">
        <h2 id="mp-cond">Condiciones actuales</h2>
        {dato.transito && <div><Badge t={dato.transito} /></div>}
        <dl className="mp-dl">
          {dato.filas.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </section>

      <section aria-labelledby="mp-info">
        <h2 id="mp-info">Información del reporte</h2>
        <dl className="mp-dl">
          {hora(dato.reportado) && <div><dt>Reportado</dt><dd>{hora(dato.reportado)}</dd></div>}
          <div><dt>Actualizado</dt><dd>{hora(dato.actualizado) || '—'}</dd></div>
          <div><dt>Fuente</dt><dd>{dato.sim ? 'Simulación: solo la ves tú' : 'Reportes ciudadanos anónimos'}</dd></div>
        </dl>
      </section>

        </div>
      </details>
      <p className="mp-z-priv">No mostramos quién lo reportó.</p>
    </Screen>
  )
}

// ---------- Rutas dentro de la app (D-031) ----------
const IcoRuta = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8" />
  </svg>
)
// Medio de transporte activo, cambiable desde el panel (testeo: chip "En auto ▾"). Usa medio/setMedio del store.
const MEDIOS_RUTA = [['peaton', 'A pie'], ['bici', 'En bici'], ['moto', 'En moto'], ['auto', 'En auto'], ['transporte_publico', 'En transporte público']]
const nReportes = (n) => (n ? `${n} reporte${n === 1 ? '' : 's'} en el camino` : 'Sin reportes en el camino')

// rutas = estado ÚNICO de lib/rutas.js (el mismo que dibuja el mapa) o null.
function PanelRutas({ rutas, onVer, real, medio, onMedio }) {
  const chip = (
    <label className="bs-medio">
      <Icon name={MEDIOS_RUTA.some(([k]) => k === medio) ? medio : 'peaton'} size={20} />
      <select value={medio} onChange={(e) => onMedio(e.target.value)} aria-label="Cambiar cómo te mueves">
        {MEDIOS_RUTA.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
      </select>
      <span aria-hidden="true">▾</span>
    </label>
  )
  if (rutas.estado === 'buscando') return <section className="mp-rutas">{chip}<p className="mp-cargando" role="status">Buscando rutas…</p></section>
  if (rutas.estado === 'error' || !rutas.lista.length) {
    return <section className="mp-rutas">{chip}<p className="mp-aviso">No pudimos calcular la ruta. Revisa tu conexión e inténtalo de nuevo.</p></section>
  }
  const r = rutas.lista[rutas.elegida] || rutas.lista[0]
  return (
    <section className="mp-rutas" aria-label="Rutas para llegar">
      <div className="bs-rutas-head"><b>Rutas</b>{chip}</div>
      {!real && <p className="mp-aviso">Sin tu ubicación: la ruta sale del punto de ejemplo del mapa.</p>}
      <div className="mp-rutas-op" role="radiogroup" aria-label="Elige una ruta">
        {rutas.lista.map((x, i) => (
          <button key={i} type="button" role="radio" aria-checked={i === rutas.elegida} className="bs-ruta" onClick={() => elegirRuta(i)}>
            <span className="bs-ruta-linea" aria-hidden="true" />
            <span className="bs-ruta-txt">
              <span className="bs-ruta-1"><b>{x.min} min</b> · {x.km} km{i === rutas.elegida && <span className="bs-ruta-activa">Ruta activa</span>}</span>
              <span className={'mp-ruta-tag' + (x.enCamino.length ? ' mal' : ' bien')}>{nReportes(x.enCamino.length)}</span>
            </span>
          </button>
        ))}
      </div>
      {r.enCamino.length > 0 && (
        <ul className="mp-ruta-alertas" aria-label="Reportes en esta ruta">
          {r.enCamino.map((p) => <li key={p.id}><span className="mp-sw mp-sw--risk" aria-hidden="true" />{etiquetaPin(p)}</li>)}
        </ul>
      )}
      <button type="button" className="btn btn-primary mp-btn-prim" onClick={() => onVer(rutas.elegida)}><Icon name="mapa" />Ver ruta en el mapa</button>
      <details className="mp-pasos">
        <summary>Paso a paso ({r.pasos.length})</summary>
        <ol>{r.pasos.map((p, i) => <li key={i}>{p.texto}{p.m > 0 && <span> · {p.m >= 1000 ? (p.m / 1000).toFixed(1) + ' km' : p.m + ' m'}</span>}</li>)}</ol>
      </details>
      <p className="mp-z-nota">La ruta no esquiva inundaciones sola: revisa los reportes del camino. Tu punto de salida va
        redondeado (~100 m) al servicio de rutas de OpenStreetMap y no lo guardamos.</p>
    </section>
  )
}

// ---------- Buscar un lugar · equipo Mapa, pantalla 4 ----------
// Nombres del equipo como atajos: al tocarlos se buscan en OpenStreetMap (no guardamos coordenadas propias).
// Sin autocompletar (reglas de Nominatim): se busca solo al enviar (Enter o "Buscar") o al tocar un atajo.
// Los apodos ("la Mine") se traducen al nombre oficial en api.buscarLugar (lib/alias.js).
const SUGERENCIAS = POPULARES

export function Buscar() {
  const { ir, params, ubic, medio, setMedio, avisar } = useApp()
  const datos = useDatosMapa()
  const [q, setQ] = useState(params?.q || '')
  const [res, setRes] = useState({ estado: 'vacio', lista: [], q: '' }) // vacio | corto | buscando | listo | error
  const [lugar, setLugar] = useState(params?.destino || null)
  const [repDestino, setRepDestino] = useState([]) // reportes alrededor del destino (puede quedar lejos de ti)
  const todas = useSyncExternalStore(suscribirRuta, leerRutas)
  const rutas = rutasPara(todas, lugar) // solo las de ESTE destino: una sola fuente con el mapa
  const pedido = useRef(0)
  const inputRef = useRef(null)
  const calcularAlCargar = useRef(false)

  async function buscar(v) {
    const texto = textoBusqueda(v)
    const n = ++pedido.current
    if (!texto) { setRes({ estado: v.trim() ? 'corto' : 'vacio', lista: [], q: v }); return }
    setRes((r) => ({ ...r, estado: 'buscando' }))
    let r
    try { r = await buscarLugar(texto) } catch { r = { data: null, error: 'sin_red' } }
    if (n !== pedido.current) return // llegó tarde: ya se buscó otra cosa
    setRes(r.error ? { estado: 'error', lista: [], q: texto } : { estado: 'listo', lista: r.data || [], q: texto })
  }
  useEffect(() => () => { pedido.current++ }, [])
  useEffect(() => { if (!params?.destino) { inputRef.current?.focus(); if (q) buscar(q) } }, []) // eslint-disable-line

  // Un solo destino a la vez: el pin del mapa, el encabezado y las rutas cambian juntos.
  function fijarDestino(l, aviso = true) {
    setLugar(l); centrarEn({ ...l, nombre: vistaLugar(l).nombre }); olvidarSiOtroDestino(l) // pin con el NOMBRE, no la calle
    if (aviso) avisar(`Destino: ${vistaLugar(l).nombre}`)
  }
  // Bug del testeo: el nombre de arriba se quedaba en "Plaza del Sol" al llegar con otro destino. La pantalla no se
  // vuelve a montar si ya estaba abierta, así que se sincroniza con params cada vez que cambia el destino.
  const claveParams = claveDestino(params?.destino)
  useEffect(() => { if (params?.destino) { fijarDestino(params.destino, false); calcularAlCargar.current = true } }, [claveParams]) // eslint-disable-line

  useEffect(() => {
    if (!lugar) { setRepDestino([]); return }
    let vivo = true
    reportesEnArea(bboxAlrededor(lugar.lat, lugar.lng, 1500)).then(({ data }) => { if (vivo) setRepDestino(data || []) })
    return () => { vivo = false }
  }, [lugar?.lat, lugar?.lng, datos.cargando]) // eslint-disable-line
  const ids = new Set(datos.reportes.map((x) => x.id))
  const reportes = [...datos.reportes, ...repDestino.filter((x) => !ids.has(x.id))]

  function calcular(m = medio) {
    if (lugar) pedirRutas({ medio: m, origen: ubic, destino: lugar, reportes })
  }
  // Desde el detalle de alerta: calcula en cuanto hay reportes cargados (si no, "en el camino" sale en 0).
  useEffect(() => { if (calcularAlCargar.current && lugar && !datos.cargando) { calcularAlCargar.current = false; calcular() } }, [datos.cargando, lugar]) // eslint-disable-line
  // Llegó el GPS real (o te moviste): la ruta vieja ya no sale de donde estás.
  useEffect(() => { if (rutas && debeRecalcular(rutas, ubic)) calcular(rutas.medio) }, [ubic.lat, ubic.lng]) // eslint-disable-line
  const cambiarMedio = (m) => { setMedio(m); if (rutas) calcular(m) }
  const verRuta = (i) => { verRutaEnMapa(i); ir(null) }

  // Teclear solo cambia el texto; si se borra todo, vuelven los atajos. No consulta a Nominatim.
  function escribir(v) {
    setQ(v); setLugar(null)
    if (!v.trim()) { pedido.current++; setRes({ estado: 'vacio', lista: [], q: '' }) }
  }
  const atajo = (s) => { setQ(s); setLugar(null); buscar(s) }
  const elegir = (l) => fijarDestino(l)
  const cancelar = () => (q ? (escribir(''), inputRef.current?.focus()) : ir(null))

  const cercaDelLugar = lugar ? loCercano({ ...filtrarCapas({ zonas: datos.zonas, reportes }, datos.capas), ubic: lugar }) : []
  const enDestino = lugar ? reportes.filter((x) => distanciaM(lugar, x) <= RADIO_TU_ZONA_M).length : 0
  const activa = rutaActiva(rutas)
  const v = vistaLugar(lugar)
  const corto = avisoCorto(q)

  return (
    <Screen titulo={lugar ? 'Destino' : 'Buscar un lugar'} label="Buscar un lugar">
      <form className="mp-buscar" role="search" onSubmit={(e) => { e.preventDefault(); inputRef.current?.blur(); buscar(q) }}>
        <label className="mp-buscar-campo">
          <IcoLupa />
          <span className="sr-only">Buscar dirección, colonia o lugar</span>
          <input ref={inputRef} type="search" value={q} onChange={(e) => escribir(e.target.value)} enterKeyHint="search"
            placeholder="Lugar, colonia o calle (ej. la Mine)" autoComplete="off" aria-describedby="bs-corto" />
        </label>
        <button type="submit" className="btn-text mp-cancelar" disabled={res.estado === 'buscando'}>Buscar</button>
        <button type="button" className="btn-text mp-cancelar" onClick={cancelar}>Cancelar</button>
      </form>
      <p id="bs-corto" className="bs-corto" role="status" aria-live="polite">{corto || ''}</p>

      {lugar ? (
        <>
          <header className="bs-destino" aria-label={`Destino: ${encabezadoLugar(lugar)}`}>
            <span className="bs-over"><Icon name="pin" size={16} stroke={2.6} />Destino</span>
            <h2 className="bs-dest-t">{v.nombre}{v.municipio && <span className="bs-dest-muni"> · {v.municipio}</span>}</h2>
            {(v.categoria || v.detalle) && <p className="bs-dir">{[v.categoria, v.detalle].filter(Boolean).join(' · ')}</p>}
            <p className="bs-estado">{estadoCaminoDestino({ enCamino: activa ? activa.enCamino.length : null, enDestino })}</p>
          </header>
          <div className="mp-lugar-acc">
            <button type="button" className="btn btn-primary mp-btn-prim" onClick={() => calcular()} disabled={rutas?.estado === 'buscando'}>
              <IcoRuta />{rutas?.estado === 'buscando' ? 'Buscando rutas…' : rutas ? 'Volver a calcular rutas' : 'Cómo llegar'}
            </button>
            <button type="button" className="btn mp-btn-ruta" onClick={() => ir(null)}><Icon name="mapa" />Ver en el mapa</button>
          </div>
          {rutas && <PanelRutas rutas={rutas} onVer={verRuta} real={ubic.real} medio={medio} onMedio={cambiarMedio} />}
          <h2 className="mp-side-h">Alertas cerca de {v.nombre}</h2>
          {datos.cargando ? <p className="mp-cargando" role="status">Cargando alertas…</p>
            : cercaDelLugar.length
              ? <ul className="mp-list mp-list--libre">{cercaDelLugar.map((it) => <Fila key={it.id} it={it} desde="del lugar" onClick={() => abrirItem(ir, it)} />)}</ul>
              : <div className="mp-calma"><b>Sin alertas activas cerca de {v.nombre}</b><p>No hay inundaciones confirmadas cerca de este lugar ahora. Revisa antes de salir.</p></div>}
          <button type="button" className="btn-text" onClick={() => { setLugar(null); inputRef.current?.focus() }}>Elegir otro lugar</button>
        </>
      ) : (
        <div aria-live="polite">
          {res.estado === 'buscando' && <p className="mp-cargando" role="status">Buscando…</p>}
          {res.estado === 'error' && <p className="mp-aviso">No pudimos buscar. Revisa tu conexión y vuelve a intentar.</p>}
          {res.estado === 'listo' && !res.lista.length && (
            <div className="bs-vacio">
              <p><b>No encontramos «{res.q}».</b> Prueba con el nombre oficial, la colonia o una calle cercana.</p>
              <p className="bs-vacio-sub">Corrige arriba o toca una sugerencia:</p>
              <ul className="bs-sug">
                {sugerenciasSinResultado(res.q).map((s) => (
                  <li key={s}><button type="button" onClick={() => atajo(s)}><Icon name="pin" size={18} />{s}</button></li>
                ))}
              </ul>
            </div>
          )}
          {res.estado === 'listo' && res.lista.length > 0 && (
            <ul className="bs-res">
              {res.lista.map((l, i) => {
                const p = vistaLugar(l)
                const dist = ubic.real ? formatoDist(distanciaM(ubic, l)) : ''
                return (
                  <li key={i}>
                    <button type="button" onClick={() => elegir(l)}>
                      <Icon name="pin" size={22} />
                      <span className="bs-r">
                        <span className="bs-r-top"><b>{p.nombre}</b>{p.municipio && <span className="bs-muni">{p.municipio}</span>}</span>
                        {(p.categoria || p.detalle) && <span className="bs-r-dir">{[p.categoria, p.detalle].filter(Boolean).join(' · ')}</span>}
                        {dist && <span className="bs-r-dist">a {dist} de ti</span>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {(res.estado === 'vacio' || res.estado === 'corto') && (
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
    avisar(AVISO_CARGAR_SIM)
    if (prefs.voz) hablar(`Simulación. Inundación de ${e.titulo.toLowerCase()} a unos 150 metros de ti. Solo tú la ves.`)
  }
  const cargar = () => {
    cargarEscenario(ubic)
    refrescar(); setSheet('mid'); ir(null)
    vibrar(prefs, [60, 40, 60])
    avisar(AVISO_CARGAR_SIM)
  }
  const quitar = () => { quitarSimulaciones(); refrescar(); avisar(AVISO_QUITAR_SIM) }
  return (
    <section className="mp-card mp-sim" aria-labelledby="mp-sim-t">
      <EtiquetaSim />
      <h2 id="mp-sim-t">Simulaciones de prueba</h2>
      <p>Reportes <b>falsos</b> cerca de ti para practicar cómo te avisa la app. <b>Solo tú lo ves, no se publica nada.</b> En el
        mapa llevan borde punteado y la etiqueta “Simulación”.</p>
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
  const fila = (icono, txt, destino, desc) => (
    <li><button type="button" onClick={() => ir(destino)}>
      <Icon name={icono} /><span className="mp-conf-tx">{txt}{desc && <small>{desc}</small>}</span><Icon name="chevron" size={20} />
    </button></li>
  )
  return (
    <Screen titulo="Más" label="Más: privacidad, leyenda, accesibilidad, fuentes y configuración">
      {/* Testeo: privacidad y permisos al inicio, separados de la accesibilidad */}
      <section className="mp-card mp-mas-priv" aria-labelledby="mp-priv-t">
        <h2 id="mp-priv-t" className="sr-only">Privacidad y permisos</h2>
        <ul className="mp-conf">
          {fila('escudo', 'Privacidad y permisos', 'privacidad_permisos', 'Ubicación, notificaciones y qué datos guardamos')}
        </ul>
      </section>
      <Seccion titulo="Leyenda del mapa" abierta><LeyendaSimbolos /></Seccion>
      <section className="mp-card" aria-labelledby="mp-a11y-t">
        <h2 id="mp-a11y-t">Accesibilidad</h2>
        <p>Lectura y uso de la app.</p>
        <ul className="mp-conf">
          {fila('accesibilidad', 'Accesibilidad y apariencia', 'ajustes', 'Texto grande, contraste, daltonismo, voz')}
        </ul>
      </section>
      <section className="mp-card" aria-labelledby="mp-conf">
        <h2 id="mp-conf">Avisos y forma de moverte</h2>
        <ul className="mp-conf">
          {fila('campana', 'Elegir de dónde quiero avisos', 'preferencias', 'Zonas y avisos en tu celular')}
          {fila('peaton', 'Cómo me muevo hoy', 'onb')}
        </ul>
      </section>
      {MODO_PRUEBA && <Simulaciones />}
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
        <p>El nivel es <b>hasta dónde llega el agua</b>, con la banqueta y la llanta de un carro como medida (igual para
          todos): <b>Bajo</b> no sube de la banqueta, <b>Medio</b> llega a media llanta, <b>Alto</b> cubre la llanta.
          Aparte te decimos si ya está <b>confirmado</b>: “Sin confirmar” solo quiere decir que aún nadie lo confirma, no
          que haya menos riesgo. Cada nivel tiene su letra y su patrón para no depender del color.</p>
        <p><b>No transitable</b> quiere decir que alguien reportó que no pasan carros. Una alerta desaparece cuando la gente
          confirma que el agua bajó. Que no haya alerta no garantiza que la calle esté seca.</p>
      </Seccion>
      <section className="mp-card" aria-labelledby="mp-acerca">
        <h2 id="mp-acerca">Acerca de</h2>
        <p>¡Aguas! es un prototipo para consultar y reportar inundaciones en la zona metropolitana de Guadalajara.
          Es anónimo: no guardamos dónde estás, solo la ubicación de cada reporte.</p>
      </section>
    </Screen>
  )
}
