// Agrupa ráfagas de eventos: el primero corre al instante; los que lleguen dentro de la ventana se
// juntan en UNA llamada al cerrarla. Los canales Realtime del mapa son públicos: cualquiera con la
// llave publicable puede mandar N eventos "cambio" y, sin esto, cada mapa abierto haría 3N consultas.
export function agruparRafaga(fn, ms) {
  let timer = null
  let pendiente = false
  const abrirVentana = () => {
    timer = setTimeout(() => {
      timer = null
      if (pendiente) { pendiente = false; fn(); abrirVentana() }
    }, ms)
  }
  const g = () => {
    if (timer) { pendiente = true; return }
    fn()
    abrirVentana()
  }
  g.cancelar = () => { clearTimeout(timer); timer = null; pendiente = false }
  return g
}
