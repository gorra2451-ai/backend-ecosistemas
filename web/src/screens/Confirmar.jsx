// MÓDULO D · Confirmación (Equipo Confirmación). Aviso "¿Sigue inundado?" (overlay) y su detector.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { reportesCercanos } from '../lib/api.js'
import Icon from '../components/Icon.jsx'
import {
  RADIO_CERCANOS_M, CADA_MS, CIERRE_MS, elegirCercano, puedePreguntar, lugarDe, cuandoDe,
  mensajeConfirmar, responder, leerPreguntados, marcarPreguntado, textoGracias, claseVoz, escucharVoz,
} from '../lib/confirmar.js'
import '../styles/confirmar.css'

// Overlay: se muestra cuando overlay?.tipo === 'confirm'. overlay.reporte = fila de reportes_cercanos.
export function AvisoConfirmar() {
  const { overlay, setOverlay } = useApp()
  const cerrar = useCallback(() => setOverlay(null), [setOverlay])
  const rep = overlay?.tipo === 'confirm' ? overlay.reporte : null
  if (!rep) return null
  return <Aviso key={rep.id} rep={rep} cerrar={cerrar} />
}

// Micrófono (ícono propio del módulo; Icon.jsx no tiene uno).
const Mic = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
  </svg>
)

const ETIQUETA = { sigue: 'Sí, sigue', ya_no: 'Ya no' }

function Aviso({ rep, cerrar }) {
  const { avisar, refrescar, medio } = useApp()
  const [enviando, setEnviando] = useState(null) // acción en curso
  const [enviado, setEnviado] = useState(null)   // acción ya aceptada ("¡Enviado!")
  const [escuchando, setEscuchando] = useState(false)
  const [vozMsg, setVozMsg] = useState('')
  const [vuelta, setVuelta] = useState(0)         // reinicia los 10 s tras usar la voz
  const primero = useRef(null)
  const cancelarVoz = useRef(() => {})
  const hayVoz = !!claseVoz()
  const ocupado = !!enviando || !!enviado

  // Cierre solo a los 10 s (se pausa mientras se envía o se escucha).
  useEffect(() => {
    if (ocupado || escuchando) return undefined
    const t = setTimeout(cerrar, CIERRE_MS)
    return () => clearTimeout(t)
  }, [ocupado, escuchando, cerrar, vuelta])

  useEffect(() => {
    primero.current?.focus()
    const esc = (e) => { if (e.key === 'Escape') cerrar() }
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('keydown', esc); cancelarVoz.current() }
  }, [cerrar])

  const contestar = async (accion, porVoz = false) => {
    if (ocupado) return
    cancelarVoz.current(); setEscuchando(false)
    setEnviando(accion)
    const { data, error } = await responder(rep.id, accion)
    if (error) { cerrar(); avisar(mensajeConfirmar(error)); return }
    try { navigator.vibrate?.(80) } catch { /* sin vibración */ }
    setEnviando(null); setEnviado(accion)
    const gracias = textoGracias(accion, data?.estado)
    // Equipo: el botón muestra "¡Enviado!" un momento y luego se cierra con el gracias.
    setTimeout(() => {
      cerrar()
      avisar(porVoz ? `Escuchamos «${ETIQUETA[accion]}». ${gracias}` : gracias)
      refrescar()
    }, 900)
  }

  const omitir = () => {
    if (ocupado) return
    cerrar()
    avisar('Sin problema. No te preguntaremos de nuevo por este reporte.')
  }

  const voz = () => {
    if (ocupado) return
    if (escuchando) { cancelarVoz.current(); setEscuchando(false); setVuelta((v) => v + 1); return }
    setVozMsg(''); setEscuchando(true)
    cancelarVoz.current = escucharVoz((accion) => {
      setEscuchando(false)
      if (accion) { contestar(accion, true); return }
      setVozMsg('No te entendimos. Di «sí» o «ya no», o toca un botón.')
      setVuelta((v) => v + 1)
    })
  }

  const etiqueta = (accion, texto) => (enviado === accion ? '¡Enviado!' : enviando === accion ? 'Enviando…' : texto)
  const manejando = medio === 'auto'

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget && !ocupado) cerrar() }}>
      <div className="confirm" role="dialog" aria-modal="true"
        aria-labelledby="confirm-titulo" aria-describedby="confirm-lugar">
        <div className="confirm-bar" aria-hidden="true">
          <i key={vuelta} className={ocupado || escuchando ? 'pausa' : ''} />
        </div>
        <p className="confirm-lugar" id="confirm-lugar">
          Estás junto a: <b>{lugarDe(rep)}</b> · {cuandoDe(rep)}
        </p>
        <h2 id="confirm-titulo">¿Sigue inundado aquí?</h2>
        <p className="confirm-nota">
          {manejando && hayVoz ? 'Si vas manejando, responde con voz. ' : ''}
          Un toque y se cierra. Se cierra solo en 10 s.
        </p>
        <div className="confirm-acciones">
          <button ref={primero} className={'confirm-si' + (enviado === 'sigue' ? ' enviado' : '')} disabled={ocupado}
            aria-label={enviado === 'sigue' ? '¡Enviado!' : 'Sí, sigue inundado'} onClick={() => contestar('sigue')}>
            <Icon name="check" size={28} stroke={2.6} />{etiqueta('sigue', 'Sí, sigue')}
          </button>
          <button className={'confirm-no' + (enviado === 'ya_no' ? ' enviado' : '')} disabled={ocupado}
            aria-label={enviado === 'ya_no' ? '¡Enviado!' : 'Ya no está inundado'} onClick={() => contestar('ya_no')}>
            {enviado === 'ya_no' ? <Icon name="check" size={24} /> : <Icon name="cerrar" size={24} />}
            {etiqueta('ya_no', 'Ya no')}
          </button>
          {hayVoz && (
            <button className={'confirm-voz' + (escuchando ? ' activo' : '')} disabled={ocupado}
              aria-pressed={escuchando} onClick={voz}>
              <Mic />{escuchando ? 'Escuchando… di «sí» o «ya no»' : 'Responder con voz'}
            </button>
          )}
        </div>
        <p className="confirm-voz-msg" role="status" aria-live="polite">{vozMsg}</p>
        <div className="confirm-links">
          <button className="confirm-link" disabled={ocupado} onClick={omitir}>Omitir</button>
          <button className="confirm-link" disabled={ocupado} onClick={() => contestar('falso')}>
            {etiqueta('falso', 'Es falso')}
          </button>
        </div>
      </div>
    </div>
  )
}

// Sin UI. Cada 60 s (y al moverse) busca reportes ajenos a ≤300 m y pregunta por el más cercano.
export function DetectorCercanos() {
  const { ubic, screen, overlay, setOverlay } = useApp()
  const estado = useRef({ ubic, screen, overlay })
  estado.current = { ubic, screen, overlay }
  const ocupado = useRef(false)

  const revisar = useCallback(async () => {
    if (ocupado.current || !puedePreguntar(estado.current)) return
    ocupado.current = true
    try {
      const { lat, lng } = estado.current.ubic
      const { data, error } = await reportesCercanos(lat, lng, RADIO_CERCANOS_M)
      if (error || !puedePreguntar(estado.current)) return
      const rep = elegirCercano(data, leerPreguntados())
      if (!rep) return
      marcarPreguntado(rep.id)
      setOverlay({ tipo: 'confirm', reporte: rep })
    } finally {
      ocupado.current = false
    }
  }, [setOverlay])

  useEffect(() => { revisar() }, [ubic.lat, ubic.lng, ubic.real, revisar])
  useEffect(() => {
    const t = setInterval(revisar, CADA_MS)
    return () => clearInterval(t)
  }, [revisar])

  return null
}

// Solo demo: abre el aviso con el reporte ajeno más cercano aunque la ubicación no sea real.
// Ignora la lista de "ya preguntados" para poder repetir la demo.
export function BotonProbarConfirmar() {
  const { ubic, setOverlay, avisar } = useApp()
  const [buscando, setBuscando] = useState(false)
  const probar = async () => {
    setBuscando(true)
    const { data, error } = await reportesCercanos(ubic.lat, ubic.lng, 1000) // demo: tope del backend (radio_cercanos_max_m)
    setBuscando(false)
    if (error) { avisar(mensajeConfirmar(error)); return }
    const rep = elegirCercano(data)
    if (!rep) { avisar('No hay reportes de otros vecinos a 1 km'); return }
    setOverlay({ tipo: 'confirm', reporte: rep })
  }
  return (
    <button className="confirm-probar" onClick={probar} disabled={buscando}>
      {buscando ? 'Buscando reportes…' : 'Probar aviso de confirmación'}
    </button>
  )
}
