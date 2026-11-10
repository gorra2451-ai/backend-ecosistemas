// Modo voz (prefs.voz): lee en voz alta las zonas que aparecen o suben de nivel cerca de ti. No renderiza nada.
// Recarga zonas_publicas con un sondeo de 60 s y con cada refrescar() del store (`version`).
// No abre su propio canal Realtime: escucharCambios usa los topics 'reportes'/'zonas' y realtime-js 2.10
// desuscribe el canal previo con el mismo topic (_leaveOpenTopic), lo que apagaría el Realtime de MapView.
import { useEffect, useRef } from 'react'
import { useApp } from '../lib/store.jsx'
import { zonasPublicas } from '../lib/api.js'
import { hablar } from '../lib/confirmar.js'
import { cambiosParaVoz } from '../lib/vozAlertas.js'

const SONDEO_MS = 60_000

export default function LectorVoz() {
  const { prefs, ubic, version } = useApp()
  const activo = !!prefs.voz
  const anteriores = useRef(null)
  const ubicRef = useRef(ubic)
  ubicRef.current = ubic

  useEffect(() => {
    if (!activo) { anteriores.current = null; return }
    let vivo = true
    const revisar = async () => {
      const { data, error } = await zonasPublicas().catch((e) => ({ error: e }))
      if (!vivo || error || !data) return
      const frases = cambiosParaVoz(anteriores.current, data, ubicRef.current)
      anteriores.current = data
      if (frases.length) hablar(frases.join(' '))
    }
    revisar()
    const t = setInterval(revisar, SONDEO_MS)
    return () => { vivo = false; clearInterval(t) }
  }, [activo, version])

  return null
}
