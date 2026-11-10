// MÓDULO E · Avisos, derivación, refugios, accesibilidad (Equipo Notificaciones + Derivación).
// Copy y estructura: App.dc.html (acudo, acudoresp, refugios, alertas, ajustes). Contrato: docs/API.md.
import { useEffect, useState } from 'react'
import { Screen, Btn, PorConfirmar } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { useApp } from '../lib/store.jsx'
import { derivar, refugiosPublicos, alertasClima, guardarAccesibilidad } from '../lib/api.js'
import {
  MUNICIPIOS_ZMG, CASOS, INST_EJEMPLO, normalizarCaso, ordenarPorDistancia, formatoDistancia, urlRuta, municipioParaPush,
  nivelAlerta, textoHace, textoVigencia, mensajeAlerta, urlWhatsApp, urlSms, PREFS_AVISOS_BASE, DOS_HORAS_MS, silenciado,
} from '../lib/ayuda.js'
import { pushDisponible, activarPush, desactivarPush, suscripcionActual } from '../lib/ayudaPush.js'
import '../styles/ayuda.css'

const leer = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin storage */ } }

// Ícono extra solo de este módulo: persona + (tercero).
const IcoTercero = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="7" r="3" /><path d="M3 20a6 6 0 0 1 12 0M17 8h4M19 6v4" />
  </svg>
)

const Tel911 = ({ children = 'Emergencias · Llamar al 911' }) => (
  <a href="tel:911" className="btn btn-danger ay-a"><Icon name="telefono" />{children}</a>
)

// ---------------------------------------------------------------- ¿A quién acudo?
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
              <span>{m}</span>{m === municipio ? <span className="ay-si">✓ Aquí</span> : null}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export function Acudo() {
  const { ir } = useApp()
  const caso = (c) => () => ir('acudoresp', { caso: c })
  return (
    <Screen titulo="¿A quién acudo?">
      <SelectorMunicipio titulo="detectado" />
      <h2 className="ay-h-big">¿Qué te pasó?</h2>
      <div className="ay-casos">
        <button className="ay-caso" onClick={caso('casa')}><Icon name="casa" size={44} stroke={1.8} />Se metió a mi casa</button>
        <button className="ay-caso" onClick={caso('coche')}><Icon name="auto" size={44} stroke={1.8} />Mi coche</button>
        <button className="ay-caso ay-caso--risk" onClick={caso('persona_herida')}><Icon name="mas" size={44} stroke={2} />Alguien herido</button>
        <button className="ay-caso" onClick={caso('tercero')}><IcoTercero />Le pasó a otra persona</button>
        <button className="ay-caso ay-caso--wide" onClick={caso('otro')}>Otra cosa</button>
      </div>
    </Screen>
  )
}

// ---------------------------------------------------------------- Respuesta de derivación
export function AcudoRespuesta() {
  const { ir, params, municipio, ubic } = useApp()
  const caso = normalizarCaso(params?.caso)
  const [res, setRes] = useState(null) // { pasos, instituciones, refugios }

  useEffect(() => {
    let vivo = true
    setRes(null)
    derivar(caso, municipio, ubic.lat, ubic.lng).then(({ data, error }) => {
      if (!vivo) return
      if (error) return ir('error', { codigo: error })
      setRes({ pasos: data?.pasos || [], instituciones: data?.instituciones || [], refugios: data?.refugios || [] })
    })
    return () => { vivo = false }
  }, [caso, municipio, ubic.lat, ubic.lng, ir])

  return (
    <Screen titulo={CASOS[caso]} paso={municipio} onBack={() => ir('acudo')}>
      <div className="ay-nota">Te decimos a dónde acudir. <strong>No damos seguimiento a folios</strong>: eso lo hace cada institución.</div>

      <div className="ay-row-sb"><h2 className="ay-label">Qué hacer</h2><span className="ay-validar">Por validar con Protección Civil</span></div>
      {!res ? (
        <p className="muted" role="status" aria-live="polite">Buscando qué hacer en {municipio}…</p>
      ) : (
        <ol className="ay-pasos">
          {res.pasos.map((p, i) => (
            <li key={i} className="ay-paso"><span className="ay-num" aria-hidden="true">{i + 1}</span><span className="ay-paso-txt">{p}</span></li>
          ))}
        </ol>
      )}

      <h2 className="ay-label">A dónde acudir</h2>
      <Tel911 />
      {res && res.instituciones.length > 0 && res.instituciones.map((it) => (
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
      {res && res.instituciones.length === 0 && INST_EJEMPLO[caso].map((n) => (
        <div key={n} className="card-ejemplo ay-ejemplo">
          <span className="tag-ejemplo">Dato de ejemplo – por confirmar</span>
          <span className="ay-inst-nombre">{n}</span>
          <span className="ay-sub">Teléfono [POR CONFIRMAR]</span>
        </div>
      ))}
      <Btn icon="refugio" onClick={() => ir('refugios', { desde: 'acudoresp', caso })}>Ver refugios cercanos</Btn>
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

  const atras = params?.desde === 'acudoresp' ? () => ir('acudoresp', { caso: params.caso }) : undefined
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

// ---------------------------------------------------------------- Avisos
const KEY_MUNIS = 'aguas.avisosMunis'
const KEY_ON = 'aguas.avisosOn'
const KEY_PREFS = 'aguas.avisosPrefs' // solo front: el backend no conoce estas preferencias

// Tarjeta de alerta (Equipo 5): nivel "N de 3" + palabra + patrón, vigencia, "actualizado hace", fuente y compartir.
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
    <article className="ay-clima" aria-label={`${n.texto}: ${a.titulo}`}>
      <div className={`ay-clima-nivel p-${n.clave}`}><span className="ay-pill">{n.texto}</span></div>
      <div className="ay-clima-body">
        <span className="ay-clima-tag"><Icon name="lluvia" size={18} />Alerta de clima{a.municipio ? ` · ${a.municipio}` : ''}</span>
        <h3 className="ay-clima-tit">{a.titulo}</h3>
        {vig && <span className="ay-clima-vig">{vig}</span>}
        {a.descripcion && <p className="ay-clima-desc">{a.descripcion}</p>}
        <span className="ay-sub">
          {hace ? `Actualizado ${hace}` : null}
          {a.fuente ? <>{hace ? ' · ' : ''}{a.fuente_url
            ? <a className="btn-text ay-inline" href={a.fuente_url} target="_blank" rel="noopener noreferrer">Fuente: {a.fuente}</a>
            : `Fuente: ${a.fuente}`}</> : null}
        </span>
        <div className="ay-share" role="group" aria-label="Compartir alerta">
          <a className="btn ay-a" href={urlWhatsApp(msg)} target="_blank" rel="noopener noreferrer"><Icon name="compartir" />WhatsApp</a>
          <a className="btn ay-a" href={urlSms(msg)}><Icon name="telefono" />SMS</a>
          <button className="btn ay-a" onClick={copiar}><Icon name="lista" />Copiar enlace</button>
        </div>
      </div>
    </article>
  )
}

// Solo para mostrar el diseño mientras no haya alertas reales: marcado y sin compartir.
function AlertaEjemplo() {
  return (
    <div className="card-ejemplo ay-clima-ej" aria-label="Ejemplo de alerta, no es real">
      <span className="tag-ejemplo">Ejemplo · por confirmar</span>
      <div className="ay-clima-nivel p-alto"><span className="ay-pill">Nivel 3 de 3 · Alto</span></div>
      <strong>Lluvia fuerte (ejemplo)</strong>
      <span className="ay-sub">Así se verá una alerta real: nivel con número y palabra, horario, “actualizado hace” y la fuente oficial.</span>
    </div>
  )
}

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

export function Alertas() {
  const { ir, municipio, avisar } = useApp()
  const [munis, setMunis] = useState(() => leer(KEY_MUNIS, { [municipio]: true }))
  const [on, setOn] = useState(() => leer(KEY_ON, false))
  const [prefs, setPrefsAv] = useState(() => ({ ...PREFS_AVISOS_BASE, ...leer(KEY_PREFS, {}) }))
  const [ocupado, setOcupado] = useState(false)
  const [nota, setNota] = useState(null)
  const [alertas, setAlertas] = useState(null)
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    alertasClima().then(({ data, error }) => setAlertas(error ? 'error' : (data || [])))
    // Si el navegador ya no tiene suscripción, el botón vuelve a "Activar".
    if (pushDisponible()) suscripcionActual().then((s) => { if (!s) { setOn(false); guardar(KEY_ON, false) } })
    const t = setInterval(() => setAhora(Date.now()), 60000) // refresca "actualizado hace" y el silencio
    return () => clearInterval(t)
  }, [])

  const toggleMuni = (m) => {
    const n = { ...munis, [m]: !munis[m] }
    setMunis(n); guardar(KEY_MUNIS, n)
  }
  const cambiarPref = (cambio) => {
    const n = { ...prefs, ...cambio }
    setPrefsAv(n); guardar(KEY_PREFS, n)
  }
  const callado = silenciado(prefs, ahora)
  const silenciar = () => {
    if (callado) { cambiarPref({ silencioHasta: null }); avisar('Avisos de vuelta'); return }
    const hasta = Date.now() + DOS_HORAS_MS
    cambiarPref({ silencioHasta: hasta }); setAhora(Date.now())
    avisar(`Silenciado hasta ${new Date(hasta).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}`)
  }

  const toggleAvisos = async () => {
    if (ocupado) return
    setNota(null)
    if (on) {
      setOcupado(true); await desactivarPush(); setOcupado(false)
      setOn(false); guardar(KEY_ON, false); avisar('Avisos apagados')
      return
    }
    if (!pushDisponible()) { setNota('Los avisos push se activan en la siguiente versión. Tus municipios quedan guardados.'); return }
    setOcupado(true)
    const m = municipioParaPush(munis, municipio)
    const r = await activarPush(m)
    setOcupado(false)
    if (r.ok) { setOn(true); guardar(KEY_ON, true); avisar(`Avisos activados para ${m}`) }
    else if (r.motivo === 'sin_permiso') setNota('Tu navegador bloqueó los avisos. Puedes permitirlos en sus ajustes.')
    else setNota('Los avisos push se activan en la siguiente versión. Tus municipios quedan guardados.')
  }

  const hay = Array.isArray(alertas) && alertas.length > 0
  const acciones = (
    <div className="ay-acc2">
      <Btn icon="mapa" onClick={() => ir(null)}>Ver cómo están las calles</Btn>
      <Btn icon="riesgo" onClick={() => ir('acudo')}>Me pasó algo aquí</Btn>
    </div>
  )

  return (
    <Screen titulo="Avisos">
      {hay && (
        <section className="ay-sec" aria-label="Alertas de clima vigentes">
          {alertas.map((a) => <AlertaClima key={a.id} a={a} ahora={ahora} />)}
          {acciones}
        </section>
      )}

      <div className="ay-card">
        <h2 className="ay-h" style={{ fontSize: 21 }}>Solo te avisamos si algo cambia</h2>
        <p className="ay-sub" style={{ fontSize: 15, lineHeight: 1.4 }}>
          Zona nueva, zona despejada o lluvia fuerte. Máximo 1 aviso por zona cada 30 min. Así lo pidió casi la mitad de las personas encuestadas (49.3%).
        </p>
        {on
          ? <button className="ay-on" onClick={toggleAvisos} disabled={ocupado}>✓ Avisos activados · toca para apagar</button>
          : <Btn variant="primary" icon="campana" onClick={toggleAvisos} disabled={ocupado}>{ocupado ? 'Activando…' : 'Activar avisos'}</Btn>}
        {nota && <p role="status" className="ay-nota">{nota}</p>}
      </div>

      <h2 className="ay-label" style={{ fontSize: 17 }}>¿De dónde quieres avisos?</h2>
      <div className="ay-grid2" role="group" aria-label="Municipios">
        {MUNICIPIOS_ZMG.map((m) => (
          <button key={m} className="ay-opt" aria-pressed={!!munis[m]} onClick={() => toggleMuni(m)}>
            <span>{m}</span>{munis[m] ? <span className="ay-si">✓ Sí</span> : <span className="ay-no">No</span>}
          </button>
        ))}
      </div>
      <p className="ay-sub">Por municipio o zona, nunca por tu ubicación exacta.</p>

      <h2 className="ay-label" style={{ fontSize: 17 }}>Ajustar mis avisos</h2>
      <div className="ay-lista-toggles">
        <Pref on={prefs.soloCambios} onClick={() => cambiarPref({ soloCambios: !prefs.soloCambios })}
          titulo="Solo si cambia el estado" desc="Sin avisos repetidos." />
        <Pref on={prefs.soloFuertes} onClick={() => cambiarPref({ soloFuertes: !prefs.soloFuertes })}
          titulo="Solo alertas fuertes" desc="Nivel 3 de 3 y cierres de calle." />
        <Pref on={false} disabled titulo="Avisarme 1 hora antes" desc="Para organizar tu día."
          extra={<span className="ay-toggle-d">Necesita pronóstico <PorConfirmar /></span>} />
        <button className={callado ? 'ay-on' : 'btn-ghost'} onClick={silenciar}>
          {callado
            ? `Silenciado hasta ${new Date(prefs.silencioHasta).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })} · toca para quitar`
            : 'Silenciar 2 horas'}
        </button>
      </div>
      <p className="ay-sub">Estos ajustes se guardan en este celular.</p>

      {!hay && (
        <>
          <h2 className="ay-label" style={{ fontSize: 17 }}>Alertas de clima</h2>
          {alertas === null && <p className="muted" role="status">Revisando alertas…</p>}
          {alertas === 'error' && <p className="muted">No pudimos revisar las alertas. Vuelve a intentar con señal.</p>}
          {Array.isArray(alertas) && (
            <div className="ay-vacio">
              <Icon name="lluvia" size={40} />
              <strong>Sin alertas de clima por ahora</strong>
              <span>Solo mostramos alertas con fuente oficial. Si cambia algo, aparece aquí.</span>
            </div>
          )}
          {Array.isArray(alertas) && <AlertaEjemplo />}
          {acciones}
        </>
      )}
    </Screen>
  )
}

// ---------------------------------------------------------------- Accesibilidad
const A11Y = [
  ['claro', 'Modo claro', 'Fondo claro para leer con sol'],
  ['grande', 'Texto grande', 'Todo se ve 22 % más grande'],
  ['contraste', 'Alto contraste', 'Negro y blanco, bordes gruesos'],
  ['dalton', 'Modo daltonismo', 'Escala azul → naranja, sin rojo/verde'],
  ['voz', 'Leer en voz alta', 'Botón “Escuchar” en el mapa'],
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
