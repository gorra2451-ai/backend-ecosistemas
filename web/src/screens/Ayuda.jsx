// MÓDULO E · Avisos, derivación, refugios, accesibilidad (Equipo 5 · Notificaciones + Derivación).
// Ronda 3: flujo, pantallas y copy del material validado del equipo (notificaciones.html); look del design system.
// Contrato: docs/API.md + contrato v2. Si el backend aún no trae algo, la pantalla degrada sin romperse.
import { useEffect, useState } from 'react'
import { Screen, Btn, PorConfirmar } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { useApp } from '../lib/store.jsx'
import {
  derivar, refugiosPublicos, alertasClima, guardarAccesibilidad, zonasPublicas, reportesCercanos, preferenciasPush, direccionDe,
} from '../lib/api.js'
import {
  MUNICIPIOS_ZMG, CASOS, CASOS_EQUIPO, SITUACIONES, normalizarCaso, ordenarPorDistancia, formatoDistancia, urlRuta,
  municipioParaPush, nivelAlerta, textoHace, textoVigencia, mensajeAlerta, urlWhatsApp, urlSms, PREFS_AVISOS_BASE,
  DOS_HORAS_MS, silenciado, mensajeLlamada, mensajeUbicacion, argsPreferencias, grupoMedio, MEDIO_DE_GRUPO, GRUPOS,
  NIVEL_TXT, claseNivel, VEREDICTO, MENSAJE_VIA, PASO_VEHICULO, viasCercanas, urlRutaAlterna,
} from '../lib/ayuda.js'
import { pushDisponible, activarPush, desactivarPush, suscripcionActual } from '../lib/ayudaPush.js'
import '../styles/ayuda.css'

const leer = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin storage */ } }
const horaCorta = (ms) => new Date(ms).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })

// Íconos extra solo de este módulo (línea, viewBox 24, siempre con texto).
const Ico = ({ d, size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)
const ICO_ARBOL = <><path d="M12 3a5 5 0 0 0-4.6 7A4 4 0 0 0 9 18h6a4 4 0 0 0 1.6-8A5 5 0 0 0 12 3z" /><path d="M12 13v8M3 21h18" /></>
const ICO_RAYO = <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
const ICONO_CASO = {
  casa: <Icon name="casa" size={44} stroke={1.8} />,
  calle: <Icon name="calle" size={44} stroke={1.8} />,
  coche: <Icon name="coche" size={44} stroke={1.8} />,
  persona_herida: <Icon name="mas" size={44} stroke={2} />,
  arbol_caido: <Ico d={ICO_ARBOL} />,
  riesgo_electrico: <Ico d={ICO_RAYO} />,
}

const Tel911 = ({ children = 'Emergencias · Llamar al 911' }) => (
  <a href="tel:911" className="btn btn-danger ay-a"><Icon name="telefono" />{children}</a>
)

// ---------------------------------------------------------------- Me pasó algo (¿Qué te pasó?)
function SelectorMunicipio({ titulo }) {
  const { municipio, setMunicipio } = useApp()
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <div className="ay-muni-head">
        <span className="ay-sub">{municipio} · {titulo}</span>
        <button className="btn-text ay-cambiar" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
          {abierto ? 'Listo' : 'Cambiar municipio'}
        </button>
      </div>
      {abierto && (
        <div className="ay-grid2" role="group" aria-label="Elige tu municipio">
          {MUNICIPIOS_ZMG.map((m) => (
            <button key={m} className="ay-opt" aria-pressed={m === municipio}
              onClick={() => { setMunicipio(m); setAbierto(false) }}>
              <span>{m}</span>{m === municipio ? <span className="ay-si"><Icon name="check" size={14} stroke={3} />Aquí</span> : null}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export function Acudo() {
  const { ir } = useApp()
  return (
    <Screen titulo="¿Qué te pasó?">
      <SelectorMunicipio titulo="detectado" />
      <p className="ay-sub" style={{ fontSize: 16 }}>Selecciona tu situación actual para canalizarte.</p>
      <div className="ay-casos">
        {CASOS_EQUIPO.map((c) => (
          <button key={c} className={'ay-caso' + (c === 'persona_herida' || c === 'riesgo_electrico' ? ' ay-caso--risk' : '')}
            onClick={() => ir('acudoresp', { caso: c })}>
            {ICONO_CASO[c]}{CASOS[c]}
          </button>
        ))}
      </div>
      <Btn icon="refugio" onClick={() => ir('refugios', { desde: 'acudo' })}>Ver refugios cercanos</Btn>
    </Screen>
  )
}

// ---------------------------------------------------------------- Asistencia (respuesta de derivación)
export function AcudoRespuesta() {
  const { ir, params, municipio, ubic, pedirUbicacion, avisar } = useApp()
  const caso = normalizarCaso(params?.caso)
  const s = SITUACIONES[caso]
  const [res, setRes] = useState(null) // { pasos, instituciones, fallo }
  const [personas, setPersonas] = useState(1)
  const [guia, setGuia] = useState(false)

  useEffect(() => {
    let vivo = true
    setRes(null); setGuia(false)
    derivar(caso, municipio, ubic.lat, ubic.lng).then(({ data, error }) => {
      if (!vivo) return
      // Si el backend aún no conoce el caso (v2 en despliegue) no rompemos: queda lo del equipo + 911.
      setRes(error ? { pasos: [], instituciones: [], fallo: true } : { pasos: data?.pasos || [], instituciones: data?.instituciones || [] })
    })
    return () => { vivo = false }
  }, [caso, municipio, ubic.lat, ubic.lng])

  // PRIVACIDAD: el GPS del dispositivo no va a Nominatim. El mensaje usa el municipio; la ubicación exacta
  // solo sale si la persona toca "compartir ubicación" (liga de Google Maps que ella misma envía).
  const msg = mensajeLlamada({ say: s.say, lugar: municipio, personas })
  const copiar = async () => {
    try { await navigator.clipboard.writeText(msg); avisar('Mensaje copiado') } catch { avisar('No se pudo copiar') }
  }
  const compartirUbicacion = async () => {
    const u = ubic.real ? ubic : await pedirUbicacion()
    if (!u) { avisar('Activa tu ubicación para poder compartirla'); return }
    window.open(urlWhatsApp(mensajeUbicacion(msg, u.lat, u.lng)), '_blank', 'noopener')
  }
  const inst = (res?.instituciones || []).find((i) => i.telefono)

  return (
    <Screen titulo="Asistencia" paso={`Situación: ${s.n}`} onBack={() => ir('acudo')}>
      <div className="ay-card ay-rec">
        <span className="ay-rec-lead">Te recomendamos contactar a:</span>
        <span className="ay-rec-who">{s.who}</span>
        <span className="ay-sub">(Llamada directa sin internet)</span>
        {s.tel ? (
          <>
            <a className="btn btn-primary ay-a" href={`tel:${s.tel}`}><Icon name="telefono" />{s.call}</a>
            {s.telPorConfirmar && <span className="ay-sub">Número 071 <PorConfirmar>POR CONFIRMAR · falta fuente oficial</PorConfirmar></span>}
          </>
        ) : inst ? (
          <a className="btn btn-primary ay-a" href={`tel:${String(inst.telefono).replace(/[^\d+]/g, '')}`}>
            <Icon name="telefono" />Llamar a {inst.nombre} · {inst.telefono}
          </a>
        ) : s.call ? (
          <div className="btn-disabled ay-a ay-sin-num" aria-label={`${s.call}: número por confirmar`}>
            <Icon name="telefono" />{s.call}: número <PorConfirmar />
          </div>
        ) : null}
        <Tel911>Llamar al 911 (Emergencias)</Tel911>
        <span className="ay-sub">{s.num}</span>
      </div>

      <div className="ay-say">
        <span className="ay-say-t">Qué decir al llamar</span>
        <div className="ay-stepper" role="group" aria-label="¿Cuántas personas?">
          <button className="btn-icon" aria-label="Menos personas" onClick={() => setPersonas(Math.max(1, personas - 1))}>−</button>
          <span>¿Cuántas personas?: <strong>{personas} {personas === 1 ? 'persona' : 'personas'}</strong></span>
          <button className="btn-icon" aria-label="Más personas" onClick={() => setPersonas(Math.min(50, personas + 1))}>+</button>
        </div>
        <p className="ay-say-msg">“{msg}”</p>
        <button className="btn-text ay-left" onClick={copiar}>Copiar mensaje</button>
      </div>

      <Btn variant="outline-acc" icon="pin" onClick={compartirUbicacion}>Compartir mi ubicación</Btn>
      {s.ref && <Btn icon="refugio" onClick={() => ir('refugios', { desde: 'acudoresp', caso })}>Ver refugios cercanos</Btn>}
      {s.rutas && (
        <a className="btn ay-a" href={urlRutaAlterna(ubic, 'manejo')} target="_blank" rel="noopener noreferrer"><Icon name="mapa" />{s.extra}</a>
      )}
      {!s.rutas && s.extra && s.guide && (
        <>
          <Btn icon="lista" aria-expanded={guia} onClick={() => setGuia(!guia)}>{s.extra}</Btn>
          {guia && <div className="ay-card ay-guia">{s.guide}</div>}
        </>
      )}

      <div className="ay-row-sb"><h2 className="ay-label">Qué hacer</h2><span className="ay-validar">Por validar con Protección Civil</span></div>
      {!res && <p className="muted" role="status" aria-live="polite">Buscando qué hacer en {municipio}…</p>}
      {res?.fallo && <p className="ay-sub">No pudimos traer los pasos ahora. Si es emergencia, llama al 911.</p>}
      {res && res.pasos.length > 0 && (
        <ol className="ay-pasos">
          {res.pasos.map((p, i) => (
            <li key={i} className="ay-paso"><span className="ay-num" aria-hidden="true">{i + 1}</span><span className="ay-paso-txt">{p}</span></li>
          ))}
        </ol>
      )}

      {res && res.instituciones.length > 0 && (
        <>
          <h2 className="ay-label">A dónde acudir</h2>
          {res.instituciones.map((it) => (
            <div key={it.id} className="ay-card">
              <span className="ay-inst-nombre">{it.nombre}</span>
              {it.horario && <span className="ay-sub">{it.horario}</span>}
              {it.telefono
                ? <a className="btn ay-a ay-tel" href={`tel:${String(it.telefono).replace(/[^\d+]/g, '')}`}><Icon name="telefono" />Llamar · {it.telefono}</a>
                : <span className="ay-sub">Teléfono <PorConfirmar /></span>}
              {it.url && <a className="btn-text" href={it.url} target="_blank" rel="noopener noreferrer">Sitio oficial</a>}
              {it.fuente && <span className="ay-sub">Fuente: {it.fuente}</span>}
            </div>
          ))}
        </>
      )}
      <div className="ay-nota">Te decimos a dónde acudir. <strong>No damos seguimiento a folios</strong>: eso lo hace cada institución.</div>
    </Screen>
  )
}

// ---------------------------------------------------------------- Avisos (pantalla de alerta del equipo)
const KEY_MUNIS = 'aguas.avisosMunis'
const KEY_ON = 'aguas.avisosOn'
const KEY_PREFS = 'aguas.avisosPrefs'

function Gotas({ n }) {
  return (
    <span className="ay-gotas" aria-hidden="true">
      {[1, 2, 3].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}
    </span>
  )
}

// Tarjeta de alerta: nivel "N de 3 (palabra)" + gotas + patrón, pronóstico, "actualizado hace", fuente y compartir.
function AlertaClima({ a, ahora }) {
  const { avisar } = useApp()
  const n = nivelAlerta(a.nivel)
  const vig = textoVigencia(a.vigente_desde, a.vigente_hasta)
  const hace = textoHace(a.verificado_en || a.vigente_desde, ahora)
  const enlace = typeof window !== 'undefined' ? window.location.origin : ''
  const msg = mensajeAlerta(a, enlace)
  const copiar = async () => {
    try { await navigator.clipboard.writeText(msg); avisar('Alerta copiada') } catch { avisar('No se pudo copiar') }
  }
  return (
    <article className="ay-clima" aria-label={`Alerta: ${a.titulo}. ${n.texto}`}>
      <div className={`ay-clima-nivel p-${n.clave}`}><span className="ay-pill">Alerta</span></div>
      <div className="ay-clima-body">
        <span className="ay-clima-tag"><Icon name="lluvia" size={18} />Alerta de clima{a.municipio ? ` · ${a.municipio}` : ''}</span>
        <h3 className="ay-clima-tit">{a.titulo}</h3>
        {vig && <span className="ay-clima-vig">Pronóstico: {vig.charAt(0).toLowerCase() + vig.slice(1)}</span>}
        {a.descripcion && <p className="ay-clima-desc">{a.descripcion}</p>}
        <span className="ay-sub">
          {hace ? `Actualizado ${hace}` : null}
          {a.fuente ? <>{hace ? ' · ' : ''}{a.fuente_url
            ? <a className="btn-text ay-inline" href={a.fuente_url} target="_blank" rel="noopener noreferrer">Fuente: {a.fuente}</a>
            : `Fuente: ${a.fuente}`}</> : null}
        </span>
        <div className="ay-nivel-lluvia"><span className="ay-sub">Nivel de lluvia</span><Gotas n={n.num} /><strong>{n.texto}</strong></div>
        <a className="btn btn-primary ay-a" href={urlWhatsApp(msg)} target="_blank" rel="noopener noreferrer"><Icon name="compartir" />Compartir en WhatsApp</a>
        <div className="ay-share" role="group" aria-label="Otras formas de compartir">
          <a className="btn ay-a" href={urlSms(msg)}><Icon name="telefono" />SMS</a>
          <button className="btn ay-a" onClick={copiar}><Icon name="lista" />Copiar</button>
        </div>
      </div>
    </article>
  )
}

function AlertasInicio() {
  const { ir } = useApp()
  const [alertas, setAlertas] = useState(null)
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    let vivo = true
    alertasClima().then(({ data, error }) => { if (vivo) setAlertas(error ? 'error' : (data || [])) })
    const t = setInterval(() => setAhora(Date.now()), 60000) // refresca "actualizado hace"
    return () => { vivo = false; clearInterval(t) }
  }, [])

  const hay = Array.isArray(alertas) && alertas.length > 0
  return (
    <Screen titulo="Avisos">
      {alertas === null && <p className="muted" role="status">Revisando alertas…</p>}
      {alertas === 'error' && <p className="ay-sub" role="status">No pudimos revisar las alertas. Vuelve a intentar con señal.</p>}
      {hay && alertas.map((a) => <AlertaClima key={a.id} a={a} ahora={ahora} />)}
      {Array.isArray(alertas) && !hay && (
        <div className="ay-vacio">
          <Icon name="lluvia" size={40} />
          <strong>Sin alertas de clima por ahora</strong>
          <span>Solo mostramos alertas con fuente oficial. Si cambia algo, aparece aquí.</span>
        </div>
      )}
      <Btn variant="ghost" icon="calle" onClick={() => ir('alertas', { vista: 'calles' })}>Ver cómo están las calles →</Btn>
      <button className="btn-text ay-centro" onClick={() => ir('preferencias')}><Icon name="ajustes" size={20} />Ajustar mis avisos</button>
    </Screen>
  )
}

// ---------------------------------------------------------------- Monitoreo vial (calles) + ¿Puedo pasar?
// Carga zonas públicas + reportes cercanos y arma las vías. Nombres de calle por Nominatim, uno por segundo:
// v.lat/v.lng son el centro de una zona pública o de un reporte (ya públicos), nunca el GPS del dispositivo.
function useVias(activo = true) {
  const { ubic } = useApp()
  const [estado, setEstado] = useState({ vias: null, error: false })
  const [nombres, setNombres] = useState({})

  useEffect(() => {
    let vivo = true
    if (!activo) return undefined
    setEstado({ vias: null, error: false })
    Promise.all([zonasPublicas(), reportesCercanos(ubic.lat, ubic.lng, 1000)]).then(([z, r]) => {
      if (!vivo) return
      const vias = viasCercanas({ zonas: z.data || [], reportes: r.data || [], ubic })
      setEstado({ vias, error: !!(z.error && r.error) })
      ;(async () => {
        for (const v of vias) {
          const { data } = await direccionDe(v.lat, v.lng)
          if (!vivo) return
          if (data) setNombres((m) => ({ ...m, [v.id]: data.split(',')[0] }))
        }
      })()
    })
    return () => { vivo = false }
  }, [ubic.lat, ubic.lng, activo]) // eslint-disable-line react-hooks/exhaustive-deps

  return { ...estado, nombres }
}

function Modos({ grupo, setGrupo }) {
  return (
    <div className="ay-modos" role="group" aria-label="¿Cómo te mueves?">
      {GRUPOS.map(([k, t, ico]) => (
        <button key={k} className="ay-modo" aria-pressed={grupo === k} onClick={() => setGrupo(k)}>
          <Icon name={ico} size={22} />{t}
        </button>
      ))}
    </div>
  )
}

const PillNivel = ({ nivel }) => (
  <span className={`ay-nivel ${claseNivel(nivel)}`}><span className="ay-pill">Nivel {NIVEL_TXT[nivel] || 'Bajo'}</span></span>
)

function useGrupo() {
  const { medio, setMedio, avisar } = useApp()
  const grupo = grupoMedio(medio)
  const setGrupo = (g) => {
    if (g === grupo) return
    setMedio(MEDIO_DE_GRUPO[g])
    avisar({ manejo: 'Vista para quien maneja', camino: 'Vista para quien camina', camion: 'Vista para quien usa camión' }[g])
  }
  return [grupo, setGrupo]
}

function Calles() {
  const { ir, ubic, pedirUbicacion } = useApp()
  const [grupo, setGrupo] = useGrupo()
  const { vias, error, nombres } = useVias()
  const [ahora] = useState(() => Date.now())
  const total = (vias || []).reduce((s, v) => s + (v.reportes || 0), 0)
  const ultima = (vias || []).map((v) => Date.parse(v.act)).filter((t) => !Number.isNaN(t)).sort((a, b) => b - a)[0]

  return (
    <Screen titulo="Monitoreo vial" onBack={() => ir('alertas')}>
      <Modos grupo={grupo} setGrupo={setGrupo} />
      {!ubic.real && (
        <div className="ay-nota">
          Usamos un punto de ejemplo en Zapopan. <button className="btn-text ay-inline" onClick={pedirUbicacion}>Usar mi ubicación</button>
        </div>
      )}
      <h2 className="ay-label">Vías cercanas a tu ruta:</h2>
      {vias === null && <p className="muted" role="status">Revisando calles cercanas…</p>}
      {vias && vias.length > 0 && (
        <div className="ay-vias">
          {vias.map((v) => {
            const ver = VEREDICTO[v.veredicto]
            return (
              <button key={v.id} className="ay-via" onClick={() => ir('alertadetalle', { via: v, nombre: nombres[v.id] })}>
                <span className={`ay-via-ic ay-v-${v.veredicto}`} aria-hidden="true"><Icon name={ver.icono} size={20} stroke={3} /></span>
                <span className="ay-via-txt">
                  <span className="ay-via-t">{nombres[v.id] || 'Zona con agua'} ({ver.etiqueta})</span>
                  <span className="ay-sub">{formatoDistancia(v.dist)} · {MENSAJE_VIA[v.veredicto][grupo]}</span>
                </span>
                <PillNivel nivel={v.nivel} />
                <Icon name="chevron" size={20} />
              </button>
            )
          })}
        </div>
      )}
      {vias && vias.length === 0 && (
        <div className="ay-vacio">
          <Icon name="calle" size={40} />
          <strong>{error ? 'No pudimos revisar las calles' : 'Sin calles con agua reportadas cerca'}</strong>
          <span>{error ? 'Vuelve a intentar con señal.' : 'Solo mostramos zonas confirmadas por otras personas en los últimos minutos.'}</span>
        </div>
      )}
      {vias && vias.length > 0 && (
        <span className="ay-sub">
          {ultima ? `Actualizado ${textoHace(new Date(ultima).toISOString(), ahora)} · ` : ''}{total} reporte{total === 1 ? '' : 's'} en tu zona
        </span>
      )}
      <Btn variant="primary" icon="riesgo" onClick={() => ir('acudo')}>Me pasó algo</Btn>
    </Screen>
  )
}

export function Alertas() {
  const { params } = useApp()
  return params?.vista === 'calles' ? <Calles /> : <AlertasInicio />
}

// ¿Puedo pasar? (detalle de una vía). Sin vía en params: usa la más cercana.
export function AlertaDetalle() {
  const { ir, params, ubic } = useApp()
  const [grupo] = useGrupo()
  const cargar = !params?.via
  const { vias, nombres } = useVias(cargar)
  const v = params?.via || (vias && vias[0])
  const nombre = params?.nombre || (v && nombres[v.id]) || 'Zona con agua'
  const atras = () => ir('alertas', { vista: 'calles' })

  if (!v) {
    return (
      <Screen titulo="¿Puedo pasar?" onBack={atras}>
        {vias === null ? <p className="muted" role="status">Revisando la calle más cercana…</p> : (
          <div className="ay-vacio">
            <Icon name="calle" size={40} />
            <strong>Sin calles con agua reportadas cerca</strong>
            <span>Puedes pasar con cuidado. Si ves agua, repórtala.</span>
          </div>
        )}
        <Btn variant="primary" icon="riesgo" onClick={() => ir('acudo')}>Me pasó algo aquí</Btn>
      </Screen>
    )
  }
  const ver = VEREDICTO[v.veredicto]
  const paso = PASO_VEHICULO[v.veredicto]
  const hace = textoHace(v.act)
  const fila = (ico, t, ok) => (
    <div className="ay-pasa-fila">
      <span className="ay-pasa-l"><Icon name={ico} size={22} />{t}</span>
      <span className={ok ? 'ay-si-pasa' : 'ay-no-pasa'}><Icon name={ok ? 'check' : 'cerrar'} size={18} stroke={3} />{ok ? 'Sí' : 'No'}</span>
    </div>
  )
  return (
    <Screen titulo="¿Puedo pasar?" onBack={atras}>
      <div className="ay-card">
        <div className="ay-row-sb"><h2 className="ay-h-caso">{nombre}</h2><PillNivel nivel={v.nivel} /></div>
        <span className="ay-sub">{[formatoDistancia(v.dist), hace && `Actualizado ${hace}`, `${v.reportes} reporte${v.reportes === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</span>
        <p className="ay-msg">{MENSAJE_VIA[v.veredicto][grupo]}</p>
      </div>
      <div className="ay-card">
        <h2 className="ay-label">¿Puedo pasar?</h2>
        <div className={`ay-veredicto ay-v-${v.veredicto}`} role="status"><Icon name={ver.icono} size={26} stroke={3} />{ver.texto}</div>
        {fila('auto', 'Auto bajo', paso.bajo)}
        {fila('coche', 'Camioneta o auto alto', paso.alto)}
        {fila('peaton', 'A pie', paso.pie)}
      </div>
      {v.veredicto !== 'si' && (
        <a className="btn btn-ghost ay-a" href={urlRutaAlterna(ubic, grupo)} target="_blank" rel="noopener noreferrer"
          aria-label="Ver ruta alterna (abre Google Maps)"><Icon name="mapa" />Ver ruta alterna</a>
      )}
      <Btn variant="primary" icon="riesgo" onClick={() => ir('acudo')}>Me pasó algo aquí</Btn>
    </Screen>
  )
}

// ---------------------------------------------------------------- Mis avisos (Ajustar mis avisos)
function Pref({ on, onClick, titulo, desc, disabled, extra }) {
  return (
    <button className="ay-toggle" role="switch" aria-checked={!!on} onClick={onClick} disabled={disabled}>
      <span><span className="ay-toggle-l">{titulo}</span><span className="ay-toggle-d">{desc}</span>{extra}</span>
      <span className="ay-toggle-r">
        <span className={on ? '' : 'muted'} style={{ fontWeight: on ? 700 : 400 }}>{on ? 'Sí' : 'No'}</span>
        <span className="switch" aria-hidden="true"><i /></span>
      </span>
    </button>
  )
}

// Manda las preferencias al backend si este navegador tiene suscripción push. Si falla, quedan en el celular.
async function sincronizarPrefs(p) {
  const sub = await suscripcionActual()
  if (!sub) return false
  const { error } = await preferenciasPush(sub.endpoint, argsPreferencias(p))
  return !error
}

export function Preferencias() {
  const { ir, municipio, avisar } = useApp()
  const [munis, setMunis] = useState(() => leer(KEY_MUNIS, { [municipio]: true }))
  const [on, setOn] = useState(() => leer(KEY_ON, false))
  const [prefs, setPrefsAv] = useState(() => ({ ...PREFS_AVISOS_BASE, ...leer(KEY_PREFS, {}) }))
  const [ocupado, setOcupado] = useState(false)
  const [nota, setNota] = useState(null)
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    // Si el navegador ya no tiene suscripción, el botón vuelve a "Activar".
    if (pushDisponible()) suscripcionActual().then((s) => { if (!s) { setOn(false); guardar(KEY_ON, false) } })
    const t = setInterval(() => setAhora(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  const toggleMuni = (m) => { const n = { ...munis, [m]: !munis[m] }; setMunis(n); guardar(KEY_MUNIS, n) }
  const cambiarPref = (cambio) => {
    const n = { ...prefs, ...cambio }
    setPrefsAv(n); guardar(KEY_PREFS, n)
    if (on) sincronizarPrefs(n)
    return n
  }
  const callado = silenciado(prefs, ahora)
  const silenciar = () => {
    if (callado) { cambiarPref({ silencioHasta: null }); avisar('Avisos de vuelta'); return }
    const hasta = Date.now() + DOS_HORAS_MS
    cambiarPref({ silencioHasta: hasta }); setAhora(Date.now())
    avisar(`Avisos en silencio hasta ${horaCorta(hasta)}`)
  }

  const toggleAvisos = async () => {
    if (ocupado) return
    setNota(null)
    if (on) {
      setOcupado(true); await desactivarPush(); setOcupado(false)
      setOn(false); guardar(KEY_ON, false); avisar('Avisos apagados')
      return
    }
    if (!pushDisponible()) { setNota('Los avisos push se activan en la siguiente versión. Tus ajustes quedan guardados en este celular.'); return }
    setOcupado(true)
    const m = municipioParaPush(munis, municipio)
    const r = await activarPush(m)
    if (r.ok) await sincronizarPrefs(prefs)
    setOcupado(false)
    if (r.ok) { setOn(true); guardar(KEY_ON, true); avisar(`Avisos activados para ${m}`) }
    else if (r.motivo === 'sin_permiso') setNota('Tu navegador bloqueó los avisos. Puedes permitirlos en sus ajustes.')
    else setNota('Los avisos push se activan en la siguiente versión. Tus ajustes quedan guardados en este celular.')
  }

  return (
    <Screen titulo="Mis avisos" onBack={() => ir('alertas')}>
      <div className="ay-card">
        <h2 className="ay-h" style={{ fontSize: 21 }}>Solo te avisamos si algo cambia</h2>
        <p className="ay-sub" style={{ fontSize: 15, lineHeight: 1.4 }}>
          Zona nueva, zona despejada o lluvia fuerte. Por municipio, nunca por tu ubicación exacta.
        </p>
        {on
          ? <button className="ay-on" onClick={toggleAvisos} disabled={ocupado}><Icon name="check" size={20} />Avisos activados · toca para apagar</button>
          : <Btn variant="primary" icon="campana" onClick={toggleAvisos} disabled={ocupado}>{ocupado ? 'Activando…' : 'Activar avisos'}</Btn>}
        {nota && <p role="status" className="ay-nota">{nota}</p>}
      </div>

      <div className="ay-lista-toggles">
        <Pref on={false} disabled titulo="Avisarme 1 hora antes" desc="Para organizar tu día."
          extra={<span className="ay-toggle-d">Necesita pronóstico · <PorConfirmar>por confirmar</PorConfirmar></span>} />
        <Pref on={prefs.soloCambios} onClick={() => cambiarPref({ soloCambios: !prefs.soloCambios })}
          titulo="Solo si cambia el estado" desc="Sin avisos repetidos." />
        <Pref on={prefs.soloFuertes} onClick={() => cambiarPref({ soloFuertes: !prefs.soloFuertes })}
          titulo="Solo alertas fuertes" desc="Nivel 3 de 3 y cierres de calle." />
      </div>
      <button className={callado ? 'ay-on' : 'btn btn-ghost'} onClick={silenciar}>
        {callado ? `Silenciado hasta ${horaCorta(prefs.silencioHasta)} · toca para quitar` : 'Silenciar 2 horas'}
      </button>

      <h2 className="ay-label" style={{ fontSize: 17 }}>¿De dónde quieres avisos?</h2>
      <div className="ay-grid2" role="group" aria-label="Municipios">
        {MUNICIPIOS_ZMG.map((m) => (
          <button key={m} className="ay-opt" aria-pressed={!!munis[m]} onClick={() => toggleMuni(m)}>
            <span>{m}</span>{munis[m] ? <span className="ay-si"><Icon name="check" size={14} stroke={3} />Sí</span> : <span className="ay-no">No</span>}
          </button>
        ))}
      </div>
      <p className="ay-sub">{on ? 'Se guardan en este celular y en tus avisos.' : 'Se guardan en este celular.'}</p>
    </Screen>
  )
}

// ---------------------------------------------------------------- Refugios
const CACHE_REF = 'aguas.refugios'

export function Refugios() {
  const { ir, params, ubic } = useApp()
  const [lista, setLista] = useState(() => leer(CACHE_REF, null))
  const [estado, setEstado] = useState('cargando') // cargando | ok | sin_red

  useEffect(() => {
    let vivo = true
    refugiosPublicos().then(({ data, error }) => {
      if (!vivo) return
      if (error) { setEstado('sin_red'); return }
      guardar(CACHE_REF, data || []) // “Guardados en tu celular: los ves aunque no haya señal.”
      setLista(data || []); setEstado('ok')
    })
    return () => { vivo = false }
  }, [])

  const atras = params?.desde === 'acudoresp' ? () => ir('acudoresp', { caso: params.caso })
    : params?.desde === 'acudo' ? () => ir('acudo') : undefined
  const ordenados = ordenarPorDistancia(lista, ubic)

  return (
    <Screen titulo="Refugios cerca" onBack={atras}>
      {estado === 'cargando' && !lista && <p className="muted" role="status">Buscando refugios…</p>}
      {estado === 'sin_red' && lista && <div className="band-offline" role="status">Sin señal · mostramos los guardados en tu celular</div>}
      {estado === 'sin_red' && !lista && <div className="band-offline" role="status">Sin señal y aún no hay refugios guardados en tu celular</div>}
      {lista && ordenados.length === 0 && (
        <div className="ay-vacio">
          <Icon name="refugio" size={40} />
          <strong>Aún no hay refugios verificados en tu zona</strong>
          <span>Solo mostramos refugios con fuente oficial. Si estás en peligro, llama al 911.</span>
          <PorConfirmar />
        </div>
      )}
      {ordenados.map((r) => (
        <article key={r.id} className="ay-ref">
          <h2 className="ay-ref-nombre">{r.nombre}</h2>
          <span className="ay-sub">
            {[formatoDistancia(r.distancia_m), r.direccion, r.municipio].filter(Boolean).join(' · ')}
          </span>
          {r.capacidad != null && <span className="ay-sub">Capacidad: {r.capacidad} personas</span>}
          {r.fuente && <span className="ay-sub">Fuente: {r.fuente}</span>}
          <a className="btn ay-a" href={urlRuta(r.lat, r.lng)} target="_blank" rel="noopener noreferrer"
            aria-label={`Cómo llegar a ${r.nombre} (abre Google Maps)`}><Icon name="mapa" />Cómo llegar</a>
        </article>
      ))}
      {lista && ordenados.length === 0 && <Tel911>Llamar al 911</Tel911>}
      <p className="ay-sub ay-center">Guardados en tu celular: los ves aunque no haya señal.</p>
    </Screen>
  )
}

// ---------------------------------------------------------------- Accesibilidad
const A11Y = [
  ['claro', 'Modo claro', 'Fondo claro para leer con sol'],
  ['grande', 'Texto grande', 'Todo se ve 22 % más grande'],
  ['contraste', 'Alto contraste', 'Negro y blanco, bordes gruesos'],
  ['dalton', 'Modo daltonismo', 'Escala azul → naranja, sin rojo/verde'],
  ['voz', 'Leer en voz alta', 'Lee zonas nuevas o que suben cerca de ti y botón “Escuchar” en el mapa'],
  ['vibra', 'Vibración en avisos', 'Vibra al confirmar y en alertas'],
  ['motion', 'Reducir movimiento', 'Apaga todas las animaciones'],
]

function hablar(texto) {
  if (!('speechSynthesis' in window)) return false
  const u = new SpeechSynthesisUtterance(texto)
  u.lang = 'es-MX'
  window.speechSynthesis.cancel(); window.speechSynthesis.speak(u)
  return true
}

export function Ajustes() {
  const { prefs, setPrefs, avisar } = useApp()
  const a11y = prefs.a11y || []
  const activo = (k) => k === 'claro' ? prefs.tema === 'claro'
    : (k === 'voz' || k === 'vibra') ? !!prefs[k] : a11y.includes(k)

  const toggle = (k) => {
    const v = !activo(k)
    if (k === 'claro') return setPrefs({ ...prefs, tema: v ? 'claro' : 'oscuro' })
    if (k === 'voz') {
      setPrefs({ ...prefs, voz: v })
      if (v && !hablar('Leer en voz alta activado. Así vas a escuchar el estado de tu zona.')) avisar('Tu navegador no puede leer en voz alta')
      if (!v && 'speechSynthesis' in window) window.speechSynthesis.cancel()
      return
    }
    if (k === 'vibra') {
      setPrefs({ ...prefs, vibra: v })
      if (v && navigator.vibrate) navigator.vibrate(80)
      return
    }
    setPrefs({ ...prefs, a11y: v ? [...a11y, k] : a11y.filter((x) => x !== k) })
    if (k === 'dalton') guardarAccesibilidad(v).catch(() => {}) // se guarda en el perfil anónimo; si falla, queda local
  }

  return (
    <Screen titulo="Accesibilidad">
      <div className="ay-card" style={{ borderRadius: 16, padding: 12 }}>
        <span className="ay-sub" style={{ fontWeight: 700 }}>Así se ve ahora la escala</span>
        <div className="ay-escala">
          <span className="p-bajo"><span className="ay-pill">Bajo</span></span>
          <span className="p-medio"><span className="ay-pill">Medio</span></span>
          <span className="p-alto"><span className="ay-pill">Alto</span></span>
        </div>
      </div>
      <div className="ay-lista-toggles">
        {A11Y.map(([k, l, d]) => {
          const on = activo(k)
          return (
            <button key={k} className="ay-toggle" role="switch" aria-checked={on} onClick={() => toggle(k)}>
              <span><span className="ay-toggle-l">{l}</span><span className="ay-toggle-d">{d}</span></span>
              <span className="ay-toggle-r">
                <span className={on ? '' : 'muted'} style={{ fontWeight: on ? 700 : 400 }}>{on ? 'Sí' : 'No'}</span>
                <span className="switch" aria-hidden="true"><i /></span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="ay-sub ay-center">Los cambios se aplican al instante en toda la app.</p>
    </Screen>
  )
}
