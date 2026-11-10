import { useApp } from './lib/store.jsx'
import MapView from './components/MapView.jsx'
import { Toast } from './components/ui.jsx'
import { PANTALLAS } from './screens/registro.js'
import { TopBar, Hoja, Sidebar, DeskHeader } from './screens/Mapa.jsx'
import { HojaEnviado, ColaReportes } from './screens/Reportar.jsx'
import { AvisoConfirmar, DetectorCercanos, BotonProbarConfirmar } from './screens/Confirmar.jsx'

// ?demo=1 muestra el botón para probar el aviso de confirmación sin estar físicamente cerca.
const DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo')

export default function App() {
  const { screen, sheet } = useApp()
  const P = screen ? PANTALLAS[screen] : null
  return (
    <div className="app">
      <header className="desk-header"><DeskHeader /></header>
      <div className="app-main">
        <aside className="desk-sidebar" aria-label="Lo cercano"><Sidebar /></aside>
        <main className="map-area">
          <MapView />
          <div className="map-top"><TopBar /></div>
          <div className="map-sheet">{sheet === 'sent' ? <HojaEnviado /> : <Hoja />}</div>
          {P && <P />}
          <AvisoConfirmar />
          <Toast />
        </main>
      </div>
      <DetectorCercanos />
      <ColaReportes />
      {DEMO && <div style={{ position: 'fixed', right: 12, top: 150, zIndex: 950 }}><BotonProbarConfirmar /></div>}
    </div>
  )
}
