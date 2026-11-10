import { Screen } from '../components/ui.jsx'
// Marcador temporal mientras el módulo construye su pantalla real.
export default function Pendiente({ id }) {
  return <Screen titulo={id}><p className="muted">Pantalla en construcción.</p></Screen>
}
