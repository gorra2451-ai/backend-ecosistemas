import { describe, it, expect } from 'vitest'
import { interpretarReporteVoz, resolverReporteVoz, escucharFrase, NO_TE_ENTENDI } from './vozReporte.js'

// gravedad sale con la clave del contrato (la misma de GRAVEDAD en reportar.js):
// Bajo → sin_riesgo · Medio → limitado · Alto → bloqueado.
const v = interpretarReporteVoz

describe('interpretarReporteVoz · ejemplos base', () => {
  it('calle + medio', () => {
    expect(v('calle inundada, agua a la rodilla')).toEqual({ tipo: 'calle', gravedad: 'limitado' })
  })
  it('casa sin gravedad', () => {
    expect(v('se metió agua a mi casa')).toEqual({ tipo: 'casa', gravedad: null })
  })
  it('coche + alto ("no pasan carros" no cuenta como tipo coche aparte)', () => {
    expect(v('mi coche está atrapado, no pasan carros')).toEqual({ tipo: 'coche', gravedad: 'bloqueado' })
  })
  it('persona en riesgo', () => {
    expect(v('hay una persona atrapada').tipo).toBe('persona_en_riesgo')
    expect(v('persona en riesgo').tipo).toBe('persona_en_riesgo')
    expect(v('estoy atrapado en mi coche').tipo).toBe('persona_en_riesgo')
  })
  it('bajo sin tipo', () => {
    expect(v('apenas un charco')).toEqual({ tipo: null, gravedad: 'sin_riesgo' })
  })
  it('no sé → nada', () => {
    expect(v('no sé')).toEqual({ tipo: null, gravedad: null })
    expect(v('')).toEqual({ tipo: null, gravedad: null })
    expect(v(null)).toEqual({ tipo: null, gravedad: null })
  })
})

describe('interpretarReporteVoz · normaliza', () => {
  it('ignora acentos y mayúsculas', () => {
    expect(v('CALLE INUNDADA')).toEqual({ tipo: 'calle', gravedad: null })
    expect(v('Se metió el agua a la CASA')).toEqual({ tipo: 'casa', gravedad: null })
    expect(v('el agua llega a la cintura en la avenida')).toEqual({ tipo: 'calle', gravedad: 'bloqueado' })
  })
  it('sin puntuación (el reconocedor no pone comas)', () => {
    expect(v('mi carro esta atrapado no pasan los coches')).toEqual({ tipo: 'coche', gravedad: 'bloqueado' })
  })
})

describe('interpretarReporteVoz · escala de la UI', () => {
  it('Bajo: se puede pasar con cuidado', () => {
    expect(v('calle con agua pero se puede pasar con cuidado').gravedad).toBe('sin_riesgo')
    expect(v('agua a los tobillos').gravedad).toBe('sin_riesgo')
    expect(v('nivel bajo').gravedad).toBe('sin_riesgo')
  })
  it('Medio: media llanta o rodilla', () => {
    expect(v('el agua llega a media llanta').gravedad).toBe('limitado')
    expect(v('nivel medio').gravedad).toBe('limitado')
  })
  it('Alto: no pasan carros', () => {
    expect(v('no se puede pasar').gravedad).toBe('bloqueado')
    expect(v('nivel alto').gravedad).toBe('bloqueado')
  })
  it('si hay dos niveles gana el más grave', () => {
    expect(v('agua a la rodilla, ya no pasan carros').gravedad).toBe('bloqueado')
  })
  it('"en medio de la calle" no es nivel medio', () => {
    expect(v('hay agua en medio de la calle')).toEqual({ tipo: 'calle', gravedad: null })
  })
  it('"sí pasan carros" es bajo y no cuenta como coche', () => {
    expect(v('la calle tiene agua pero sí pasan carros')).toEqual({ tipo: 'calle', gravedad: 'sin_riesgo' })
  })
})

describe('interpretarReporteVoz · frases ambiguas o negadas', () => {
  it('"no es mi casa, es la calle" → calle', () => {
    expect(v('no es mi casa, es la calle').tipo).toBe('calle')
    expect(v('no es mi casa es la calle').tipo).toBe('calle')
    expect(v('no es la casa sino la calle').tipo).toBe('calle')
  })
  it('negación pospuesta: "mi casa no, la calle sí" → calle', () => {
    expect(v('mi casa no, la calle sí').tipo).toBe('calle')
  })
  it('"no hay personas en riesgo" no es persona en riesgo', () => {
    expect(v('no hay personas en riesgo, es la calle').tipo).toBe('calle')
    expect(v('no hay nadie atrapado').tipo).toBe(null)
  })
  it('todo negado → nada', () => {
    expect(v('no es mi casa')).toEqual({ tipo: null, gravedad: null })
  })
  it('nivel negado no cuenta', () => {
    expect(v('calle inundada, no llega a la rodilla').gravedad).toBe(null)
  })
  it('varios tipos: lo específico gana a la calle', () => {
    expect(v('se metió el agua de la calle a mi casa').tipo).toBe('casa')
    expect(v('mi coche quedó atrapado en la calle').tipo).toBe('coche')
  })
  it('persona en riesgo gana a todo (seguridad)', () => {
    expect(v('mi casa se inundó y hay un señor atrapado').tipo).toBe('persona_en_riesgo')
  })
  it('palabras que solo contienen el término no cuentan', () => {
    expect(v('casamiento autobús callejón').tipo).toBe(null)
  })
})

describe('resolverReporteVoz', () => {
  it('con tipo da el destino paso2 con la gravedad si la hay', () => {
    expect(resolverReporteVoz(['calle inundada, agua a la rodilla'])).toEqual({ ok: true, tipo: 'calle', gravedad: 'limitado' })
    expect(resolverReporteVoz(['se metió agua a mi casa'])).toEqual({ ok: true, tipo: 'casa', gravedad: null })
  })
  it('usa la primera alternativa que trae tipo', () => {
    expect(resolverReporteVoz(['kaye inundada', 'calle inundada'])).toEqual({ ok: true, tipo: 'calle', gravedad: null })
  })
  it('sin tipo no avanza y da el mensaje de ayuda', () => {
    expect(resolverReporteVoz(['apenas un charco'])).toEqual({ ok: false, mensaje: NO_TE_ENTENDI })
    expect(resolverReporteVoz([])).toEqual({ ok: false, mensaje: NO_TE_ENTENDI })
    expect(resolverReporteVoz(null)).toEqual({ ok: false, mensaje: NO_TE_ENTENDI })
  })
  it('el mensaje trae un ejemplo', () => {
    expect(NO_TE_ENTENDI).toBe('No te entendí. Intenta: «calle inundada, agua a la rodilla»')
  })
})

describe('escucharFrase', () => {
  it('sin soporte responde vacío', () => {
    let r = 'x'; escucharFrase((a) => { r = a }, null); expect(r).toEqual([])
  })
  it('usa es-MX y entrega las alternativas en texto crudo', () => {
    let r, inst
    class Fake { constructor() { inst = this } start() { this.onresult({ results: [[{ transcript: 'calle' }, { transcript: 'kaye' }]] }); this.onend() } abort() {} }
    escucharFrase((a) => { r = a }, Fake)
    expect(inst.lang).toBe('es-MX'); expect(r).toEqual(['calle', 'kaye'])
  })
  it('error o fin sin resultado → vacío, una sola vez', () => {
    const r = []
    class Fake { start() { this.onerror(); this.onend() } abort() {} }
    escucharFrase((a) => r.push(a), Fake)
    expect(r).toEqual([[]])
  })
  it('cancelar aborta y ya no llama al callback', () => {
    let llamado = false, abortado = false, inst
    class Fake { constructor() { inst = this } start() {} abort() { abortado = true } }
    const cancelar = escucharFrase(() => { llamado = true }, Fake)
    cancelar(); inst.onend?.()
    expect(abortado).toBe(true); expect(llamado).toBe(false)
  })
})
