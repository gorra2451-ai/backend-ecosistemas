// MÓDULO C · Mapa (Equipo Mapa). Barra superior, hoja inferior (min/mid/full), sidebar de escritorio,
// detalle de zona, encabezado de escritorio.
import Pendiente from './Pendiente.jsx'
import { useApp } from '../lib/store.jsx'
import { Logo } from '../components/Icon.jsx'
export const TopBar = () => null
export function Hoja() {
  const { ir } = useApp()
  return <div className="sheet" style={{ position: 'static' }}><button className="btn-report" onClick={() => ir('tipo')}>Reportar</button></div>
}
export const Sidebar = () => null
export const DeskHeader = () => <><Logo /><b>¡Aguas!</b></>
export const Zona = () => <Pendiente id="zona" />
