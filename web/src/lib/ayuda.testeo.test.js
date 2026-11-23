// Testeo de usabilidad (carril C): textos y reglas puras de ¿A quién acudo?, refugios y avisos.
import { describe, it, expect } from 'vitest'
import {
  etiquetaMunicipio, mensajeLlamada, fechaCorta, encabezadoGuardado, estadoRefugio, accesibilidadRefugio,
  textoSinRefugios, resumenAvisos, textoSilencio, textoAvisosSinClima, telRefugio, leerCacheRefugios,
  CASOS_URGENTES, CASOS_NO_URGENTES, CASOS_EQUIPO,
} from './ayuda.js'

// Fechas locales para no depender de la zona horaria de la máquina.
const local = (y, m, d, h, min) => new Date(y, m - 1, d, h, min).getTime()

describe('testeo · municipio', () => {
  it('nunca dice "detectado" si la persona lo eligió o si no hay detección', () => {
    expect(etiquetaMunicipio({ elegido: true })).toBe('Municipio que elegiste')
    expect(etiquetaMunicipio({ elegido: false })).toBe('Municipio de ejemplo: elige el tuyo')
    expect(etiquetaMunicipio({ elegido: false, detectado: true })).toBe('Municipio detectado')
    expect(etiquetaMunicipio({ elegido: true, detectado: true })).toBe('Municipio que elegiste')
  })
})

describe('testeo · urgencias primero', () => {
  it('persona herida va aparte y los demás casos siguen completos', () => {
    expect(CASOS_URGENTES).toEqual(['persona_herida'])
    expect(CASOS_NO_URGENTES).not.toContain('persona_herida')
    expect([...CASOS_URGENTES, ...CASOS_NO_URGENTES].sort()).toEqual([...CASOS_EQUIPO].sort())
  })
})

describe('testeo · mensaje para reenviar', () => {
  it('cifra al inicio, heridas separadas del total y sin repetir', () => {
    expect(mensajeLlamada({ caso: 'persona_herida', say: 'hay una persona herida', heridas: 1, personas: 2, lugar: 'Zapopan' }))
      .toBe('Hay 1 persona herida. En total somos 2. Estamos en Zapopan.')
    expect(mensajeLlamada({ caso: 'persona_herida', say: 'hay una persona herida', heridas: 3, personas: 3 }))
      .toBe('Hay 3 personas heridas. En total somos 3.')
  })
  it('el total nunca es menor que las heridas', () => {
    expect(mensajeLlamada({ caso: 'persona_herida', heridas: 2, personas: 1 })).toBe('Hay 2 personas heridas. En total somos 2.')
  })
  it('sin heridas: situación y total', () => {
    expect(mensajeLlamada({ caso: 'casa', say: 'se metió el agua a mi casa', heridas: 0, personas: 1, lugar: 'Tonalá' }))
      .toBe('Se metió el agua a mi casa. Somos 1 persona. Estamos en Tonalá.')
    expect(mensajeLlamada({ caso: 'coche', say: 'mi carro se quedó atorado', heridas: 0, personas: 4 }))
      .toBe('Mi carro se quedó atorado. Somos 4 personas.')
  })
  it('heridas en otro caso: van antes de la situación', () => {
    expect(mensajeLlamada({ caso: 'coche', say: 'mi carro se quedó atorado', heridas: 1, personas: 2 }))
      .toBe('Hay 1 persona herida. En total somos 2. Mi carro se quedó atorado.')
  })
  it('calle o referencia opcional', () => {
    expect(mensajeLlamada({ caso: 'calle', say: 'la calle está inundada', personas: 1, lugar: 'Zapopan', referencia: ' Av. Patria y Vallarta ' }))
      .toBe('La calle está inundada. Somos 1 persona. Estamos en Zapopan, Av. Patria y Vallarta.')
    expect(mensajeLlamada({ caso: 'calle', say: 'x', personas: 1, referencia: 'junto al Oxxo' }))
      .toBe('X. Somos 1 persona. Referencia: junto al Oxxo.')
  })
})

describe('testeo · refugios', () => {
  const ahora = local(2026, 11, 23, 18, 0)
  it('fecha corta: hoy, ayer o día', () => {
    expect(fechaCorta(local(2026, 11, 23, 16, 40), ahora)).toBe('hoy 16:40')
    expect(fechaCorta(local(2026, 11, 22, 9, 5), ahora)).toBe('ayer 9:05')
    expect(fechaCorta(local(2026, 11, 12, 16, 40), ahora)).toBe('12 nov 16:40')
    expect(fechaCorta(null, ahora)).toBeNull()
  })
  it('encabezado de información guardada', () => {
    expect(encabezadoGuardado(local(2026, 11, 22, 9, 5), ahora)).toBe('Información de ayer 9:05: puede haber cambiado · confirma antes de ir')
    expect(encabezadoGuardado(null, ahora)).toBe('Información guardada antes (no sabemos cuándo): puede haber cambiado · confirma antes de ir')
  })
  it('estado: sin dato no afirma que esté abierto', () => {
    expect(estadoRefugio({}, ahora)).toEqual({ clave: 'desconocido', texto: 'No sabemos si está abierto', detalle: null })
    const r = estadoRefugio({ verificado_en: new Date(local(2026, 11, 23, 16, 40)).toISOString() }, ahora)
    expect(r.texto).toBe('No sabemos si está abierto')
    expect(r.detalle).toBe('Datos del refugio confirmados hoy 16:40')
    const ab = estadoRefugio({ estado: 'abierto', estado_en: new Date(ahora - 20 * 60000).toISOString() }, ahora)
    expect(ab).toEqual({ clave: 'abierto', texto: 'Abierto · confirmado hace 20 min', detalle: null })
    expect(estadoRefugio({ estado: 'cerrado' }, ahora).texto).toBe('Cerrado')
  })
  it('accesibilidad: tres estados, sin dato = pregunta antes de ir', () => {
    expect(accesibilidadRefugio({ accesible: true })).toEqual({ clave: 'si', texto: 'Accesible' })
    expect(accesibilidadRefugio({ accesible: false }).texto).toBe('No accesible')
    expect(accesibilidadRefugio({}).texto).toBe('Sin información: pregunta antes de ir')
    expect(accesibilidadRefugio({ accesible: null }).clave).toBe('sin_info')
  })
  it('teléfono solo si viene en los datos', () => {
    expect(telRefugio({ telefono: '33 1234 5678' })).toEqual({ texto: '33 1234 5678', href: 'tel:3312345678' })
    expect(telRefugio({})).toBeNull()
    expect(telRefugio({ telefono: '  ' })).toBeNull()
  })
  it('lista vacía no dice que no existan refugios', () => {
    const t = textoSinRefugios()
    expect(t.titulo).toBe('La app no tiene refugios confirmados aquí')
    expect(t.cuerpo).toMatch(/Eso no quiere decir que no existan/)
    expect(t.otraVia).toBe('Consulta en el sitio de tu municipio')
  })
  it('cache: acepta el formato viejo (arreglo) y el nuevo con fecha', () => {
    expect(leerCacheRefugios([{ id: 1 }])).toEqual({ lista: [{ id: 1 }], guardadoEn: null })
    expect(leerCacheRefugios({ lista: [], guardadoEn: 5 })).toEqual({ lista: [], guardadoEn: 5 })
    expect(leerCacheRefugios(null)).toEqual({ lista: null, guardadoEn: null })
  })
})

describe('testeo · avisos', () => {
  it('pantalla sin alertas de clima no da a entender calles sin problema', () => {
    expect(textoAvisosSinClima(0)).toEqual({ titulo: 'Sin alertas de clima ahora', cuerpo: 'Esto es solo del clima. Para ver si hay agua en las calles, revisa el mapa.' })
    expect(textoAvisosSinClima(3).titulo).toBe('Sin alertas de clima ahora, pero hay 3 calles con agua cerca')
    expect(textoAvisosSinClima(1).titulo).toBe('Sin alertas de clima ahora, pero hay 1 calle con agua cerca')
    expect(textoAvisosSinClima(null).cuerpo).toMatch(/solo del clima/)
  })
  it('resumen con dos estados y sin la palabra push', () => {
    const r = resumenAvisos({ munis: { Zapopan: true, Tonalá: true }, on: true, permiso: 'granted', municipioPush: 'Zapopan' })
    expect(r.zonas).toBe('Zonas elegidas: Zapopan, Tonalá')
    expect(r.celular).toBe('Avisos en tu celular: activos (Zapopan)')
    expect(r.alerta).toBeNull()
    const sp = resumenAvisos({ munis: {}, on: false, permiso: 'denied' })
    expect(sp.zonas).toBe('Zonas elegidas: ninguna')
    expect(sp.celular).toBe('Avisos en tu celular: sin permiso')
    expect(sp.alerta).toBe('No recibirás avisos con la app cerrada')
    expect(resumenAvisos({ munis: {}, on: false, permiso: 'default' }).celular).toBe('Avisos en tu celular: apagados')
    expect(resumenAvisos({ munis: {}, on: false, permiso: 'no_disponible' }).celular).toBe('Avisos en tu celular: no disponibles en este navegador')
    for (const x of [r, sp]) expect(JSON.stringify(x)).not.toMatch(/push/i)
  })
  it('silencio: hora de fin grande y qué cubre (regla actual: no pasa nada, ni lo fuerte)', () => {
    const t = textoSilencio(local(2026, 11, 23, 15, 40))
    expect(t.hasta).toBe('Silenciado hasta las 15:40')
    expect(t.cubre).toBe('Durante el silencio no recibirás ningún aviso en tu celular, tampoco las alertas fuertes.')
    expect(textoSilencio(local(2026, 11, 23, 1, 5)).hasta).toBe('Silenciado hasta la 1:05')
  })
})
