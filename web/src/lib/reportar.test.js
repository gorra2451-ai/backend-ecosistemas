import { describe, it, expect, vi } from 'vitest'
vi.mock('./supabase.js', () => ({ supabase: {} }))
import {
  pasanCarrosPara, armarReporte, casoAcudo, chipEstado, lineaDeTiempo, etiquetaReporte,
  linkMaps, linkWhatsApp, textoFamilia, leerCola, encolar, quitarDeCola, medidasMax, haceCuanto,
  GRAVEDAD_CALLE, pasanCarrosDeGravedad, pasosStepper, resumenReporte,
  unirMisReportes, filaMiReporte, filaCercano, textoUbicacion, extensionEvidencia, tipoEvidencia, estadoEnviado, mensajeEnviado,
  validarArchivo, MAX_EVIDENCIA_BYTES, MENSAJE_ARCHIVO, ACEPTA_EVIDENCIA, tituloUbicacion, crearCandado, seguimientoReporte,
} from './reportar.js'
import { supabase } from './supabase.js'

const memoria = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) } }
const ubic = { lat: 20.6497, lng: -103.4016, precision: 8 }

describe('pasanCarrosPara', () => {
  it('calle usa la respuesta; los demás tipos mandan true (el backend no acepta null)', () => {
    expect(pasanCarrosPara('calle', true)).toBe(true)
    expect(pasanCarrosPara('calle', false)).toBe(false)
    expect(pasanCarrosPara('casa')).toBe(true)
    expect(pasanCarrosPara('coche')).toBe(true)
    expect(pasanCarrosPara('persona_en_riesgo')).toBe(true)
  })
})

describe('armarReporte', () => {
  it('payload para crear_reporte y registro local con el mismo id', () => {
    const { payload, rep } = armarReporte({ tipo: 'calle', detalle: 'no', pasanCarros: false, ubic, id: 'x', ahora: 5 })
    expect(payload).toEqual({ id: 'x', tipo: 'calle', pasanCarros: false, lat: ubic.lat, lng: ubic.lng, precision: 8 })
    expect(rep).toEqual({ id: 'x', tipo: 'calle', detalle: 'no', lat: ubic.lat, lng: ubic.lng, precision: 8, creado: 5 })
  })
  it('nivel del agua en casa NO viaja al backend (solo front)', () => {
    const { payload, rep } = armarReporte({ tipo: 'casa', detalle: 'cintura', ubic, id: 'y' })
    expect(payload).not.toHaveProperty('detalle')
    expect(payload.pasanCarros).toBe(true)
    expect(rep.detalle).toBe('cintura')
  })
})

describe('etiquetas y estado', () => {
  it('etiqueta tipo · detalle', () => {
    expect(etiquetaReporte({ tipo: 'casa', detalle: 'rodilla' })).toBe('Casa inundada · Agua a las rodillas')
    expect(etiquetaReporte({ tipo: 'persona_en_riesgo' })).toBe('Persona en riesgo')
  })
  it('caso de ¿A quién acudo? solo para casa y coche', () => {
    expect(casoAcudo('casa')).toBe('casa')
    expect(casoAcudo('coche')).toBe('coche')
    expect(casoAcudo('calle')).toBe(null)
  })
  it('chip según estado', () => {
    expect(chipEstado('pendiente').texto).toBe('Pendiente')
    expect(chipEstado('activo').clase).toBe('chip-act')
    expect(chipEstado('cola').texto).toBe('En cola · sin señal')
  })
  it('línea de tiempo marca el paso actual', () => {
    expect(lineaDeTiempo('pendiente').map((p) => p.k)).toEqual(['done', 'now', 'next', 'next'])
    expect(lineaDeTiempo('activo').map((p) => p.k)).toEqual(['done', 'done', 'now', 'next'])
    expect(lineaDeTiempo('resuelto').map((p) => p.k)).toEqual(['done', 'done', 'done', 'done'])
    expect(lineaDeTiempo('cola').map((p) => p.k)).toEqual(['now', 'next', 'next', 'next'])
  })
  it('hace cuánto', () => {
    expect(haceCuanto(null)).toBe('—')
    expect(haceCuanto(new Date(0).toISOString(), 4 * 60000)).toBe('hace 4 min')
    expect(haceCuanto(new Date(0).toISOString(), 120 * 60000)).toBe('hace 2 h')
  })
})

describe('enlaces', () => {
  it('Google Maps y WhatsApp', () => {
    expect(linkMaps(20.6497, -103.4016)).toBe('https://www.google.com/maps?q=20.649700,-103.401600')
    expect(linkWhatsApp('Hola ñ')).toBe('https://wa.me/?text=Hola%20%C3%B1')
    expect(textoFamilia({ tipo: 'calle', detalle: 'no', lat: 1, lng: 2 })).toContain('no pasan carros')
  })
})

describe('cola sin señal', () => {
  it('encola, no duplica por id y quita', () => {
    const st = memoria()
    expect(leerCola(st)).toEqual([])
    encolar({ payload: { id: 'a' }, rep: { id: 'a' } }, st)
    encolar({ payload: { id: 'a' }, rep: { id: 'a' } }, st)
    encolar({ payload: { id: 'b' }, rep: { id: 'b' } }, st)
    expect(leerCola(st).map((x) => x.payload.id)).toEqual(['a', 'b'])
    expect(quitarDeCola('a', st).map((x) => x.payload.id)).toEqual(['b'])
  })
  it('sin storage no truena', () => {
    expect(leerCola(null)).toEqual([])
  })
})

describe('medidasMax (foto ≤ 1600 px)', () => {
  it('reduce el lado mayor y respeta proporción', () => {
    expect(medidasMax(4000, 3000)).toEqual({ w: 1600, h: 1200 })
    expect(medidasMax(3000, 4000)).toEqual({ w: 1200, h: 1600 })
  })
  it('no agranda fotos chicas', () => {
    expect(medidasMax(800, 600)).toEqual({ w: 800, h: 600 })
    expect(medidasMax(0, 600)).toEqual({ w: 0, h: 0 })
  })
})

describe('ronda 2 · flujo del Equipo Reporte', () => {
  it('gravedad de calle → p_pasan_carros (solo "Paso bloqueado" manda false)', () => {
    expect(GRAVEDAD_CALLE.map((g) => `${g.t}:${g.k}`)).toEqual(['Bajo:sin_riesgo', 'Medio:limitado', 'Alto:bloqueado'])
    expect(pasanCarrosDeGravedad('bloqueado')).toBe(false)
    expect(pasanCarrosDeGravedad('limitado')).toBe(true)
    expect(pasanCarrosDeGravedad('sin_riesgo')).toBe(true)
    const { payload, rep } = armarReporte({ tipo: 'calle', detalle: 'sin_riesgo', pasanCarros: pasanCarrosDeGravedad('sin_riesgo'), ubic, id: 'z' })
    expect(payload.pasanCarros).toBe(true)
    expect(payload).not.toHaveProperty('detalle')
    expect(rep.detalle).toBe('sin_riesgo')
  })
  it('stepper marca hechos, actual y pendientes; el último paso cuenta como hecho', () => {
    expect(pasosStepper(0).map((p) => p.k)).toEqual(['now', 'next', 'next', 'next'])
    expect(pasosStepper(2).map((p) => p.k)).toEqual(['done', 'done', 'now', 'next'])
    expect(pasosStepper(3).map((p) => p.k)).toEqual(['done', 'done', 'done', 'done'])
    expect(pasosStepper(1)[1].label).toBe('Detalles')
  })
  it('resumen: tipo, nivel con patrón, dirección o precisión, foto', () => {
    expect(resumenReporte({ tipo: 'calle', gravedad: 'bloqueado', direccion: 'Av. Patria 123, Zapopan', archivo: 'a.jpg' }))
      .toEqual([
        { icono: 'calle', texto: 'Calle inundada' }, { icono: 'barras', texto: 'Alto', patron: 'p-alto' },
        { icono: 'pin', texto: 'Av. Patria 123, Zapopan' }, { icono: 'imagen', texto: 'a.jpg' },
      ])
    expect(resumenReporte({ tipo: 'casa', precision: 12.4 }).map((x) => x.texto)).toEqual(['Casa inundada', 'Tu ubicación (GPS) ±12 m', 'Sin foto'])
    expect(resumenReporte({ tipo: 'casa', evidenciaFallo: true }).at(-1).texto).toBe('La foto no se subió')
    expect(resumenReporte(null)).toEqual([])
  })
  it('texto para la familia según gravedad', () => {
    expect(textoFamilia({ tipo: 'calle', detalle: 'bloqueado', lat: 1, lng: 2 })).toMatch(/^Se inundó la calle, no se puede pasar\./)
    expect(textoFamilia({ tipo: 'calle', detalle: 'sin_riesgo', lat: 1, lng: 2 })).toMatch(/^Se inundó la calle\. Aquí/)
  })
})

describe('ronda 3 · HTML validado del Equipo Reporte + contrato v2', () => {
  it('armarReporte con gravedad: la manda y deduce pasan_carros; guarda dirección', () => {
    const { payload, rep } = armarReporte({ tipo: 'casa', gravedad: 'bloqueado', ubic, direccion: 'Av. X', id: 'g', ahora: 1 })
    expect(payload).toEqual({ id: 'g', tipo: 'casa', pasanCarros: false, gravedad: 'bloqueado', lat: ubic.lat, lng: ubic.lng, precision: 8 })
    expect(rep).toMatchObject({ gravedad: 'bloqueado', detalle: 'bloqueado', direccion: 'Av. X' })
    expect(armarReporte({ tipo: 'calle', gravedad: 'sin_riesgo', ubic, id: 'h' }).payload.pasanCarros).toBe(true)
  })
  it('texto de ubicación: dirección o precisión', () => {
    expect(textoUbicacion('Av. Patria 123', 9)).toBe('Av. Patria 123')
    // Sin dirección: el GPS del dispositivo nunca va a Nominatim (privacidad), se muestra genérico.
    expect(textoUbicacion(null, 9.6)).toBe('Tu ubicación (GPS) ±10 m')
    expect(textoUbicacion(null, 0)).toBe('Tu ubicación (GPS)')
  })
  it('evidencia: solo fotos jpeg/png/webp (los videos guardan GPS en sus metadatos)', () => {
    expect(extensionEvidencia('image/jpeg')).toBe('jpg')
    expect(extensionEvidencia('image/png')).toBe('png')
    expect(extensionEvidencia('image/webp')).toBe('webp')
    expect(extensionEvidencia('video/quicktime')).toBe(null)
    expect(extensionEvidencia('video/mp4')).toBe(null)
    expect(extensionEvidencia('application/pdf')).toBe(null)
    expect(tipoEvidencia('image/png')).toBe('foto')
    expect(tipoEvidencia('video/mp4')).toBe(null)
    expect(tipoEvidencia('image/gif')).toBe(null)
    expect(ACEPTA_EVIDENCIA).toBe('image/jpeg,image/png,image/webp')
  })
  it('enviado: copy honesto según estado', () => {
    expect(mensajeEnviado('pendiente')).toBe('Tu reporte ya está en el mapa. Te avisamos cuando lo confirmen.')
    expect(estadoEnviado('pendiente')).toBe('Sin confirmar · esperando a otros vecinos')
    expect(estadoEnviado('cola')).toMatch(/En cola/)
  })
  it('unirMisReportes: servidor manda, local aporta dirección y lo que el servidor no tiene', () => {
    const local = [
      { id: 'a', tipo: 'casa', estado: 'pendiente', direccion: 'Av. A', creado: 1000 },
      { id: 'c', tipo: 'calle', estado: 'cola', creado: 3000 },
    ]
    const srv = [{ id: 'a', tipo: 'casa', gravedad: 'limitado', estado: 'activo', confirmaciones_si: 6, nivel: 'bajo', creado_en: new Date(2000).toISOString() }]
    const l = unirMisReportes(srv, local)
    expect(l.map((r) => r.id)).toEqual(['c', 'a'])
    expect(l[1]).toMatchObject({ estado: 'activo', direccion: 'Av. A', confirmacionesSi: 6, nivel: 'bajo', creado: 2000 })
    expect(unirMisReportes(null, local).map((r) => r.id)).toEqual(['c', 'a'])
  })
  it('filaMiReporte: estado, confirmaciones, nivel con patrón y hace cuánto', () => {
    const f = filaMiReporte({ tipo: 'coche', estado: 'pendiente', confirmacionesSi: 1, creado: 1 }, 5 * 60000)
    expect(f).toEqual({ titulo: 'Coche atrapado', estado: 'Esperando 5 confirmaciones', confirmaciones: '1 confirmación “sí”', nivel: null, hace: 'hace 5 min' })
    expect(filaMiReporte({ tipo: 'calle', estado: 'activo', nivel: 'critico', confirmacionesSi: 21 }).nivel).toEqual({ texto: 'Nivel crítico', patron: 'p-alto' })
    expect(filaMiReporte({ tipo: 'calle', estado: 'en_revision' }).estado).toBe('En revisión')
  })
  it('filaCercano: distancia, estado y nivel', () => {
    const f = filaCercano({ tipo: 'calle', distancia_m: 120.4, estado: 'pendiente', gravedad: 'bloqueado', ultima_confirmacion: null, creado_en: new Date(0).toISOString() }, 7 * 60000)
    expect(f).toEqual({ titulo: 'Calle inundada', lugar: 'A 120 m de ti', estado: 'Sin confirmar', nivel: { texto: 'Agua: alto', patron: 'p-alto' }, hace: 'Actualizado hace 7 min' })
    expect(filaCercano({ tipo: 'casa', estado: 'activo', nivel: 'medio' }).nivel).toEqual({ texto: 'Nivel medio', patron: 'p-medio' })
    // D-029: manda la altura del agua aunque las confirmaciones digan otro nivel; persona en riesgo sin nivel
    expect(filaCercano({ tipo: 'casa', nivel: 'bajo', gravedad: 'limitado' }).nivel.texto).toBe('Agua: medio')
    expect(filaCercano({ tipo: 'persona_en_riesgo', nivel: 'alto' }).nivel).toBe(null)
    expect(filaMiReporte({ tipo: 'persona_en_riesgo', nivel: 'alto' }).nivel).toBe(null)
  })
})

describe('validarArchivo (refleja parametros.max_evidencia_bytes)', () => {
  it('límite de 10 MB igual al bucket', () => expect(MAX_EVIDENCIA_BYTES).toBe(10485760))
  it('justo en el límite pasa; un byte más es muy_grande', () => {
    expect(validarArchivo({ size: 10485760, type: 'image/jpeg' })).toBeNull()
    expect(validarArchivo({ size: 10485761, type: 'image/jpeg' })).toBe('muy_grande')
  })
  it('solo fotos: un video se rechaza aunque pese poco; otro tipo tampoco pasa', () => {
    expect(validarArchivo({ size: 1000, type: 'image/png' })).toBeNull()
    expect(validarArchivo({ size: 1000, type: 'image/webp' })).toBeNull()
    expect(validarArchivo({ size: 1000, type: 'video/mp4' })).toBe('solo_fotos')
    expect(validarArchivo({ size: 1000, type: 'video/quicktime' })).toBe('solo_fotos')
    expect(validarArchivo({ size: 1000, type: 'application/pdf' })).toBe('tipo_invalido')
  })
  it('mensaje para la persona', () => {
    expect(MENSAJE_ARCHIVO.muy_grande).toBe('El archivo pesa más de 10 MB. Elige uno más ligero o envía sin foto.')
    expect(MENSAJE_ARCHIVO.solo_fotos).toBe('Por ahora solo fotos: los videos guardan tu ubicación.')
    expect(MENSAJE_ARCHIVO.tipo_invalido).toMatch(/JPG, PNG o WEBP/)
  })
})

describe('tituloUbicacion', () => {
  it('elegida · detectada · sin ubicación', () => {
    expect(tituloUbicacion({ elegido: true, real: false })).toBe('Ubicación elegida')
    expect(tituloUbicacion({ elegido: false, real: true })).toBe('Ubicación detectada')
    expect(tituloUbicacion({ elegido: false, real: false })).toBe('Sin ubicación')
  })
})

describe('crearCandado (doble toque en Enviar)', () => {
  it('un segundo toque mientras corre el primero no vuelve a ejecutar', async () => {
    let n = 0
    let soltar
    const correr = crearCandado()
    const tarea = () => { n++; return new Promise((r) => { soltar = r }) }
    const a = correr(tarea)
    const b = correr(tarea)
    expect(n).toBe(1)
    soltar('ok')
    expect(await a).toBe('ok')
    expect(await b).toBeUndefined()
    const c = correr(async () => { n++; return 'otra' })
    expect(await c).toBe('otra')
    expect(n).toBe(2)
  })
  it('se libera aunque la tarea falle', async () => {
    const correr = crearCandado()
    await expect(correr(async () => { throw new Error('x') })).rejects.toThrow('x')
    expect(await correr(async () => 1)).toBe(1)
  })
})

describe('seguimientoReporte', () => {
  it('cuenta confirmaciones con reporte_id (anon/authenticated no leen la columna id)', async () => {
    const cols = []
    const cadena = (res) => { const q = { eq: () => q, maybeSingle: () => Promise.resolve(res), then: (f, g) => Promise.resolve(res).then(f, g) }; return q }
    supabase.from = (tabla) => ({
      select: (c) => {
        if (tabla === 'reportes') return cadena({ data: { estado: 'activo', ultima_confirmacion: null }, error: null })
        cols.push(c)
        return cadena(c === 'id' ? { count: null, error: { code: '42501', message: 'permission denied' } } : { count: 3, error: null })
      },
    })
    const { data } = await seguimientoReporte('r1')
    expect(cols).toEqual(['reporte_id'])
    expect(data.confirmaciones).toBe(3)
  })
})
