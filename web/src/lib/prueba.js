// Modo prueba del mid-fi (?prueba=1): los testers están repartidos por la ZMG y casi nunca a 300 m
// de un reporte ajeno, así que "Cerca de ti" lista los de toda la ZMG para poder confirmarlos.
// Solo relaja el FRONT; el backend sigue topando el radio con parametros.radio_cercanos_max_m.
// Se recuerda en localStorage para que sobreviva recargas; ?prueba=0 lo apaga.
export const RADIO_NORMAL_M = 300
export const RADIO_PRUEBA_M = 40000 // cubre la ZMG desde cualquier punto de ella
const CLAVE = 'aguas.prueba'

const almacen = () => { try { return localStorage } catch { return undefined } }

export function esModoPrueba(search = typeof location !== 'undefined' ? location.search : '', store = almacen()) {
  const v = new URLSearchParams(search).get('prueba')
  if (v === '1' || v === '0') { try { store?.setItem(CLAVE, v) } catch { /* sin almacenamiento */ } return v === '1' }
  try { return store?.getItem(CLAVE) === '1' } catch { return false }
}

export const radioCercanos = (prueba) => (prueba ? RADIO_PRUEBA_M : RADIO_NORMAL_M)
export const MODO_PRUEBA = esModoPrueba()
