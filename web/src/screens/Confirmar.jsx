// MÓDULO D · Confirmación (Equipo 4). Aviso "¿Sigue inundado?" (overlay), alerta previa en ruta,
// detector de cercanía/movimiento y "Mi reporte" (avisar cuando cambia el estado visible).
// Flujo y copy: material validado del equipo. Look: design system (tokens.css / components.css / Icon.jsx).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useApp } from '../lib/store.jsx'
import { reportesCercanos, misReportes as cargarMisReportes, direccionDe } from '../lib/api.js'
import { distanciaM } from '../lib/mapa.js'
import Icon from '../components/Icon.jsx'
import {
  RADIO_ALERTA_M, CADA_MS, CADA_MIO_MS, CIERRE_PASIVO_MS, elegirCercano, clasificarCercanos, puedePreguntar,
  lugarDe, tipoDe, horaDe, insignia, nivelRiesgo, textoLlegas, mensajeConfirmar, responder, registrarVoto,
  textoGracias, notasGracias, leerPreguntados, marcarPreguntado, leerAlertados, marcarAlertado, claseVoz,
  escucharVoz, hablar, senal, permiteSenal, urlDesviar, velocidadDe, enMovimiento, leerViaje, cambiarViaje,
  suscribirViaje, puedeTocar, cambiosMios, leerMios, guardarMios,
} from '../lib/confirmar.js'
import '../styles/confirmar.css'
import { TEXTO_AVISO_VOZ, NOTA_VOZ, avisoVozAceptado, aceptarAvisoVoz, escuchaAutomatica } from '../lib/avisoVoz.js'
import { MODO_PRUEBA } from '../lib/prueba.js'

const usarViaje = () => useSyncExternalStore(suscribirViaje, leerViaje)

// Overlay: overlay = { tipo:'confirm', reporte, modo?: 'zona' | 'alerta' }. reporte = fila de reportes_cercanos.
export function AvisoConfirmar() {
  const { overlay, setOverlay } = useApp()
  const cerrar = useCallback(() => setOverlay(null), [setOverlay])
  const rep = overlay?.tipo === 'confirm' ? overlay.reporte : null
  if (!rep) return null
  return <Aviso key={rep.id + (overlay.modo || 'zona')} rep={rep} modo={overlay.modo || 'zona'} cerrar={cerrar} />
}

// Micrófono (ícono propio del módulo; Icon.jsx no tiene uno).
const Mic = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
  </svg>
)

function Insignia({ rep }) {
  const { antiguo, texto } = insignia(rep)
  return (
    <p className={'cf-insignia' + (antiguo ? ' antigua' : '')}>
      <Icon name={antiguo ? 'alerta' : 'check'} size={18} stroke={2.4} />{texto}
    </p>
  )
}

function Nivel({ nivel }) {
  const n = nivelRiesgo(nivel)
  if (!n) return null
  const cerrado = nivel === 'alto' || nivel === 'critico'
  return (
    <div className="cf-badges">
      <span className="cf-badge"><i className={'cf-sw ' + (nivel === 'critico' ? 'cf-sw-critico' : 'p-' + nivel)} aria-hidden="true" />{n.nombre}</span>
      <span className="cf-badge"><Icon name={cerrado ? 'cerrar' : 'alerta'} size={16} stroke={2.4} />{n.estado}</span>
    </div>
  )
}

function Datos({ rep, calle, conCalle = true }) {
  const hora = horaDe(rep.creado_en)
  return (
    <>
      {conCalle && <p className="cf-calle">{tipoDe(rep)}: <b>{calle}</b></p>}
      <Insignia rep={rep} />
      <Nivel nivel={rep.nivel} />
      {hora && <p className="cf-hora">Reportado a las {hora}</p>}
    </>
  )
}

function Aviso({ rep, modo, cerrar }) {
  const { avisar, refrescar, medio, prefs } = useApp()
  const viaje = usarViaje()
  const tocar = puedeTocar(medio, viaje)
  const [paso, setPaso] = useState('pregunta') // pregunta | yaNo | gracias
  const [enviando, setEnviando] = useState(null)
  const [enviado, setEnviado] = useState(null)
  const [final, setFinal] = useState(null)
  const [escuchando, setEscuchando] = useState(false)
  const [vozMsg, setVozMsg] = useState('')
  const [avisoVoz, setAvisoVoz] = useState(false) // aviso de privacidad en línea, antes de la primera escucha
  const [vozAceptada, setVozAceptada] = useState(() => avisoVozAceptado())
  const [calle, setCalle] = useState(rep.calle || rep.nombre || null)
  const primero = useRef(null)
  const cancelarVoz = useRef(() => {})
  const ocupadoRef = useRef(false)
  const hayVoz = !!claseVoz()
  const ocupado = !!enviando || !!enviado
  const calleTxt = calle || lugarDe(rep)

  // Calle con Nominatim (D-020) si el backend no manda nombre.
  useEffect(() => {
    if (calle || !Number.isFinite(rep.lat) || !Number.isFinite(rep.lng)) return undefined
    let vivo = true
    direccionDe(rep.lat, rep.lng).then(({ data }) => { if (vivo && data) setCalle(data) })
    return () => { vivo = false }
  }, [rep.lat, rep.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (tocar) primero.current?.focus() }, [paso, tocar])
  useEffect(() => () => cancelarVoz.current(), [])

  // El vehículo empezó a avanzar: se cierra todo lo táctil y se pregunta al detenerse (equipo).
  const antesTocar = useRef(tocar)
  useEffect(() => {
    const antes = antesTocar.current; antesTocar.current = tocar
    if (!antes || tocar || ocupadoRef.current) return
    if (paso === 'gracias') { cerrar(); return }
    if (modo === 'zona') { cambiarViaje({ pendiente: rep }); cerrar(); avisar('Te preguntaremos al terminar tu viaje.') }
  }, [tocar]) // eslint-disable-line react-hooks/exhaustive-deps

  const contestar = async (accion, porVoz = false) => {
    if (ocupadoRef.current) return
    ocupadoRef.current = true
    cancelarVoz.current(); setEscuchando(false)
    setEnviando(accion)
    let data, error
    try {
      ({ data, error } = await responder(rep.id, accion))
    } catch {
      error = 'desconocido'
    }
    if (error) { ocupadoRef.current = false; setEnviando(null); cerrar(); avisar(mensajeConfirmar(error)); return }
    const repetido = registrarVoto(rep.id, accion) || data?.repetido === true
    if (permiteSenal(prefs).vibra) { try { navigator.vibrate?.(80) } catch { /* sin vibración */ } }
    if (leerViaje().pendiente?.id === rep.id) cambiarViaje({ pendiente: null })
    const texto = textoGracias(accion, medio)
    const notas = notasGracias({ repetido, estado: data?.estado, antes: rep.estado })
    refrescar()
    if (!puedeTocar(medio, leerViaje())) { // en movimiento: nada táctil, solo aviso de lectura
      cerrar(); avisar(`${porVoz ? 'Escuchamos tu respuesta. ' : ''}¡Enviado! ${texto}`); return
    }
    setFinal({ texto, notas })
    if (porVoz) { setPaso('gracias'); return }
    setEnviando(null); setEnviado(accion)
    setTimeout(() => setPaso('gracias'), 900) // equipo: "¡Enviado!" un momento y luego "¡Gracias!"
  }

  const omitir = () => {
    if (ocupado) return
    if (leerViaje().pendiente?.id === rep.id) cambiarViaje({ pendiente: null })
    cerrar(); avisar('Sin problema. No te preguntaremos de nuevo por este reporte.')
  }

  // "Desviar ruta": abre Google Maps (sin ruteo propio).
  const desviar = (porVoz = false) => {
    const url = urlDesviar(medio)
    const w = window.open(url, '_blank')
    if (w) w.opener = null; else window.location.assign(url)
    cerrar(); avisar(`${porVoz ? 'Escuchamos «desviar ruta». ' : ''}Abrimos Google Maps para cambiar tu ruta.`)
  }
  const seguir = () => { cerrar(); avisar('Seguimos tu ruta. Te avisaremos si algo cambia.') }

  const alOir = (accion) => {
    setEscuchando(false)
    if (modo === 'alerta') {
      if (accion === 'desviar') desviar(true)
      else setVozMsg('Seguimos tu ruta. Di «desviar ruta» para cambiar de camino.')
      return
    }
    if (accion === 'sigue') contestar('sigue', true)
    else if (accion === 'ya_no') contestar('bajo', true)
    else setVozMsg('No te entendimos. Di «sí» o «ya no».')
  }
  const escuchar = () => { setVozMsg(''); setEscuchando(true); cancelarVoz.current = escucharVoz(alOir) }
  const voz = () => {
    if (ocupado) return
    if (escuchando) { cancelarVoz.current(); setEscuchando(false); return }
    // La primera vez se avisa que el navegador puede mandar el audio a su proveedor; solo al aceptar se escucha.
    if (avisoVozAceptado()) escuchar(); else setAvisoVoz(true)
  }
  const aceptarVoz = () => { aceptarAvisoVoz(); setVozAceptada(true); setAvisoVoz(false); if (!ocupado) escuchar() }

  // Vehículo en movimiento: aviso de solo lectura; se lee en voz alta y se escucha la respuesta.
  useEffect(() => {
    if (tocar || paso !== 'pregunta') return undefined
    let vivo = true
    // Sin aviso de voz aceptado no se escucha solo: únicamente se lee en voz alta.
    const auto = escuchaAutomatica(hayVoz)
    const frase = modo === 'alerta'
      ? `Reporte en tu ruta. ${textoLlegas(rep.distancia_m, viaje.vel)}.${auto ? ' Di desviar ruta para cambiar de camino.' : ''}`
      : auto ? '¿Sigue inundado aquí? Di sí, o ya no.' : 'Inundación reportada aquí. Te preguntaremos al detenerte.'
    const luego = () => { if (vivo && auto) escuchar() }
    if (permiteSenal(prefs).sonido) hablar(frase, luego); else luego()
    const t = setTimeout(() => {
      if (ocupadoRef.current) return
      if (modo === 'zona') cambiarViaje({ pendiente: rep })
      cerrar()
    }, CIERRE_PASIVO_MS)
    return () => { vivo = false; clearTimeout(t); cancelarVoz.current(); try { window.speechSynthesis?.cancel() } catch { /* nada */ } }
  }, [tocar]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const esc = (e) => {
      if (e.key !== 'Escape' || ocupadoRef.current) return
      if (paso === 'yaNo') setPaso('pregunta'); else cerrar()
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [paso, cerrar])

  const etiqueta = (accion, texto) => (enviado === accion ? '¡Enviado!' : enviando === accion ? 'Enviando…' : texto)
  const clsBtn = (base, accion) => base + (enviado === accion ? ' enviado' : '')

  // ---- Solo lectura / voz (vehículo en movimiento) ----
  if (!tocar) {
    return (
      <div className="overlay cf-pasivo">
        <div className="confirm cf-card" role="status" aria-live="polite" aria-labelledby="cf-titulo">
          <div className="confirm-bar" aria-hidden="true"><i className="cf-bar-pasiva" /></div>
          {modo === 'alerta' ? (
            <>
              <p className="cf-etq cf-etq-alerta"><Icon name="alerta" size={18} stroke={2.4} />Reporte en tu ruta</p>
              <h2 id="cf-titulo">{textoLlegas(rep.distancia_m, viaje.vel)}</h2>
              <Datos rep={rep} calle={calleTxt} />
            </>
          ) : (
            <>
              <p className="cf-etq">Inundación reportada aquí</p>
              <h2 id="cf-titulo">{calleTxt}</h2>
              <Datos rep={rep} calle={calleTxt} conCalle={false} />
            </>
          )}
          <div className={'cf-voz' + (escuchando ? ' activo' : '')}>
            <Mic />
            <span>{!hayVoz || !vozAceptada ? 'No toques el teléfono mientras manejas.'
              : modo === 'alerta' ? 'Di «desviar ruta» para cambiar de camino. Si no, seguimos tu ruta.'
                : '¿Sigue inundado? Responde por voz: di «sí» o «ya no».'}</span>
          </div>
          {vozMsg && <p className="cf-nota">{vozMsg}</p>}
          {modo === 'zona' && <p className="cf-nota">Si no respondes, te preguntaremos al detenerte o al terminar tu viaje.</p>}
        </div>
      </div>
    )
  }

  // ---- Táctil ----
  const fondo = (e) => {
    if (e.target !== e.currentTarget || ocupado) return
    if (paso === 'yaNo') setPaso('pregunta'); else cerrar()
  }

  let cuerpo
  if (paso === 'gracias') {
    cuerpo = (
      <div className="cf-final">
        <span className="cf-circulo" aria-hidden="true"><Icon name="check" size={40} stroke={3} /></span>
        <h2 id="cf-titulo" tabIndex={-1}>¡Gracias!</h2>
        <p className="cf-impacto">{final?.texto}</p>
        {final?.notas.map((n) => <p key={n} className="cf-nota">{n}</p>)}
        <button ref={primero} className="confirm-si" onClick={cerrar}>Volver al mapa</button>
      </div>
    )
  } else if (modo === 'alerta') {
    cuerpo = (
      <>
        <p className="cf-etq cf-etq-alerta"><Icon name="alerta" size={18} stroke={2.4} />Reporte en tu ruta</p>
        <h2 id="cf-titulo">{textoLlegas(rep.distancia_m, viaje.vel)}</h2>
        <Datos rep={rep} calle={calleTxt} />
        <div className="confirm-acciones">
          <button ref={primero} className="confirm-si" onClick={() => desviar()}>
            <Icon name="mapa" size={26} stroke={2.4} />Desviar ruta ahora
          </button>
          <button className="confirm-no" onClick={seguir}>Seguir mi ruta</button>
        </div>
      </>
    )
  } else if (paso === 'yaNo') {
    cuerpo = (
      <>
        <p className="cf-etq">{calleTxt}</p>
        <h2 id="cf-titulo">¿Qué pasó en esta calle?</h2>
        <div className="confirm-acciones">
          <button ref={primero} className={clsBtn('confirm-no', 'bajo')} disabled={ocupado} onClick={() => contestar('bajo')}>
            {enviado === 'bajo' && <Icon name="check" size={24} />}{etiqueta('bajo', 'Ya se secó / El agua bajó')}
          </button>
          <button className={clsBtn('confirm-no', 'nunca')} disabled={ocupado} onClick={() => contestar('nunca')}>
            {enviado === 'nunca' && <Icon name="check" size={24} />}{etiqueta('nunca', 'Calle seca / Nunca hubo agua')}
          </button>
        </div>
        <div className="confirm-links">
          <button className="confirm-link" disabled={ocupado} onClick={() => setPaso('pregunta')}>Volver</button>
        </div>
      </>
    )
  } else {
    cuerpo = (
      <>
        <p className="cf-etq">{MODO_PRUEBA ? 'Modo prueba · reporte de la ZMG' : 'Estás cerca del reporte'}</p>
        <h2 id="cf-titulo">¿Sigue inundado?</h2>
        <Datos rep={rep} calle={calleTxt} />
        <div className="confirm-acciones">
          <button ref={primero} className={clsBtn('confirm-si', 'sigue')} disabled={ocupado}
            aria-label={enviado === 'sigue' ? '¡Enviado!' : 'Sí, sigue inundado'} onClick={() => contestar('sigue')}>
            <Icon name="check" size={28} stroke={2.6} />{etiqueta('sigue', 'Sí sigue inundado')}
          </button>
          <button className="confirm-no" disabled={ocupado} onClick={() => setPaso('yaNo')}>
            <Icon name="cerrar" size={24} />Ya no está inundado
          </button>
          {hayVoz && !avisoVoz && (
            <button className={'confirm-voz' + (escuchando ? ' activo' : '')} disabled={ocupado}
              aria-pressed={escuchando} onClick={voz}>
              <Mic />{escuchando ? 'Escuchando… di «sí» o «ya no»' : 'Responder con voz'}
            </button>
          )}
          {hayVoz && avisoVoz && (
            <div className="cf-aviso-voz" role="group" aria-labelledby="cf-aviso-voz-txt">
              <p id="cf-aviso-voz-txt">{TEXTO_AVISO_VOZ}</p>
              <button className="confirm-voz" disabled={ocupado} onClick={aceptarVoz}><Mic />Entendido, usar voz</button>
              <button className="confirm-link" onClick={() => setAvisoVoz(false)}>Cancelar</button>
            </div>
          )}
          {hayVoz && vozAceptada && !avisoVoz && <p className="cf-nota-voz">{NOTA_VOZ}</p>}
        </div>
        <p className="confirm-voz-msg" role="status" aria-live="polite">{vozMsg}</p>
        <div className="confirm-links cf-centro">
          <button className="confirm-link" disabled={ocupado} onClick={omitir} aria-label="Omitir esta pregunta">Omitir</button>
        </div>
      </>
    )
  }

  return (
    <div className="overlay" onClick={fondo}>
      <div className="confirm cf-card" role="dialog" aria-modal="true" aria-labelledby="cf-titulo">
        {cuerpo}
      </div>
    </div>
  )
}

// Sin UI. Detecta cercanía (alerta previa ≤ 400 m, llegada ≤ 150 m), movimiento (> 4 m/s) y cambios de
// "Mi reporte". La posición del watchPosition vive solo en memoria mientras la app está visible: no se
// envía al backend ni se guarda (privacidad). Solo se consulta reportes_cercanos con el punto actual.
export function DetectorCercanos() {
  const { ubic, screen, overlay, setOverlay, prefs, misReportes, avisar, refrescar } = useApp()
  const estado = useRef({})
  estado.current = { ubic, screen, overlay, prefs, refrescar }
  const pos = useRef(null)
  const lista = useRef([])
  const consulta = useRef({ t: 0, punto: null })
  const ocupado = useRef(false)

  const punto = () => pos.current || (estado.current.ubic?.real ? estado.current.ubic : null)

  const evaluar = useCallback(() => {
    const e = estado.current; const p = punto()
    if (!puedePreguntar({ ...e, ubic: { real: !!p } })) return
    const { llegada, alerta } = clasificarCercanos(lista.current, p, { preguntados: leerPreguntados(), alertados: leerAlertados() })
    const rep = llegada || alerta
    if (!rep) return
    if (llegada) marcarPreguntado(rep.id); else marcarAlertado(rep.id)
    senal(e.prefs)
    setOverlay({ tipo: 'confirm', reporte: rep, modo: llegada ? 'zona' : 'alerta' })
  }, [setOverlay])

  const consultar = useCallback(async () => {
    const p = punto()
    if (ocupado.current || !p) return
    ocupado.current = true
    try {
      const { data, error } = await reportesCercanos(p.lat, p.lng, RADIO_ALERTA_M)
      consulta.current = { t: Date.now(), punto: { lat: p.lat, lng: p.lng } }
      if (!error && Array.isArray(data)) lista.current = data
    } finally { ocupado.current = false }
    evaluar()
  }, [evaluar])

  useEffect(() => { consultar() }, [ubic.lat, ubic.lng, ubic.real, consultar])
  useEffect(() => {
    const t = setInterval(consultar, CADA_MS)
    return () => clearInterval(t)
  }, [consultar])

  // watchPosition solo con permiso ya dado (ubic.real) y solo mientras la app está visible.
  useEffect(() => {
    if (!ubic.real || typeof navigator === 'undefined' || !navigator.geolocation) return undefined
    let id = null; let prev = null
    const iniciar = () => {
      if (id !== null || document.hidden) return
      id = navigator.geolocation.watchPosition((p) => {
        const vel = velocidadDe(p, prev)
        prev = { lat: p.coords.latitude, lng: p.coords.longitude, t: p.timestamp, precision: p.coords.accuracy } // solo el último punto
        pos.current = prev
        const v = leerViaje()
        const moviendo = enMovimiento(vel, v.moviendo)
        if (moviendo !== v.moviendo || vel !== v.vel) cambiarViaje({ moviendo, vel })
        const c = consulta.current
        if (Date.now() - c.t > 20_000 || distanciaM(c.punto, prev) > 150) consultar(); else evaluar()
      }, () => { /* sin GPS: seguimos con la ubicación del mapa */ }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20_000 })
    }
    const parar = () => {
      if (id !== null) navigator.geolocation.clearWatch(id)
      id = null; prev = null; pos.current = null
      cambiarViaje({ moviendo: false, vel: null })
    }
    const vis = () => (document.hidden ? parar() : iniciar())
    iniciar()
    document.addEventListener('visibilitychange', vis)
    return () => { document.removeEventListener('visibilitychange', vis); parar() }
  }, [ubic.real, consultar, evaluar])

  // Se detuvo (semáforo / fin de viaje): aparece la pregunta pendiente con botones.
  useEffect(() => {
    let antes = leerViaje().moviendo
    return suscribirViaje(() => {
      const v = leerViaje(); const paro = antes && !v.moviendo; antes = v.moviendo
      const e = estado.current
      if (!paro || !v.pendiente || e.overlay || e.screen || document.hidden) return
      setOverlay({ tipo: 'confirm', reporte: v.pendiente, modo: 'zona' })
      cambiarViaje({ pendiente: null })
    })
  }, [setOverlay])

  // "Mi reporte" (equipo): avisar a quien reportó SOLO cuando cambia el estado visible.
  const hayMios = (misReportes?.length || 0) > 0
  useEffect(() => {
    if (!hayMios) return undefined
    let vivo = true
    const revisarMio = async () => {
      const { data, error } = await cargarMisReportes()
      if (!vivo || error || !Array.isArray(data)) return
      const { estados, avisos } = cambiosMios(data, leerMios())
      guardarMios(estados)
      if (!avisos.length) return
      const textos = await Promise.all(avisos.map(async (a) => {
        if (!Number.isFinite(a.rep.lat)) return a.txt
        const { data: calle } = await direccionDe(a.rep.lat, a.rep.lng)
        return calle ? `${a.txt} · ${calle}` : a.txt
      }))
      if (!vivo) return
      avisar(textos.join(' · '))
      estado.current.refrescar()
    }
    revisarMio()
    const t = setInterval(revisarMio, CADA_MIO_MS)
    return () => { vivo = false; clearInterval(t) }
  }, [hayMios, avisar])

  return null
}

// Solo demo (?demo=1): abre el aviso con el reporte ajeno más cercano aunque la ubicación no sea real.
// Ignora la lista de "ya preguntados" para poder repetir la demo.
export function BotonProbarConfirmar() {
  const { ubic, setOverlay, avisar } = useApp()
  const [buscando, setBuscando] = useState(false)
  const probar = async () => {
    setBuscando(true)
    let data, error
    try {
      ({ data, error } = await reportesCercanos(ubic.lat, ubic.lng, 1000)) // demo: tope del backend (radio_cercanos_max_m)
    } catch {
      error = 'desconocido'
    } finally {
      setBuscando(false)
    }
    if (error) { avisar(mensajeConfirmar(error)); return }
    const rep = elegirCercano(data)
    if (!rep) { avisar('No hay reportes de otros vecinos a 1 km'); return }
    setOverlay({ tipo: 'confirm', reporte: rep, modo: 'zona' })
  }
  return (
    <button className="confirm-probar" onClick={probar} disabled={buscando}>
      {buscando ? 'Buscando reportes…' : 'Probar aviso de confirmación'}
    </button>
  )
}
