// Navegación con el historial del navegador: el gesto de deslizar para regresar (iPhone) y el botón/gesto
// "atrás" de Android regresan a la pantalla anterior DENTRO de la app en vez de salir de ella.
// El mapa es la raíz (profundidad 0). Cada pantalla abierta suma una entrada; ir(null) regresa a la raíz.
// Los parámetros (zona, reporte…) se guardan en memoria (por llave), no en history.state.
export function crearHistorial(h, aplicar, raiz = () => null) {
  const vistas = new Map() // llave → [screen, params]
  let llave = 0
  let prof = 0 // posición en el historial del navegador respecto de la raíz
  let regresando = false // history.go() es asíncrono: lo que llegue mientras tanto se encola
  const cola = []
  const intentar = (f) => { try { f() } catch { /* sin historial */ } }

  intentar(() => h.replaceState({ aguasD: 0 }, ''))

  // opc.cerrarFlujo: la pantalla reemplaza a la actual y lo abierto antes deja de existir (p. ej. "Reporte
  // enviado"): atrás va al mapa y nunca al formulario recién enviado (evita mandarlo dos veces).
  function ir(s, p = {}, opc = {}) {
    if (regresando) { cola.push([s, p, opc]); return }
    aplicar(s, p)
    if (s === null) {
      if (prof > 0) { regresando = true; const n = prof; prof = 0; try { h.go(-n) } catch { regresando = false } }
      return
    }
    llave += 1
    if (opc.cerrarFlujo && prof > 0) {
      vistas.clear()
      vistas.set(llave, [s, p])
      intentar(() => h.replaceState({ aguasD: prof, aguasK: llave }, ''))
      return
    }
    prof += 1
    vistas.set(llave, [s, p])
    intentar(() => h.pushState({ aguasD: prof, aguasK: llave }, ''))
  }

  function alVolver(e) {
    const d = Number(e?.state?.aguasD) || 0
    const v = vistas.get(e?.state?.aguasK)
    if (regresando) {
      regresando = false
      const pendientes = cola.splice(0)
      if (!pendientes.length) aplicar(raiz(), {})
      pendientes.forEach(([s, p, o]) => ir(s, p, o))
      return
    }
    prof = d
    if (d > 0 && v) aplicar(v[0], v[1]); else aplicar(raiz(), {})
  }

  return { ir, alVolver }
}
