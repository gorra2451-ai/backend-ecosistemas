import { describe, it, expect } from 'vitest'
import { crearHistorial } from './historial.js'

// Historial falso del navegador: pushState/replaceState/go con popstate asíncrono, como en Safari/Chrome.
function falso() {
  const pila = [null]; let i = 0; const escuchas = []
  return {
    h: {
      get state() { return pila[i] },
      pushState(s) { pila.length = i + 1; pila.push(s); i++ },
      replaceState(s) { pila[i] = s },
      go(n) { i = Math.max(0, Math.min(pila.length - 1, i + n)); queueMicrotask(() => escuchas.forEach((f) => f({ state: pila[i] }))) },
    },
    atras() { this.h.go(-1) },
    escuchar: (f) => escuchas.push(f),
    get i() { return i },
  }
}
const espera = () => new Promise((r) => setTimeout(r, 0))

function montar(raiz = null) {
  const nav = falso()
  const vistos = []
  const hist = crearHistorial(nav.h, (s, p) => vistos.push([s, p]), () => raiz)
  nav.escuchar(hist.alVolver)
  return { nav, hist, vistos, ultima: () => vistos[vistos.length - 1] }
}

describe('historial (deslizar para regresar se queda dentro de la app)', () => {
  it('atrás desde una pantalla abierta desde el mapa regresa al mapa, no sale de la app', async () => {
    const { nav, hist, ultima } = montar()
    hist.ir('ajustes')
    expect(ultima()).toEqual(['ajustes', {}])
    nav.atras(); await espera()
    expect(ultima()).toEqual([null, {}])
    expect(nav.i).toBe(0)
  })

  it('pantallas anidadas regresan una por una con sus parámetros', async () => {
    const { nav, hist, ultima } = montar()
    hist.ir('acudo'); hist.ir('acudoresp', { caso: 'casa' })
    hist.ir('refugios', { desde: 'acudoresp' })
    nav.atras(); await espera()
    expect(ultima()).toEqual(['acudoresp', { caso: 'casa' }])
    nav.atras(); await espera()
    expect(ultima()).toEqual(['acudo', {}])
  })

  it('volver al mapa con un botón deja el historial en la raíz (atrás ya no reabre la pantalla)', async () => {
    const { nav, hist, ultima } = montar()
    hist.ir('acudo'); hist.ir('acudoresp')
    hist.ir(null)
    expect(ultima()).toEqual([null, {}])
    await espera()
    expect(nav.i).toBe(0)
  })

  it('lo que se abra mientras el navegador regresa a la raíz se aplica después', async () => {
    const { nav, hist, ultima } = montar()
    hist.ir('tipo'); hist.ir(null); hist.ir('zona', { id: 1 })
    await espera()
    expect(ultima()).toEqual(['zona', { id: 1 }])
    expect(nav.i).toBe(1)
    nav.atras(); await espera()
    expect(ultima()).toEqual([null, {}])
  })

  it('en la raíz se muestra lo que diga raiz() (onboarding si aún no entra)', async () => {
    const { nav, hist, ultima } = montar('acceso')
    hist.ir('privacidad')
    nav.atras(); await espera()
    expect(ultima()).toEqual(['acceso', {}])
  })
})

describe('historial · flujo cerrado', () => {
  it('después de "Reporte enviado", atrás va al mapa y nunca al formulario', async () => {
    const { nav, hist, ultima } = montar()
    hist.ir('tipo'); hist.ir('paso2', { tipo: 'inundacion' }); hist.ir('paso2', { fase: 'evidencia' })
    hist.ir('paso2', { fase: 'enviado', id: 'r1' }, { cerrarFlujo: true })
    expect(ultima()).toEqual(['paso2', { fase: 'enviado', id: 'r1' }])
    nav.atras(); await espera()
    expect(ultima()).toEqual([null, {}])
    nav.atras(); await espera()
    expect(ultima()[0]).toBe(null)
  })
})
