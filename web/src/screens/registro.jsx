// Registro de pantallas: id → componente. Cada módulo es dueño de SUS ids; no edites los de otro.
import * as A from './Onboarding.jsx'
import * as B from './Reportar.jsx'
import * as C from './Mapa.jsx'
import * as E from './Ayuda.jsx'
import Pendiente from './Pendiente.jsx'

// Pantallas v2 (material validado de los equipos): si el módulo aún no exporta el componente, se ve "en construcción".
const o = (C, id) => C || (() => <Pendiente id={id} />)

export const PANTALLAS = {
  // A · Primera vez
  acceso: A.Acceso, privacidad: A.Privacidad, ubicacion: A.Ubicacion, avisos: A.AvisosPermiso, onb: A.Medio,
  // B · Reportar
  tipo: B.Tipo, paso2: B.Paso2, riesgo: B.Riesgo, mireporte: B.MiReporte, error: B.ErrorPantalla,
  inicio: o(B.Inicio, 'inicio'), misreportes: o(B.MisReportes, 'misreportes'),
  // C · Mapa
  zona: C.Zona, buscar: o(C.Buscar, 'buscar'), mas: o(C.Mas, 'mas'),
  // E · Ayuda
  acudo: E.Acudo, acudoresp: E.AcudoRespuesta, refugios: E.Refugios, alertas: E.Alertas, ajustes: E.Ajustes,
  alertadetalle: o(E.AlertaDetalle, 'alertadetalle'), preferencias: o(E.Preferencias, 'preferencias'),
}
