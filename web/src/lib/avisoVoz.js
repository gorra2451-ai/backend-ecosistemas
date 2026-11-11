// Aviso de privacidad antes del reconocimiento de voz: el navegador puede mandar el audio a su
// proveedor (Web Speech; en Chrome, a Google). Se avisa ANTES de escuchar y se recuerda la aceptación.
// Lib pura: el almacenamiento llega como parámetro (por defecto localStorage).
export const TEXTO_AVISO_VOZ = 'Tu navegador puede enviar tu voz a su servicio de reconocimiento (en Chrome, Google) para convertirla en texto. ¡Aguas! no guarda audio.'
export const NOTA_VOZ = 'Tu voz la procesa tu navegador.'
const CLAVE = 'aguas.avisoVoz'

const almacen = (store) => (store === undefined ? globalThis.localStorage : store)

// Si el almacenamiento falla o no existe, se toma como no aceptado.
export function avisoVozAceptado(store) {
  try { return almacen(store).getItem(CLAVE) === '1' } catch { return false }
}

// Devuelve true si quedó guardado.
export function aceptarAvisoVoz(store) {
  try { almacen(store).setItem(CLAVE, '1'); return true } catch { return false }
}

// Modo vehículo: la escucha que arranca sola solo ocurre si el aviso ya se aceptó.
export function escuchaAutomatica(hayVoz, store) {
  return !!hayVoz && avisoVozAceptado(store)
}
