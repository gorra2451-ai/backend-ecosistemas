// Barra inferior móvil validada por el Equipo Reporte: Mapa · Reportes · Ayuda (HTML validado, reemplaza la imagen).
import Icon from './Icon.jsx'
import { useApp } from '../lib/store.jsx'

const TABS = [
  { id: null, texto: 'Mapa', icono: 'mapa' },
  { id: 'misreportes', texto: 'Reportes', icono: 'lista' },
  { id: 'acudo', texto: 'Ayuda', icono: 'telefono' },
]

export default function TabBar() {
  const { screen, ir, setSheet } = useApp()
  const activo = (t) => (t.id === null ? !screen || screen === 'zona' : screen === t.id)
  return (
    <nav className="tabbar only-mobile" aria-label="Navegación principal">
      {TABS.map((t) => (
        <button key={t.texto} className={'tab' + (activo(t) ? ' on' : '')} aria-current={activo(t) ? 'page' : undefined}
          onClick={() => { ir(t.id); if (t.id === null) setSheet('min') }}>
          <Icon name={t.icono} size={24} /><span>{t.texto}</span>
        </button>
      ))}
    </nav>
  )
}
