// MÓDULO D · Confirmación (Equipo Confirmación). Aviso "¿Sigue inundado?" (overlay) y su detector.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { reportesCercanos } from '../lib/api.js'
import Icon from '../components/Icon.jsx'
import {
  RADIO_CERCANOS_M, CADA_MS, CIERRE_MS, elegirCercano, puedePreguntar, lugarDe, cuandoDe,
  mensajeConfirmar, responder, leerPreguntados, marcarPreguntado,
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

function Aviso({ rep, cerrar }) {
  const { avisar, refrescar } = useApp()
  const [enviando, setEnviando] = useState(false)
  const primero = useRef(null)

  // Cierre solo a los 10 s (se pausa mientras se envía la respuesta).
  useEffect(() => {
    if (enviando) return undefined
    const t = setTimeout(cerrar, CIERRE_MS)
    return () => clearTimeout(t)
  }, [enviando, cerrar])

  useEffect(() => {
    primero.current?.focus()
    const esc = (e) => { if (e.key === 'Escape') cerrar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [cerrar])

  const contestar = async (accion) => {
    if (enviando) return
    setEnviando(true)
    const { error } = await responder(rep.id, accion)
    cerrar()
    if (error) { avisar(mensajeConfirmar(error)); return }
    try { navigator.vibrate?.(30) } catch { /* sin vibración */ }
    avisar('Gracias, ya quedó')
    refrescar()
  }

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget && !enviando) cerrar() }}>
      <div className="confirm" role="dialog" aria-modal="true"
        aria-labelledby="confirm-titulo" aria-describedby="confirm-lugar">
        <div className="confirm-bar" aria-hidden="true"><i /></div>
        <p className="confirm-lugar" id="confirm-lugar">
          Estás junto a: <b>{lugarDe(rep)}</b> · {cuandoDe(rep)}
        </p>
        <h2 id="confirm-titulo">¿Sigue inundado aquí?</h2>
        <p className="confirm-nota">Un toque y se cierra. Se cierra solo en 10 s.</p>
        <div className="confirm-acciones">
          <button ref={primero} className="confirm-si" disabled={enviando} onClick={() => contestar('sigue')}>
            <Icon name="check" size={28} stroke={2.6} />Sí, sigue
          </button>
          <button className="confirm-no" disabled={enviando} onClick={() => contestar('ya_no')}>
            <Icon name="cerrar" size={24} />Ya no
          </button>
        </div>
        <button className="confirm-falso" disabled={enviando} onClick={() => contestar('falso')}>
          Es falso
        </button>
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
