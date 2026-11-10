// MÓDULO B · Reportar (Equipo Reporte). Pantallas: tipo, paso2, riesgo, mireporte, error.
// `paso2` cubre los pasos 2–4 del stepper con params.fase: (sin fase) Detalles · 'evidencia' · 'enviado' (escritorio).
// Hoja "enviado" (sheet === 'sent', móvil) y <ColaReportes/> (reintento de la cola sin señal; se monta en App).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { crearReporte, subirEvidencia, reportesCercanos, mensajeError } from '../lib/api.js'
import {
  armarReporte, etiquetaReporte, chipEstado, mensajeEnviado, lineaDeTiempo, casoAcudo, haceCuanto,
  linkWhatsApp, textoFamilia, textoRiesgo, encolar, leerCola, quitarDeCola, quitarExif,
  seguimientoReporte, soltarSesion, TIPO_LABEL, GRAVEDAD_CALLE, pasosStepper, resumenReporte,
} from '../lib/reportar.js'
import { Screen, Btn } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import '../styles/reportar.css'

// ---------- Envío compartido ----------
const esEscritorio = () => typeof window !== 'undefined' && !!window.matchMedia?.('(min-width:1024px)').matches
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

function useMandar() {
  const app = useApp()
  const [enviando, setEnviando] = useState(false)
  const mandar = useCallback(async (armado) => {
    setEnviando(true)
    const res = await enviar(app, armado)
    setEnviando(false)
    if (res.error) return app.ir('error', { codigo: res.error, ...armado })
    // El reporte ya quedó creado en el 3er toque; la evidencia se ofrece DESPUÉS (agregar_evidencia necesita el id).
    // Sin señal no hay id en el servidor todavía: se salta la evidencia.
    if (res.estado === 'cola') return terminarReporte(app, armado.rep.id)
    app.ir('paso2', { tipo: armado.rep.tipo, fase: 'evidencia', id: armado.rep.id })
  }, [app])
  return { mandar, enviando }
}

// Último paso: móvil → hoja "enviado" sobre el mapa (se ve el punto); escritorio → pantalla "¡Reporte enviado!".
function terminarReporte(app, id) {
  if (esEscritorio()) return app.ir('paso2', { fase: 'enviado', id })
  app.ir(null)
  app.setSheet('sent')
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

// Resumen del reporte enviado (tipo · ubicación · gravedad · foto).
function Resumen({ rep }) {
  return (
    <div className="rp-resumen">
      <b>Resumen de tu reporte</b>
      <ul>
        {resumenReporte(rep).map((x) => <li key={x.texto}><Icon name={x.icono} size={20} />{x.texto}</li>)}
      </ul>
    </div>
  )
}

// Seguimiento: si el reporte ya es público (activo) trae confirmaciones; se recarga con cada realtime (`version`).
function useSeguimiento(rep) {
  const { version, agregarMiReporte } = useApp()
  const [seg, setSeg] = useState(null)
  const id = rep?.id
  const vivo = rep && ['pendiente', 'activo', 'en_revision'].includes(rep.estado)
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

const Estado = ({ texto }) => <p className="rp-estado" role="status" aria-live="polite">{texto}</p>

// ---------- tipo ----------
export function Tipo() {
  const { ir, ubic, pedirUbicacion } = useApp()
  const [buscando, setBuscando] = useState(true)
  const localizar = useCallback(() => { setBuscando(true); pedirUbicacion().finally(() => setBuscando(false)) }, [pedirUbicacion])
  useEffect(() => { localizar() }, [localizar])

  const sinUbic = !ubic.real
  const persona = () => {
    // Persona en riesgo: primero la pantalla roja; el aviso se manda desde ahí (sin ubicación real no se manda).
    const armado = sinUbic ? null : armarReporte({ tipo: 'persona_en_riesgo', ubic })
    ir('riesgo', { armado })
  }
  const elegir = (tipo) => ir('paso2', { tipo })

  return (
    <Screen onBack={false} label="Reportar inundación · paso 1 de 4 · Tipo">
      <div className="rp-top">
        <button className="rp-btn-top" onClick={() => ir(null)}>Cancelar</button>
        <span className="rp-paso">Reportar inundación</span>
      </div>
      <Stepper actual={0} />
      <div className="rp-ubic">
        <Icon name="pin" size={22} stroke={2} />
        <div style={{ minWidth: 0, flex: 1 }}>
          {sinUbic ? (
            <>
              <b>{buscando ? 'Buscando tu ubicación…' : 'Necesitamos tu ubicación'}</b>
              <small>Para poner el reporte donde estás. Solo este punto, nunca tu recorrido.</small>
            </>
          ) : (
            <>
              <b>Tu ubicación actual</b>
              <small>Tu ubicación (±{Math.round(ubic.precision || 0)} m) y la hora ya van puestas</small>
            </>
          )}
        </div>
      </div>
      {sinUbic && !buscando && (
        <Btn variant="outline-acc" icon="centrar" onClick={localizar}>Usar mi ubicación</Btn>
      )}
      <h1 className="rp-h1">¿Qué se inundó?</h1>
      <div className="rp-tiles">
        <button className="tile" disabled={sinUbic} onClick={() => elegir('calle')}><Icon name="calle" size={54} stroke={1.8} />La calle</button>
        <button className="tile" disabled={sinUbic} onClick={() => elegir('casa')}><Icon name="casa" size={54} stroke={1.8} />Mi casa</button>
        <button className="tile" disabled={sinUbic} onClick={() => elegir('coche')}><Icon name="coche" size={54} stroke={1.8} />Un coche</button>
        <button className="tile tile--risk" onClick={persona}><Icon name="riesgo" size={54} stroke={1.8} />Persona<br />en riesgo<small>Abre 911</small></button>
      </div>
      {sinUbic && !buscando && <p className="rp-nota">Sin ubicación solo está disponible “Persona en riesgo” (abre el 911).</p>}
    </Screen>
  )
}

// ---------- paso2 ----------
const NIVELES = [
  { k: 'tobillo', t: 'A los tobillos', d: 'Se puede caminar con cuidado', h: 18, cls: 'p-bajo' },
  { k: 'rodilla', t: 'A las rodillas', d: 'Muebles y aparatos en riesgo', h: 44, cls: 'p-medio' },
  { k: 'cintura', t: 'A la cintura o más', d: 'Sal a un lugar alto', h: 64, cls: 'p-alto' },
]

export function Paso2() {
  const { params } = useApp()
  if (params.fase === 'evidencia') return <Evidencia />
  if (params.fase === 'enviado') return <Enviado />
  return <Detalles />
}

function Detalles() {
  const { ir, params, ubic } = useApp()
  const tipo = params.tipo || 'calle'
  const { mandar, enviando } = useMandar()
  const go = (detalle, pasanCarros) => mandar(armarReporte({ tipo, detalle, pasanCarros, ubic }))
  const conPersona = () => ir('riesgo', { armado: armarReporte({ tipo: 'persona_en_riesgo', detalle: 'dentro', ubic }), coche: true })

  return (
    <Screen onBack={false} label={`Reportar inundación · paso 2 de 4 · Detalles · ${TIPO_LABEL[tipo]}`}>
      <div className="rp-top">
        <button className="rp-btn-top" onClick={() => ir('tipo')} disabled={enviando}>← Atrás</button>
        <span className="rp-paso">{TIPO_LABEL[tipo]}</span>
      </div>
      <Stepper actual={1} />

      {tipo === 'calle' && (
        <>
          <h1 className="rp-h1">¿Cómo está el paso?</h1>
          <div className="rp-choices rp-choices--3">
            {GRAVEDAD_CALLE.map((g) => g.pasanCarros ? (
              <button key={g.k} className="choice" disabled={enviando} onClick={() => go(g.k, g.pasanCarros)}>{g.t}<small>{g.d}</small></button>
            ) : (
              <button key={g.k} className="choice choice--alto p-alto" disabled={enviando} onClick={() => go(g.k, g.pasanCarros)}>
                <span><span>{g.t}</span><small>{g.d}</small></span>
              </button>
            ))}
          </div>
        </>
      )}

      {tipo === 'casa' && (
        <>
          <h1 className="rp-h1">¿Hasta dónde llegó el agua?</h1>
          <div className="rp-choices" style={{ gap: 12 }}>
            {NIVELES.map((n) => (
              <button key={n.k} className="rp-nivel" disabled={enviando} onClick={() => go(n.k)}>
                <span className="fig" aria-hidden="true">
                  <svg width="56" height="96" viewBox="0 0 56 96"><circle cx="28" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M28 22v36M12 34l16-6 16 6M28 58l-10 30M28 58l10 30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                  <span className={`agua ${n.cls}`} style={{ height: n.h }} />
                </span>
                <span><b>{n.t}</b><small>{n.d}</small></span>
              </button>
            ))}
          </div>
        </>
      )}

      {tipo === 'coche' && (
        <>
          <h1 className="rp-h1 rp-h1--l">¿Hay alguien dentro del coche?</h1>
          <div className="rp-choices">
            <button className="choice choice--danger" disabled={enviando} onClick={conPersona}>Sí, hay alguien<small>Te llevamos a llamar al 911</small></button>
            <button className="choice" disabled={enviando} onClick={() => go('vacio')}>No, está vacío<small>Se reporta y te decimos a quién acudir</small></button>
          </div>
        </>
      )}
      <Estado texto={enviando ? 'Enviando tu reporte…' : ''} />
    </Screen>
  )
}

// ---------- paso2 · fase 'evidencia' (opcional, el reporte YA está enviado) ----------
function useSubirFoto(rep) {
  const { agregarMiReporte } = useApp()
  const [foto, setFoto] = useState(rep?.foto ? 'ok' : null) // null | 'subiendo' | 'ok' | código de error
  const elegir = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !rep) return
    setFoto('subiendo')
    try {
      const limpia = await quitarExif(f)
      const { error } = await subirEvidencia(rep.id, limpia)
      setFoto(error || 'ok')
      if (!error) agregarMiReporte({ ...rep, foto: true })
    } catch {
      setFoto('archivo_invalido')
    }
  }
  return { foto, elegir }
}

function Evidencia() {
  const app = useApp()
  const { params, misReportes } = app
  const rep = misReportes.find((r) => r.id === params.id) || misReportes[0]
  const { foto, elegir } = useSubirFoto(rep)
  const input = useRef(null)
  const listo = () => terminarReporte(app, rep?.id)
  const subiendo = foto === 'subiendo'
  const fallo = foto && !['subiendo', 'ok'].includes(foto)

  return (
    <Screen onBack={false} label="Reportar inundación · paso 3 de 4 · Evidencia">
      <div className="rp-top">
        <span className="rp-ok-linea" role="status"><Icon name="check" size={20} stroke={3} />Tu reporte ya está en el mapa</span>
      </div>
      <Stepper actual={2} />
      <h1 className="rp-h1">Agrega una foto</h1>
      <p className="rp-lead">Una foto ayuda a que otros vecinos confirmen tu reporte.</p>
      <button className={'rp-drop' + (foto === 'ok' ? ' ok' : '')} disabled={subiendo || foto === 'ok' || !rep} onClick={() => input.current?.click()}>
        <Icon name={foto === 'ok' ? 'check' : 'camara'} size={44} stroke={1.8} />
        <b>{foto === 'ok' ? 'Foto agregada' : subiendo ? 'Subiendo foto…' : fallo ? 'Elegir otra foto' : 'Subir foto'}</b>
        <small>{foto === 'ok' ? 'Le quitamos los datos ocultos (lugar, hora, equipo)' : 'Toca para tomar o elegir una foto'}</small>
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={elegir} />
      <p className="rp-nota" role="status" aria-live="polite">
        {fallo ? `No se subió la foto (${mensajeError(foto).titulo}). Tu reporte quedó igual.` : 'La foto es opcional. Antes de subirla le quitamos los datos ocultos.'}
      </p>
      <div className="rp-spacer" />
      <Btn variant="primary" disabled={foto !== 'ok'} onClick={listo}>Continuar</Btn>
      <Btn variant="ghost" disabled={subiendo} onClick={listo}>Omitir</Btn>
    </Screen>
  )
}

// ---------- paso2 · fase 'enviado' (escritorio; en móvil es la hoja) ----------
function Enviado() {
  const { ir, params, misReportes } = useApp()
  const rep = misReportes.find((r) => r.id === params.id) || misReportes[0]
  useSeguimiento(rep)
  if (!rep) return null
  const enCola = rep.estado === 'cola'
  const caso = casoAcudo(rep.tipo)
  return (
    <Screen onBack={false} label="Reporte enviado">
      <Stepper actual={3} />
      <div className="rp-enviado">
        <span className={'rp-sent-ok grande' + (enCola ? ' cola' : '')}><Icon name={enCola ? 'alerta' : 'check'} size={40} stroke={2.8} /></span>
        <h1 className="rp-h1">{enCola ? 'Reporte guardado' : '¡Reporte enviado!'}</h1>
        <span className={`rp-chip ${chipEstado(rep.estado).clase}`}>{chipEstado(rep.estado).texto}</span>
        <p className="rp-lead">{mensajeEnviado(rep.estado)}</p>
      </div>
      <Resumen rep={rep} />
      {caso && <button className="rp-acudo" onClick={() => ir('acudoresp', { caso })}>Qué hacer ahora: ¿A quién acudo?</button>}
      <div className="rp-spacer" />
      <Btn variant="primary" icon="mapa" onClick={() => ir(null)}>Ver en el mapa</Btn>
      <div className="rp-grid2">
        <Btn onClick={() => ir('mireporte', { id: rep.id })}>Seguir mi reporte</Btn>
        <Btn icon="mas" onClick={() => ir('tipo')}>Hacer otro reporte</Btn>
      </div>
    </Screen>
  )
}

// ---------- riesgo ----------
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
export function HojaEnviado() {
  const { misReportes, setSheet, ir } = useApp()
  const rep = misReportes[0]
  useSeguimiento(rep)
  if (!rep) return null

  const chip = chipEstado(rep.estado)
  const enCola = rep.estado === 'cola'
  const caso = casoAcudo(rep.tipo)

  return (
    <div className="sheet sheet--sent rp-sent rise" role="region" aria-label="Reporte enviado">
      <div className="rp-sent-head">
        <span className={'rp-sent-ok' + (enCola ? ' cola' : '')}><Icon name={enCola ? 'alerta' : 'check'} size={30} stroke={2.8} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="rp-sent-tit"><b>{enCola ? 'Reporte guardado' : '¡Reporte enviado!'}</b><span className={`rp-chip ${chip.clase}`}>{chip.texto}</span></div>
        </div>
        <button className="rp-x" aria-label="Cerrar y ver el mapa" onClick={() => setSheet('min')}><Icon name="cerrar" size={20} /></button>
      </div>
      <p>{mensajeEnviado(rep.estado)}</p>
      <Resumen rep={rep} />
      {caso && <button className="rp-acudo" onClick={() => ir('acudoresp', { caso })}>Qué hacer ahora: ¿A quién acudo?</button>}
      <div className="rp-grid2">
        <Btn icon="mapa" onClick={() => setSheet('min')}>Ver en el mapa</Btn>
        <Btn icon="mas" onClick={() => { setSheet('min'); ir('tipo') }}>Hacer otro reporte</Btn>
      </div>
      <Btn variant="ghost" onClick={() => ir('mireporte', { id: rep.id })}>Seguir mi reporte</Btn>
    </div>
  )
}

// ---------- mireporte ----------
export function MiReporte() {
  const { ir, params, misReportes } = useApp()
  const rep = misReportes.find((r) => r.id === params.id) || misReportes[0]
  const seg = useSeguimiento(rep)

  if (!rep) {
    return (
      <Screen titulo="Mi reporte">
        <p className="muted">Aún no has enviado reportes desde este celular.</p>
        <Btn variant="primary" icon="mas" onClick={() => ir('tipo')}>Reportar</Btn>
      </Screen>
    )
  }
  const pasos = lineaDeTiempo(rep.estado, rep.creado)
  const caso = casoAcudo(rep.tipo)
  const confirmaciones = seg?.confirmaciones ?? (rep.estado === 'activo' ? '—' : 0)
  const texto = textoFamilia(rep)

  return (
    <Screen titulo="Mi reporte">
      <p className="rp-sub" style={{ marginTop: -10 }}>{etiquetaReporte(rep)} · <span className={`rp-chip ${chipEstado(rep.estado).clase}`}>{chipEstado(rep.estado).texto}</span></p>
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
        <div className="rp-stat"><b>{confirmaciones}</b><small>vecinos lo confirmaron</small></div>
        <div className="rp-stat"><b>{haceCuanto(seg?.ultima)}</b><small>última confirmación</small></div>
      </div>
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
  const { codigo, payload, rep } = params
  const { mandar, enviando } = useMandar()
  const msg = mensajeError(codigo)
  // id_en_uso: ese UUID ya lo usó otra persona → se reintenta con uno nuevo; en los demás, mismo id (idempotente).
  const reintentar = payload && rep ? () => {
    const id = codigo === 'id_en_uso' ? crypto.randomUUID() : payload.id
    mandar({ payload: { ...payload, id }, rep: { ...rep, id } })
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
    duplicado_cercano: { t: 'Ver mi reporte', f: () => ir('mireporte') },
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
