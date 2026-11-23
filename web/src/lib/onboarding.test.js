import { describe, it, expect } from 'vitest'
import {
  conTiempo, entrarConMedio, avisoEntrada, pedirPermisoAvisos, MUNICIPIOS_ZMG, MEDIOS,
  idCorto, a11yActivo, alternarA11y, resumenA11y, tituloMedio,
  normalizarPermiso, textoPermiso, leerPermisoUbicacion, leerPermisoAvisos, COMO_CAMBIAR, volverAtras,
} from './onboarding.js'

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
  it('6 municipios y los 5 medios del contrato v2 en el orden del equipo', () => {
    expect(MUNICIPIOS_ZMG).toHaveLength(6)
    expect(MEDIOS.map((m) => m.id)).toEqual(['peaton', 'moto', 'bici', 'auto', 'transporte_publico'])
    expect(MEDIOS.every((m) => m.tip)).toBe(true)
    expect(tituloMedio('moto')).toBe('Motocicleta')
    expect(tituloMedio(null)).toBe('sin elegir')
  })
})

describe('idCorto', () => {
  it('# + 6 primeros caracteres en mayúsculas', () => {
    expect(idCorto({ user: { id: 'a7f3b2c4-0000-4000-8000-000000000000' } })).toBe('#A7F3B2')
  })
  it('sin sesión no inventa', () => {
    expect(idCorto(null)).toBe(null)
    expect(idCorto({ user: {} })).toBe(null)
  })
})

describe('ajustes de accesibilidad (mismos valores que Módulo E)', () => {
  it('grande y dalton van en a11y; voz es booleano', () => {
    let p = { tema: 'oscuro', a11y: ['contraste'] }
    p = alternarA11y(p, 'grande')
    p = alternarA11y(p, 'voz')
    expect(p.a11y).toEqual(['contraste', 'grande'])
    expect(p.voz).toBe(true)
    expect(a11yActivo(p, 'dalton')).toBe(false)
    expect(resumenA11y(p)).toBe('texto grande, modo voz')
    p = alternarA11y(p, 'grande')
    expect(p.a11y).toEqual(['contraste'])
    expect(resumenA11y({})).toBe('ninguna activada')
  })
})

describe('estado de permisos (pantalla Privacidad y permisos)', () => {
  it('normaliza los valores del navegador', () => {
    expect(normalizarPermiso('granted')).toBe('permitido')
    expect(normalizarPermiso('denied')).toBe('bloqueado')
    expect(normalizarPermiso('prompt')).toBe('sin_decidir')
    expect(normalizarPermiso('default')).toBe('sin_decidir') // Notification.permission
    expect(normalizarPermiso(undefined)).toBe('desconocido')
  })
  it('traduce el estado a texto corto', () => {
    expect(textoPermiso('permitido')).toBe('Permitido')
    expect(textoPermiso('bloqueado')).toBe('No permitido')
    expect(textoPermiso('sin_decidir')).toBe('Sin decidir')
    expect(textoPermiso('no_soportado')).toMatch(/no disponible/i)
    expect(textoPermiso('desconocido')).toBeTruthy()
  })
  it('ubicación: usa navigator.permissions cuando existe', async () => {
    const perms = (state) => ({ query: async ({ name }) => { expect(name).toBe('geolocation'); return { state } } })
    expect(await leerPermisoUbicacion(perms('granted'), {})).toBe('permitido')
    expect(await leerPermisoUbicacion(perms('denied'), {})).toBe('bloqueado')
    expect(await leerPermisoUbicacion(perms('prompt'), {})).toBe('sin_decidir')
  })
  it('ubicación: sin permissions no inventa; sin geolocation no está disponible', async () => {
    expect(await leerPermisoUbicacion(undefined, {})).toBe('desconocido')
    expect(await leerPermisoUbicacion({ query: async () => { throw new Error('x') } }, {})).toBe('desconocido')
    expect(await leerPermisoUbicacion(undefined, undefined)).toBe('no_soportado')
  })
  it('avisos: lee Notification.permission; sin Notification no está disponible', () => {
    expect(leerPermisoAvisos({ permission: 'granted' })).toBe('permitido')
    expect(leerPermisoAvisos({ permission: 'denied' })).toBe('bloqueado')
    expect(leerPermisoAvisos({ permission: 'default' })).toBe('sin_decidir')
    expect(leerPermisoAvisos(undefined)).toBe('no_soportado')
  })
  it('instrucciones para iPhone y Android en ambos permisos', () => {
    for (const k of ['ubicacion', 'avisos']) {
      expect(COMO_CAMBIAR[k].map((x) => x.donde)).toEqual(['iPhone (Safari)', 'Android (Chrome)'])
      expect(COMO_CAMBIAR[k].every((x) => x.pasos.length > 10)).toBe(true)
    }
  })
})

describe('volverAtras', () => {
  it('con historial de la app regresa a la pantalla anterior', () => {
    let atras = 0
    const ir = () => { throw new Error('no debe ir') }
    volverAtras({ state: { aguasD: 2 }, back: () => { atras += 1 } }, ir)
    expect(atras).toBe(1)
  })
  it('sin historial (entrada directa) va al respaldo', () => {
    const fue = []
    volverAtras({ state: { aguasD: 0 }, back: () => { throw new Error('no') } }, (s) => fue.push(s))
    volverAtras(undefined, (s) => fue.push(s), 'acceso')
    expect(fue).toEqual([null, 'acceso'])
  })
})
