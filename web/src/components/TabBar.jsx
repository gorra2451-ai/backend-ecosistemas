// Barra inferior móvil (D-030, referencias de Diego): píldora oscura, botón "+" para reportar al centro y una
// gota que se desliza con efecto líquido hasta la pestaña activa. Mapa · Reportes · [+] · Ayuda · Más.
import Icon from './Icon.jsx'
import { useApp } from '../lib/store.jsx'

const TABS = [
  { id: null, texto: 'Mapa', icono: 'mapa' },
  { id: 'misreportes', texto: 'Reportes', icono: 'lista' },
  { id: 'tipo', texto: 'Reportar', icono: 'mas', centro: true },
  { id: 'acudo', texto: 'Ayuda', icono: 'telefono' },
  { id: 'mas', texto: 'Más', icono: 'ajustes' },
]
const LATERALES = TABS.filter((t) => !t.centro)

export default function TabBar() {
  const { screen, ir, setSheet } = useApp()
  const activo = (t) => (t.id === null ? !screen || screen === 'zona' : screen === t.id || (t.id === 'acudo' && screen === 'acudoresp'))
  const i = LATERALES.findIndex(activo)
  return (
    <nav className="tabbar only-mobile" aria-label="Navegación principal">
      <div className="tabbar-pill">
        {/* gota líquida: se mueve a la pestaña activa; key reinicia la animación de estirarse */}
        {i >= 0 && <span key={i} className="tab-gota" style={{ '--i': i + (i >= 2 ? 1 : 0) }} aria-hidden="true" />}
        {TABS.map((t) => t.centro ? (
          <button key={t.texto} className="tab tab--centro" aria-label="Reportar inundación" onClick={() => ir('tipo')}>
            <span className="tab-mas"><Icon name="mas" size={30} stroke={2.6} /></span>
          </button>
        ) : (
          <button key={t.texto} className={'tab' + (activo(t) ? ' on' : '')} aria-current={activo(t) ? 'page' : undefined}
            onClick={() => { ir(t.id); if (t.id === null) setSheet('min') }}>
            <Icon name={t.icono} size={24} /><span>{t.texto}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
