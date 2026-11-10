import { describe, it, expect } from 'vitest'
import { conTiempo, entrarConMedio, avisoEntrada, pedirPermisoAvisos, MUNICIPIOS_ZMG, MEDIOS } from './onboarding.js'

const ok = () => Promise.resolve({ data: null, error: null })

describe('entrarConMedio', () => {
  it('abre sesión y registra la entrada con el medio', async () => {
    const llamadas = []
    const r = await entrarConMedio({ asegurarSesion: ok, registrarEntrada: (m) => { llamadas.push(m); return ok() } }, 'bici')
    expect(r.error).toBe(null)
    expect(llamadas).toEqual(['bici'])
  })
  it('si la sesión falla no registra y regresa el error', async () => {
    let registro = false
    const r = await entrarConMedio({
      asegurarSesion: () => Promise.resolve({ data: null, error: 'sin_red' }),
      registrarEntrada: () => { registro = true; return ok() },
    }, 'peaton')
    expect(r.error).toBe('sin_red')
    expect(registro).toBe(false)
  })
  it('nunca lanza aunque la llamada truene', async () => {
    const r = await entrarConMedio({ asegurarSesion: () => { throw new Error('x') }, registrarEntrada: ok }, 'auto')
    expect(r.error).toBe('desconocido')
  })
  it('no se traba si el backend no responde', async () => {
    const r = await entrarConMedio({ asegurarSesion: () => new Promise(() => {}), registrarEntrada: ok }, 'auto', 20)
    expect(r.error).toBe('sin_red')
  })
})

describe('conTiempo', () => {
  it('regresa el valor si llega a tiempo', async () => {
    expect(await conTiempo(Promise.resolve({ data: 1, error: null }), 50)).toEqual({ data: 1, error: null })
  })
})

describe('avisoEntrada', () => {
  it('sin error no avisa; con error da texto corto', () => {
    expect(avisoEntrada(null)).toBe(null)
    expect(avisoEntrada('sin_red')).toMatch(/Sin conexión/)
    expect(avisoEntrada('otro')).toBeTruthy()
  })
})

describe('pedirPermisoAvisos', () => {
  it('maneja navegador sin Notification', async () => {
    expect(await pedirPermisoAvisos(null)).toBe('no_soportado')
  })
  it('mapea granted/denied', async () => {
    expect(await pedirPermisoAvisos({ requestPermission: async () => 'granted' })).toBe('concedido')
    expect(await pedirPermisoAvisos({ requestPermission: async () => 'denied' })).toBe('negado')
  })
})

describe('catálogos', () => {
  it('6 municipios y 4 medios del contrato', () => {
    expect(MUNICIPIOS_ZMG).toHaveLength(6)
    expect(MEDIOS.map((m) => m.id)).toEqual(['peaton', 'bici', 'auto', 'transporte_publico'])
  })
})
