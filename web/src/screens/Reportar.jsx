// MÓDULO B · Reportar (Equipo Reporte, ronda 3: manda el HTML validado del equipo).
// Pantallas: inicio, tipo, paso2 (params.fase: (sin fase) Detalles · 'evidencia' · 'enviado'), misreportes ("Cerca de ti"),
// mireporte, riesgo, error. <ColaReportes/> (reintento de la cola sin señal) se monta en App. HojaEnviado ya no se usa.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { crearReporte, reportesCercanos, mensajeError, misReportes as apiMisReportes, buscarLugar, textoBusqueda } from '../lib/api.js'
import {
  armarReporte, etiquetaReporte, chipEstado, mensajeEnviado, estadoEnviado, lineaDeTiempo, casoAcudo, haceCuanto,
  linkWhatsApp, textoFamilia, textoRiesgo, encolar, leerCola, quitarDeCola, quitarExif, subirEvidenciaReporte, tipoEvidencia,
  seguimientoReporte, soltarSesion, TIPO_LABEL, TIPOS_REPORTE, GRAVEDAD, pasosStepper, resumenReporte, textoUbicacion,
  unirMisReportes, filaMiReporte, filaCercano, iconoTipo, PRECISION_LUGAR_BUSCADO,
  validarArchivo, MENSAJE_ARCHIVO, ACEPTA_EVIDENCIA, tituloUbicacion, crearCandado,
} from '../lib/reportar.js'
import { Screen, Btn } from '../components/ui.jsx'
import Icon, { Logo } from '../components/Icon.jsx'
import NivelAgua from '../components/NivelAgua.jsx'
import '../styles/reportar.css'
import { MODO_PRUEBA, radioCercanos } from '../lib/prueba.js'
import { claseVoz } from '../lib/confirmar.js'
import { escucharFrase, resolverReporteVoz } from '../lib/vozReporte.js'
import { TEXTO_AVISO_VOZ, NOTA_VOZ, avisoVozAceptado, aceptarAvisoVoz } from '../lib/avisoVoz.js'

// Íconos propios del módulo (mismo estilo de línea que Icon.jsx); el resto viene de Icon.jsx.
const PROPIOS = {
  barras: <path d="M5 20v-4M10 20v-8M15 20v-12M20 20V4" />,
  imagen: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 16l-5-5-9 9" /></>,
  lapiz: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>,
  anonimo: <><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  rutas: <><circle cx="6.5" cy="5.5" r="2.5" /><circle cx="17.5" cy="18.5" r="2.5" /><path d="M9 5.5h6.5a3.5 3.5 0 0 1 0 7h-7a3.5 3.5 0 0 0 0 7H15" /></>,
  microfono: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
}
function Ico({ name, size = 24, stroke = 2 }) {
  if (!PROPIOS[name]) return <Icon name={name} size={size} stroke={stroke} />
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>{PROPIOS[name]}</svg>
  )
}
const Muestra = ({ patron }) => <span className={'rp-sw ' + patron} aria-hidden="true" />

// ---------- Envío compartido ----------
const sinRed = () => typeof navigator !== 'undefined' && navigator.onLine === false

// Manda un reporte. Éxito → mis reportes + refrescar. Sin red → cola local (mismo id). Otro error → { error }.
async function enviar(app, { payload, rep }) {
  const { data, error } = sinRed() ? { data: null, error: 'sin_red' } : await crearReporte(payload)
  if (!error) {
    const estado = data?.estado || 'pendiente'
    app.agregarMiReporte({ ...rep, estado })
    app.refrescar()
    return { estado }
  }
  if (error === 'sin_red') {
    encolar({ payload, rep })
    app.agregarMiReporte({ ...rep, estado: 'cola' })
    return { estado: 'cola' }
  }
  return { error }
}

// Reporte + evidencia elegida ANTES (contrato v2): se sube justo después de crear_reporte.
// Si la subida falla, el reporte se queda y se avisa. Solo fotos, y siempre sin EXIF (privacidad).
async function enviarConEvidencia(app, armado, archivo) {
  const res = await enviar(app, armado)
  if (res.error || !archivo) return res
  const rep = { ...armado.rep, estado: res.estado }
  if (res.estado === 'cola') {
    app.agregarMiReporte({ ...rep, evidenciaFallo: true })
    app.avisar('Sin señal: tu reporte se guardó, la foto no')
    return res
  }
  let error
  try {
    const limpio = await quitarExif(archivo)
    error = (await subirEvidenciaReporte(rep.id, limpio)).error
  } catch { error = 'archivo_invalido' }
  if (error) {
    app.agregarMiReporte({ ...rep, evidenciaFallo: true })
    app.avisar(`Tu reporte se envió, pero la foto no se subió (${mensajeError(error).titulo})`)
  } else {
    app.agregarMiReporte({ ...rep, evidencia: tipoEvidencia(archivo.type), archivo: archivo.name })
  }
  return res
}

function useMandar() {
  const app = useApp()
  const [enviando, setEnviando] = useState(false)
  // Candado síncrono: `disabled={enviando}` no alcanza a frenar dos toques antes del re-render.
  const candado = useRef(null)
  if (!candado.current) candado.current = crearCandado()
  const mandar = useCallback((armado, archivo = null) => candado.current(async () => {
    setEnviando(true)
    const res = await enviarConEvidencia(app, armado, archivo)
    setEnviando(false)
    if (res.error) return app.ir('error', { codigo: res.error, ...armado, archivo })
    app.ir('paso2', { fase: 'enviado', id: armado.rep.id }, { cerrarFlujo: true }) // atrás no regresa al formulario
  }), [app])
  return { mandar, enviando }
}

// Encabezado del flujo: ← Reportar inundación
function Cabeza({ onBack, disabled }) {
  return (
    <div className="rp-head">
      <button className="btn-icon rp-back" aria-label="Regresar" onClick={onBack} disabled={disabled}><Icon name="atras" /></button>
      <span className="rp-head-t">Reportar inundación</span>
    </div>
  )
}

// Stepper visual del flujo (Tipo · Detalles · Evidencia · Enviado).
function Stepper({ actual }) {
  const pasos = pasosStepper(actual)
  return (
    <ol className="rp-stepper" aria-label={`Paso ${actual + 1} de ${pasos.length}`}>
      {pasos.map((p, i) => (
        <li key={p.label} className={p.k} aria-current={i === actual ? 'step' : undefined}>
          <span className="dot" aria-hidden="true">{p.k === 'done' && <Icon name="check" size={14} stroke={3.2} />}</span>
          <span className="lbl">{p.label}<span className="sr-only">{p.k === 'done' ? ' · hecho' : p.k === 'now' ? ' · ahora' : ' · falta'}</span></span>
        </li>
      ))}
    </ol>
  )
}

// Resumen "Tu reporte" (tipo · nivel · ubicación · foto).
function Resumen({ rep }) {
  return (
    <div className="rp-resumen">
      <b>Tu reporte</b>
      <ul>
        {resumenReporte(rep).map((x) => (
          <li key={x.icono}><Ico name={x.icono} size={20} />{x.patron && <Muestra patron={x.patron} />}{x.texto}</li>
        ))}
      </ul>
    </div>
  )
}

// Seguimiento: si el reporte ya es público (activo) trae confirmaciones; se recarga con cada realtime (`version`).
function useSeguimiento(rep) {
  const { version, agregarMiReporte } = useApp()
  const [seg, setSeg] = useState(null)
  const id = rep?.id
  const vivo = rep && !rep.deServidor && ['pendiente', 'activo', 'en_revision'].includes(rep.estado)
  useEffect(() => {
    if (!id || !vivo) return
    let ok = true
    seguimientoReporte(id).then(({ data }) => {
      if (!ok || !data) return
      setSeg(data)
      if (data.estado && data.estado !== rep.estado) agregarMiReporte({ ...rep, estado: data.estado })
    })
    return () => { ok = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, vivo, version])
  return seg
}

// Mis reportes: mis_reportes() del backend (v2) unido al registro local; si el backend falla, solo lo local.
function useMisReportes() {
  const { misReportes: local, version } = useApp()
  const [servidor, setServidor] = useState(null)
  const [cargando, setCargando] = useState(true)
  useEffect(() => {
    let ok = true
    apiMisReportes().then(({ data, error }) => {
      if (!ok) return
      if (!error && Array.isArray(data)) setServidor(data)
      setCargando(false)
    })
    return () => { ok = false }
  }, [version])
  return { lista: unirMisReportes(servidor, local), cargando }
}

const Estado = ({ texto }) => <p className="rp-estado" role="status" aria-live="polite">{texto}</p>

// ---------- inicio ----------
// Ruteo propio no existe: "Rutas alternativas" abre Google Maps con tu punto como origen.
const linkRutas = (u) => `https://www.google.com/maps/dir/?api=1&origin=${Number(u.lat).toFixed(5)},${Number(u.lng).toFixed(5)}&travelmode=driving`

export function Inicio() {
  const { ir, ubic, misReportes, setSheet } = useApp()
  const ultimo = misReportes[0]
  const reciente = ultimo && ['pendiente', 'cola'].includes(ultimo.estado) && Date.now() - (ultimo.creado || 0) < 3 * 3600e3
  return (
    <Screen onBack={false} label="Inicio">
      <div className="rp-brand"><Logo size={44} /><span>¡Aguas!</span></div>
      <p className="rp-tagline">Reportar, confirmar y ver inundaciones en la ZMG.</p>
      <button className="rp-mini" onClick={() => { ir(null); setSheet('min') }} aria-label="Abrir el mapa">
        <svg viewBox="0 0 344 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect width="344" height="220" fill="var(--s2)" />
          <rect x="220" y="130" width="100" height="70" rx="12" fill="var(--s1)" />
          <g stroke="var(--line)" strokeWidth="10" fill="none" strokeLinecap="round">
            <path d="M-10 60L354 32" /><path d="M-10 150L354 128" /><path d="M150 -10L168 230" /><path d="M60 -10L40 230" /><path d="M270 -10L300 230" />
          </g>
        </svg>
        <span className="rp-cell p-alto" style={{ left: '46%', top: '18%' }} />
        <span className="rp-cell p-alto" style={{ left: '54%', top: '18%' }} />
        <span className="rp-cell p-medio" style={{ left: '14%', top: '52%' }} />
        <span className="rp-cell p-bajo" style={{ left: '76%', top: '40%' }} />
        <span className="rp-me" style={{ left: '32%', top: '74%' }} />
        <span className="rp-mini-cta"><Icon name="mapa" size={18} />Abrir el mapa</span>
      </button>
      {reciente && (
        <p className="rp-nota">Tu reporte está en el mapa · <b className="rp-sinconf">{ultimo.estado === 'cola' ? 'en cola, sin señal' : 'sin confirmar'}</b></p>
      )}
      <div className="rp-spacer" />
      <Btn variant="primary" icon="alerta" onClick={() => ir('tipo')}>Reportar inundación</Btn>
      <a className="btn btn-ghost rp-link-btn" href={linkRutas(ubic)} target="_blank" rel="noopener noreferrer">
        <Ico name="rutas" />Rutas alternativas<span className="sr-only"> (abre Google Maps)</span>
      </a>
    </Screen>
  )
}

// ---------- tipo ----------
const ICONO_TARJETA = { casa: 'casa', coche: 'coche', calle: 'calle', persona_en_riesgo: 'riesgo' }

// Reportar con voz: solo preselecciona tipo (y nivel si lo dijo) y avanza como si tocaras la tarjeta.
// Nunca envía: ubicación y "Enviar" siguen siendo manuales. Solo aparece si el navegador reconoce voz.
function useVozTipo(elegir) {
  const hayVoz = !!claseVoz()
  const [escuchando, setEscuchando] = useState(false)
  const [msg, setMsg] = useState('')
  const [aviso, setAviso] = useState(false) // aviso de privacidad en línea, antes de la primera escucha
  const [aceptado, setAceptado] = useState(() => avisoVozAceptado())
  const cancelar = useRef(() => {})
  useEffect(() => () => cancelar.current(), [])
  const iniciar = () => {
    setMsg(''); setEscuchando(true)
    cancelar.current = escucharFrase((alts) => {
      setEscuchando(false)
      const r = resolverReporteVoz(alts)
      if (r.ok) elegir(r.tipo, r.gravedad)
      else setMsg(r.mensaje)
    })
  }
  // La primera vez se avisa que el navegador puede mandar el audio a su proveedor; solo al aceptar se escucha.
  const escuchar = () => { if (avisoVozAceptado()) iniciar(); else setAviso(true) }
  const aceptar = () => { aceptarAvisoVoz(); setAceptado(true); setAviso(false); iniciar() }
  const cancelarAviso = () => setAviso(false)
  const parar = () => { cancelar.current(); setEscuchando(false); setAviso(false) }
  return { hayVoz, escuchando, msg, aviso, aceptado, escuchar, aceptar, cancelarAviso, parar }
}

export function Tipo() {
  const { ir, ubic, pedirUbicacion } = useApp()
  // Se pide la ubicación desde ya para que en Detalles esté lista.
  useEffect(() => { if (!ubic.real) pedirUbicacion().catch(() => {}) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Persona en riesgo: directo a la pantalla completa "Llama al 911" (ronda 1, a pedido de Diego 2026-11-11);
  // el aviso se pone en el mapa desde ahí con tu ubicación (sin GPS real no se manda).
  const elegir = (tipo, gravedad = null) => (tipo === 'persona_en_riesgo'
    ? ir('riesgo', { armado: ubic.real ? armarReporte({ tipo, ubic }) : null }, { cerrarFlujo: true })
    : ir('paso2', gravedad ? { tipo, gravedad } : { tipo }))
  const voz = useVozTipo(elegir)
  return (
    <Screen onBack={false} label="Reportar inundación · paso 1 de 4 · Tipo">
      <Cabeza onBack={() => ir('inicio')} />
      <Stepper actual={0} />
      <h1 className="rp-h1">¿Qué se inundó?</h1>
      <div className="rp-tiles">
        {TIPOS_REPORTE.map((k) => (
          <button key={k} className={'tile tile--' + k + (k === 'persona_en_riesgo' ? ' tile--risk' : '')} onClick={() => { voz.parar(); elegir(k) }}>
            <Icon name={ICONO_TARJETA[k]} size={54} stroke={1.8} />{TIPO_LABEL[k]}
          </button>
        ))}
      </div>
      {voz.hayVoz && (
        <div className="rp-voz">
          {voz.aviso ? (
            <div className="rp-aviso-voz" role="group" aria-labelledby="rp-aviso-voz-txt">
              <p id="rp-aviso-voz-txt">{TEXTO_AVISO_VOZ}</p>
              <Btn variant="primary" onClick={voz.aceptar}>Entendido, usar voz</Btn>
              <Btn variant="ghost" onClick={voz.cancelarAviso}>Cancelar</Btn>
            </div>
          ) : voz.escuchando
            ? <Btn variant="ghost" icon="cerrar" onClick={voz.parar}>Cancelar</Btn>
            : <button className="btn btn-ghost rp-link-btn" onClick={voz.escuchar}><Ico name="microfono" />Reportar con voz</button>}
          {voz.aceptado && !voz.aviso && <p className="rp-nota-voz">{NOTA_VOZ}</p>}
          <p className="rp-estado" role="status" aria-live="polite">
            {voz.escuchando ? 'Escuchando… di qué se inundó y cuánta agua hay.' : voz.msg}
          </p>
        </div>
      )}
      <p className="rp-hint"><Ico name="anonimo" size={20} /><span>Tu reporte es anónimo. No pedimos datos personales.</span></p>
    </Screen>
  )
}

// ---------- paso2 ----------
export function Paso2() {
  const { params } = useApp()
  if (params.fase === 'evidencia') return <Evidencia />
  if (params.fase === 'enviado') return <Enviado />
  return <Detalles />
}

// Búsqueda de lugar (Nominatim vía api.buscarLugar). Solo al enviar (Enter o "Buscar"): sus reglas
// prohíben autocompletar. Es la única forma de reportar sin GPS.
function BuscarLugar({ onElegir, onCerrar }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState({ estado: 'idle', lista: [] })
  const pedido = useRef(0)
  useEffect(() => () => { pedido.current++ }, [])
  const buscar = async (e) => {
    e.preventDefault()
    const texto = textoBusqueda(q)
    const n = ++pedido.current
    if (!texto) { setRes({ estado: 'corto', lista: [] }); return }
    setRes((r) => ({ ...r, estado: 'buscando' }))
    const { data, error } = await buscarLugar(texto)
    if (n === pedido.current) setRes({ estado: error ? 'error' : 'listo', lista: data || [] })
  }
  return (
    <form className="rp-buscar" role="search" onSubmit={buscar}>
      <label htmlFor="rp-q"><b>Escribe la ubicación</b></label>
      <div className="rp-buscar-fila">
        <input id="rp-q" type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search"
          placeholder="Calle, colonia o lugar" autoComplete="off" />
        <button type="submit" className="btn rp-buscar-btn" disabled={res.estado === 'buscando'}>Buscar</button>
        <button type="button" className="btn-icon rp-back" aria-label="Cerrar búsqueda" onClick={onCerrar}><Icon name="cerrar" size={20} /></button>
      </div>
      <p className="rp-sub" role="status" aria-live="polite">
        {res.estado === 'buscando' ? 'Buscando…' : res.estado === 'error' ? 'No pudimos buscar ahora. Intenta de nuevo.'
          : res.estado === 'corto' ? 'Escribe al menos 3 letras y toca Buscar.'
            : res.estado === 'listo' && !res.lista.length ? 'Sin resultados en la ZMG.' : ''}
      </p>
      {!!res.lista.length && (
        <ul className="rp-resultados">
          {res.lista.map((x) => (
            <li key={`${x.lat},${x.lng}`}>
              <button type="button" onClick={() => onElegir(x)}><Icon name="pin" size={20} />{x.nombre}</button>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}

function Detalles() {
  const { ir, params, ubic, pedirUbicacion } = useApp()
  const tipo = params.tipo || 'calle'
  const [gravedad, setGravedad] = useState(params.gravedad || null)
  const [lugar, setLugar] = useState(params.lugar?.elegido ? params.lugar : null)
  const [editar, setEditar] = useState(false)
  const [buscandoGps, setBuscandoGps] = useState(!ubic.real)

  useEffect(() => { if (!ubic.real) pedirUbicacion().catch(() => {}).finally(() => setBuscandoGps(false)) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // PRIVACIDAD: el GPS del dispositivo NO va a Nominatim (tercero). Se muestra "Tu ubicación (GPS) ±N m".
  const punto = lugar || (ubic.real ? { lat: ubic.lat, lng: ubic.lng, precision: ubic.precision } : null)
  const textoPunto = lugar ? lugar.direccion
    : ubic.real ? textoUbicacion(null, ubic.precision)
    : buscandoGps ? 'Buscando tu ubicación…' : 'No tenemos tu ubicación. Toca el lápiz para escribirla.'
  const elegir = (x) => { setLugar({ lat: x.lat, lng: x.lng, precision: PRECISION_LUGAR_BUSCADO, direccion: x.nombre, elegido: true }); setEditar(false) }

  return (
    <Screen onBack={false} label={`Reportar inundación · paso 2 de 4 · Detalles · ${TIPO_LABEL[tipo]}`}>
      <Cabeza onBack={() => ir('tipo')} />
      <Stepper actual={1} />
      {tipo === 'persona_en_riesgo' && (
        <div className="rp-emerg" role="alert">
          <p className="rp-emerg-t"><span className="rp-sw rp-sw--riesgo" aria-hidden="true">!</span>Persona en riesgo</p>
          <p>Si alguien está atrapado o herido, llama primero al 911. Después termina el reporte.</p>
          <a className="btn btn-danger rp-link-btn" href="tel:911"><Icon name="telefono" />Llamar al 911</a>
        </div>
      )}
      <h1 className="rp-h1">¿Cuánta agua hay?</h1>
      <div className="rp-opts" role="group" aria-label="¿Cuánta agua hay?">
        {GRAVEDAD.map((g) => (
          <button key={g.k} className={'rp-opt' + (gravedad === g.k ? ' sel' : '')} aria-pressed={gravedad === g.k} onClick={() => setGravedad(g.k)}>
            <NivelAgua nivel={g.nivel} />
            <span className="txt"><b>{g.t}</b><small>{g.d}</small></span>
            <span className="radio" aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="rp-label">Ubicación</p>
      <div className="rp-loc">
        <Icon name="pin" size={24} />
        <div className="txt"><b>{tituloUbicacion({ elegido: !!lugar, real: ubic.real })}</b><span>{textoPunto}</span></div>
        <button className="btn-icon rp-back" aria-label="Cambiar ubicación" aria-expanded={editar} onClick={() => setEditar((v) => !v)}><Ico name="lapiz" size={20} /></button>
      </div>
      {editar && <BuscarLugar onElegir={elegir} onCerrar={() => setEditar(false)} />}
      {lugar && <button className="btn-text" onClick={() => setLugar(null)}>Usar mi ubicación actual</button>}
      <div className="rp-spacer" />
      <Btn variant="primary" disabled={!gravedad || !punto}
        onClick={() => ir('paso2', { tipo, gravedad, lugar: punto, fase: 'evidencia' })}>Continuar</Btn>
      {(!gravedad || !punto) && <p className="rp-nota">{!gravedad ? 'Elige cuánta agua hay para continuar.' : 'Falta la ubicación para continuar.'}</p>}
    </Screen>
  )
}

// ---------- paso2 · fase 'evidencia' (opcional; se elige ANTES de enviar) ----------
// Solo fotos jpeg/png/webp: los videos guardan GPS en sus metadatos (ACEPTA_EVIDENCIA en lib/reportar.js).

function Evidencia() {
  const { ir, params } = useApp()
  const { tipo, gravedad, lugar } = params
  const [archivo, setArchivo] = useState(null)
  const [aviso, setAviso] = useState('')
  const input = useRef(null)
  const { mandar, enviando } = useMandar()
  const volver = () => ir('paso2', { tipo, gravedad, lugar })
  useEffect(() => { if (!lugar || !gravedad) volver() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const elegir = (e) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    const problema = validarArchivo(f)
    setAviso(problema ? MENSAJE_ARCHIVO[problema] : '')
    if (!problema) setArchivo(f)
  }
  const enviarYa = () => mandar(armarReporte({ tipo, gravedad, ubic: lugar, direccion: lugar?.direccion }), archivo)

  return (
    <Screen onBack={false} label="Reportar inundación · paso 3 de 4 · Evidencia">
      <Cabeza onBack={volver} disabled={enviando} />
      <Stepper actual={2} />
      <h1 className="rp-h1">Agrega una foto</h1>
      <p className="rp-lead">Ayuda a que otros vecinos confirmen tu reporte más rápido.</p>
      <button className={'rp-drop' + (archivo ? ' ok' : '')} disabled={enviando} onClick={() => input.current?.click()}>
        <Ico name={archivo ? 'check' : 'imagen'} size={40} stroke={1.8} />
        <b>{archivo ? 'Foto agregada' : 'Subir foto'}</b>
        <small>{archivo ? archivo.name : 'Toca para elegir una foto (JPG, PNG o WEBP)'}</small>
      </button>
      <input ref={input} type="file" accept={ACEPTA_EVIDENCIA} hidden onChange={elegir} />
      {aviso && <p className="rp-nota" role="alert">{aviso}</p>}
      {archivo && <button className="btn-text" disabled={enviando} onClick={() => setArchivo(null)}>Quitar foto</button>}
      <p className="rp-hint"><Ico name="info" size={20} /><span>Es opcional. Cuida que no se vean caras ni placas. A las fotos les quitamos los datos ocultos (lugar, hora, equipo).</span></p>
      <div className="rp-spacer" />
      <Estado texto={enviando ? (archivo ? 'Enviando tu reporte y tu foto…' : 'Enviando tu reporte…') : ''} />
      <Btn variant="primary" disabled={enviando} onClick={enviarYa}>{archivo ? 'Enviar reporte' : 'Enviar sin foto'}</Btn>
    </Screen>
  )
}

// ---------- paso2 · fase 'enviado' ----------
function Enviado() {
  const { ir, params, misReportes, setSheet } = useApp()
  const rep = misReportes.find((r) => r.id === params.id) || misReportes[0]
  useSeguimiento(rep)
  if (!rep) return null
  const enCola = rep.estado === 'cola'
  return (
    <Screen onBack={false} label="Reporte enviado">
      <Cabeza onBack={() => ir('inicio')} />
      <Stepper actual={3} />
      <div className="rp-enviado">
        <span className={'rp-sent-ok grande' + (enCola ? ' cola' : '')}><Icon name={enCola ? 'alerta' : 'check'} size={40} stroke={2.8} /></span>
        <h1 className="rp-h1">{enCola ? 'Reporte guardado' : 'Reporte enviado'}</h1>
        <p className="rp-lead">{mensajeEnviado(rep.estado)}</p>
        <span className={`rp-chip ${chipEstado(rep.estado).clase}`}>{estadoEnviado(rep.estado)}</span>
      </div>
      <Resumen rep={rep} />
      {rep.tipo === 'persona_en_riesgo' && <a className="rp-tel" href="tel:911"><Icon name="telefono" />Si es emergencia, llama al 911</a>}
      <div className="rp-spacer" />
      <Btn variant="primary" icon="mapa" onClick={() => { ir(null); setSheet('min') }}>Ver en el mapa</Btn>
      <Btn variant="ghost" onClick={() => ir('tipo')}>Hacer otro reporte</Btn>
    </Screen>
  )
}

// ---------- riesgo ----------
// Ronda 3: el HTML del equipo pone el 911 dentro de Detalles; esta pantalla roja queda registrada pero sin entrada desde el flujo.
export function Riesgo() {
  const app = useApp()
  const { ir, params, ubic } = app
  const armado = params.armado || null
  const coche = !!params.coche
  const [envio, setEnvio] = useState(armado ? 'enviando' : 'sin_ubic')
  const mandado = useRef(false)

  useEffect(() => {
    if (!armado || mandado.current) return
    mandado.current = true
    enviar(app, armado).then((res) => setEnvio(res.error || res.estado))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lat = armado?.rep.lat ?? ubic.lat
  const lng = armado?.rep.lng ?? ubic.lng
  const linea = {
    enviando: 'Poniendo tu aviso en el mapa…',
    pendiente: 'Tu aviso ya está en el mapa.',
    activo: 'Tu aviso ya está en el mapa.',
    cola: 'Sin señal: tu aviso se guardó y se manda solo cuando vuelva.',
    sin_ubic: 'No tenemos tu ubicación: tu aviso no se puso en el mapa.',
  }[envio] || `No pudimos poner tu aviso en el mapa (${mensajeError(envio).titulo}).`

  return (
    <section className="screen rp-riesgo" aria-label="Persona en riesgo · llama al 911">
      <div className="screen-inner">
        <div className="tag">{coche ? 'Alguien dentro de un coche' : 'Persona en riesgo'}</div>
        <h1>Llama al 911 ahora</h1>
        <p>{coche ? 'Si el agua sube, salgan del coche hacia un lugar alto.' : 'No entres al agua.'}</p>
        <div className="envio" role="status" aria-live="polite">{linea}</div>
        <div className="rp-spacer" />
        <a className="rp-911" href="tel:911"><Icon name="telefono" size={38} />Llamar al 911</a>
        <a className="sec" href={linkWhatsApp(textoRiesgo(lat, lng, coche))} target="_blank" rel="noopener noreferrer">
          <Icon name="compartir" />Compartir ubicación con mi familia
        </a>
        <button className="volver" onClick={() => ir(null)}>
          {['pendiente', 'activo', 'cola'].includes(envio) ? 'Volver al mapa (tu aviso ya está arriba)' : 'Volver al mapa'}
        </button>
      </div>
    </section>
  )
}

// ---------- hoja "enviado" (móvil) ----------
// Ronda 3: el equipo validó "Reporte enviado" como pantalla completa en móvil y escritorio. Ya no se usa.
export function HojaEnviado() { return null }

// ---------- misreportes · "Cerca de ti" (pestaña Reportes) ----------
function Chip({ texto, clase }) { return <span className={'rp-chip ' + clase}>{texto}</span> }

export function MisReportes() {
  const { ir, ubic, pedirUbicacion, setOverlay, version } = useApp()
  const { lista, cargando } = useMisReportes()
  const [cerca, setCerca] = useState({ estado: 'cargando', lista: [] })
  useEffect(() => {
    // En modo prueba no hace falta GPS: con el punto de ejemplo y radio de toda la ZMG basta.
    if (!ubic.real && !MODO_PRUEBA) { setCerca({ estado: 'sin_ubic', lista: [] }); return }
    let ok = true
    reportesCercanos(ubic.lat, ubic.lng, radioCercanos(MODO_PRUEBA)).then(({ data, error }) => {
      if (ok) setCerca({ estado: error ? 'error' : 'listo', lista: (data || []).filter((x) => !x.es_propio) })
    })
    return () => { ok = false }
  }, [ubic.real, ubic.lat, ubic.lng, version])
  const confirmar = (x) => { ir(null); setOverlay({ tipo: 'confirm', reporte: x }) }

  return (
    <Screen onBack={false} label="Reportes · Cerca de ti">
      <div>
        <h1 className="rp-h1">Cerca de ti</h1>
        <p className="rp-sub">{MODO_PRUEBA ? 'Reportes de toda la ZMG' : ubic.real ? 'A 300 m de tu ubicación' : 'Activa tu ubicación para ver lo cercano'}</p>
      </div>
      {MODO_PRUEBA && (
        <p className="rp-prueba" role="note"><Icon name="alerta" size={18} />Modo prueba: puedes confirmar reportes aunque no estés cerca.</p>
      )}

      <h2 className="rp-label">Tus reportes</h2>
      {!lista.length ? (
        <p className="muted">{cargando ? 'Cargando tus reportes…' : 'Aún no has enviado reportes desde este celular.'}</p>
      ) : (
        <ul className="rp-items">
          {lista.map((r) => {
            const f = filaMiReporte(r)
            return (
              <li key={r.id}>
                <button className="rp-item" onClick={() => ir('mireporte', { id: r.id })}>
                  <span className={"rp-badge rp-badge--" + r.tipo}><Icon name={iconoTipo(r.tipo)} size={26} /></span>
                  <span className="txt">
                    <b>Tu reporte · {f.titulo}</b>
                    {r.direccion && <span className="lugar">{r.direccion}</span>}
                    <span className="tags">
                      <Chip texto={f.estado} clase={chipEstado(r.estado).clase} />
                      {f.nivel && <span className="rp-tag"><Muestra patron={f.nivel.patron} />{f.nivel.texto}</span>}
                    </span>
                    <small>Enviado {f.hace}{f.confirmaciones ? ` · ${f.confirmaciones}` : ''}</small>
                  </span>
                  <Icon name="chevron" size={20} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <h2 className="rp-label">Reportes de otros vecinos</h2>
      {cerca.estado === 'sin_ubic' && <Btn variant="outline-acc" icon="centrar" onClick={() => pedirUbicacion().catch(() => {})}>Usar mi ubicación</Btn>}
      {cerca.estado === 'cargando' && <p className="muted">Buscando reportes cerca…</p>}
      {cerca.estado === 'error' && <p className="muted">No pudimos cargar los reportes cercanos. Intenta en un momento.</p>}
      {cerca.estado === 'listo' && !cerca.lista.length && <p className="muted">No hay reportes de otros vecinos cerca de ti.</p>}
      {!!cerca.lista.length && (
        <ul className="rp-items">
          {cerca.lista.map((x) => {
            const f = filaCercano(x)
            return (
              <li key={x.id}>
                <button className="rp-item" onClick={() => confirmar(x)} aria-label={`${f.titulo}, ${f.lugar}. Confirmar si sigue`}>
                  <span className={'rp-badge rp-badge--' + x.tipo + (x.tipo === 'persona_en_riesgo' ? ' riesgo' : '')}><Icon name={iconoTipo(x.tipo)} size={26} /></span>
                  <span className="txt">
                    <b>{f.titulo}</b>
                    {f.lugar && <span className="lugar">{f.lugar}</span>}
                    <span className="tags">
                      <Chip texto={f.estado} clase={x.estado === 'activo' ? 'chip-act' : 'chip-pend'} />
                      {f.nivel && <span className="rp-tag"><Muestra patron={f.nivel.patron} />{f.nivel.texto}</span>}
                    </span>
                    {f.hace && <small>{f.hace}</small>}
                  </span>
                  <Icon name="chevron" size={20} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <a className="rp-item rp-item--link" href={linkRutas(ubic)} target="_blank" rel="noopener noreferrer">
        <span className="rp-badge"><Ico name="rutas" size={26} /></span>
        <span className="txt"><b>Rutas alternativas</b><small>Abre Google Maps con tu ubicación como punto de partida.</small></span>
        <Icon name="chevron" size={20} />
      </a>
    </Screen>
  )
}

// ---------- mireporte ----------
export function MiReporte() {
  const { ir, params, misReportes } = useApp()
  const { lista } = useMisReportes()
  const rep = lista.find((r) => r.id === params.id) || misReportes.find((r) => r.id === params.id) || lista[0]
  const seg = useSeguimiento(rep)

  if (!rep) {
    return (
      <Screen titulo="Mi reporte" onBack={() => ir('misreportes')}>
        <p className="muted">Aún no has enviado reportes desde este celular.</p>
        <Btn variant="primary" icon="mas" onClick={() => ir('tipo')}>Reportar inundación</Btn>
      </Screen>
    )
  }
  const pasos = lineaDeTiempo(rep.estado, rep.creado)
  const caso = casoAcudo(rep.tipo)
  const confirmaciones = rep.confirmacionesSi ?? seg?.confirmaciones ?? (rep.estado === 'activo' ? '—' : 0)
  const ultima = rep.ultima ?? seg?.ultima
  const texto = textoFamilia(rep)
  const f = filaMiReporte(rep)

  return (
    <Screen titulo="Mi reporte" onBack={() => ir('misreportes')}>
      <p className="rp-sub" style={{ marginTop: -10 }}>{etiquetaReporte(rep)} · <span className={`rp-chip ${chipEstado(rep.estado).clase}`}>{f.estado}</span></p>
      {rep.direccion && <p className="rp-sub"><Icon name="pin" size={16} /> {rep.direccion}</p>}
      {rep.estado === 'no_enviado' && (
        <div className="card-ejemplo"><b>No se pudo enviar.</b> {mensajeError(rep.error).texto}</div>
      )}
      <ol className="rp-tl" aria-label="Estado del reporte">
        {pasos.map((p, i) => (
          <li key={p.label} aria-current={p.k === 'now' ? 'step' : undefined}>
            <div className="col">
              <span className={`dot ${p.k}`}>{p.k === 'done' && <Icon name="check" size={16} stroke={3} />}</span>
              {i < pasos.length - 1 && <span className="line" />}
            </div>
            <div className="txt">
              <b>{p.label}<span className="sr-only">{p.k === 'done' ? ' · hecho' : p.k === 'now' ? ' · ahora' : ' · falta'}</span></b>
              <small>{p.desc}</small>
            </div>
          </li>
        ))}
      </ol>
      <div className="rp-stats">
        <div className="rp-stat"><b>{confirmaciones}</b><small>confirmaciones “sí”</small></div>
        <div className="rp-stat"><b>{haceCuanto(ultima)}</b><small>última confirmación</small></div>
      </div>
      {f.nivel && <p className="rp-tag rp-tag--l"><Muestra patron={f.nivel.patron} />{f.nivel.texto}</p>}
      <a className="rp-wa" href={linkWhatsApp(texto)} target="_blank" rel="noopener noreferrer"><Icon name="compartir" />Avisar a mi familia por WhatsApp</a>
      <div className="rp-cita">“{texto}”</div>
      <Btn style={{ fontSize: 17 }} onClick={() => (caso ? ir('acudoresp', { caso }) : ir('acudo'))}>¿A quién acudo?</Btn>
      <p className="rp-nota">Nunca mostramos quién hizo un reporte.</p>
    </Screen>
  )
}

// ---------- error ----------
export function ErrorPantalla() {
  const app = useApp()
  const { ir, params, ubic, setOverlay, avisar } = app
  const { codigo, payload, rep, archivo } = params
  const { mandar, enviando } = useMandar()
  const msg = mensajeError(codigo)
  // id_en_uso: ese UUID ya lo usó otra persona → se reintenta con uno nuevo; en los demás, mismo id (idempotente).
  const reintentar = payload && rep ? () => {
    const id = codigo === 'id_en_uso' ? crypto.randomUUID() : payload.id
    mandar({ payload: { ...payload, id }, rep: { ...rep, id } }, archivo)
  } : null

  const confirmarCercanos = async () => {
    const { data } = await reportesCercanos(ubic.lat, ubic.lng)
    const otro = (data || []).find((x) => !x.es_propio)
    ir(null)
    if (otro) setOverlay({ tipo: 'confirm', reporte: otro })
    else avisar('No hay reportes cerca por confirmar')
  }

  const accion = {
    fuera_de_zmg: { t: 'Entendido', f: () => ir(null), tel: true },
    limite_por_hora: { t: 'Confirmar reportes cercanos', f: confirmarCercanos },
    duplicado_cercano: { t: 'Ver mis reportes', f: () => ir('misreportes') },
    sin_sesion: reintentar && { t: 'Continuar y enviar', f: async () => { await soltarSesion(); reintentar() } },
  }[codigo] || (reintentar ? { t: 'Volver a intentar', f: reintentar, tel: true } : { t: 'Volver al mapa', f: () => ir(null), tel: true, sola: true })

  return (
    <Screen onBack={false} label={msg.titulo}>
      <div className="rp-err" style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, paddingTop: 32 }}>
        <div className="rp-err-ico"><Icon name="error" size={36} /></div>
        <h1>{msg.titulo}</h1>
        <p>{msg.texto}</p>
        <div className="rp-spacer" />
        {accion.tel && <a className="rp-tel" href="tel:911"><Icon name="telefono" />Si es emergencia, llama al 911</a>}
        <Btn variant="primary" disabled={enviando} onClick={accion.f}>{enviando ? 'Enviando…' : accion.t}</Btn>
        {!accion.sola && <Btn variant="ghost" onClick={() => ir(null)}>Volver al mapa</Btn>}
      </div>
    </Screen>
  )
}

// ---------- cola sin señal ----------
// Monta <ColaReportes/> una vez en App: al abrir y al volver la red (evento `online`) manda lo que quedó en `aguas.cola`.
let procesando = false
export function ColaReportes() {
  const app = useApp()
  const ref = useRef(app)
  ref.current = app
  useEffect(() => {
    const procesar = async () => {
      if (procesando || sinRed() || !leerCola().length) return
      procesando = true
      let enviados = 0
      try {
        for (const item of leerCola()) {
          const { data, error } = await crearReporte(item.payload)
          if (error === 'sin_red') break
          quitarDeCola(item.payload.id)
          if (error) {
            ref.current.agregarMiReporte({ ...item.rep, estado: 'no_enviado', error })
            ref.current.avisar(`No se envió tu reporte: ${mensajeError(error).titulo}`)
          } else {
            ref.current.agregarMiReporte({ ...item.rep, estado: data?.estado || 'pendiente' })
            enviados++
          }
        }
      } finally { procesando = false }
      if (enviados) {
        ref.current.refrescar()
        ref.current.avisar(enviados === 1 ? 'Volvió la señal: tu reporte se envió' : `Volvió la señal: se enviaron ${enviados} reportes`)
      }
    }
    procesar()
    window.addEventListener('online', procesar)
    return () => window.removeEventListener('online', procesar)
  }, [])
  return null
}
