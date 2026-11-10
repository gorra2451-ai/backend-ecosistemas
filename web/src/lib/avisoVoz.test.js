import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TEXTO_AVISO_VOZ, NOTA_VOZ, avisoVozAceptado, aceptarAvisoVoz, escuchaAutomatica } from './avisoVoz.js'

const memoria = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }
}
const roto = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('lleno') } }

describe('aviso de privacidad de voz', () => {
  it('el texto avisa que el navegador puede enviar la voz y que ¡Aguas! no guarda audio', () => {
    expect(TEXTO_AVISO_VOZ).toBe('Tu navegador puede enviar tu voz a su servicio de reconocimiento (en Chrome, Google) para convertirla en texto. ¡Aguas! no guarda audio.')
    expect(NOTA_VOZ).toBe('Tu voz la procesa tu navegador.')
  })
  it('sin nada guardado no está aceptado', () => {
    expect(avisoVozAceptado(memoria())).toBe(false)
  })
  it('al aceptar se guarda en aguas.avisoVoz y queda aceptado', () => {
    const s = memoria()
    expect(aceptarAvisoVoz(s)).toBe(true)
    expect(s.m.has('aguas.avisoVoz')).toBe(true)
    expect(avisoVozAceptado(s)).toBe(true)
  })
  it('un valor ajeno en la clave no cuenta como aceptado', () => {
    const s = memoria(); s.setItem('aguas.avisoVoz', 'quizá')
    expect(avisoVozAceptado(s)).toBe(false)
  })
  it('si el almacenamiento falla se toma como no aceptado y no lanza', () => {
    expect(avisoVozAceptado(roto)).toBe(false)
    expect(aceptarAvisoVoz(roto)).toBe(false)
    expect(avisoVozAceptado(null)).toBe(false)
    expect(aceptarAvisoVoz(undefined)).toBe(false)
  })
})

describe('escuchaAutomatica (modo vehículo)', () => {
  it('solo escucha sola si hay voz y el aviso ya se aceptó', () => {
    const s = memoria()
    expect(escuchaAutomatica(true, s)).toBe(false)
    aceptarAvisoVoz(s)
    expect(escuchaAutomatica(true, s)).toBe(true)
    expect(escuchaAutomatica(false, s)).toBe(false)
    expect(escuchaAutomatica(true, roto)).toBe(false)
  })
})

// Guardas sobre las pantallas (sin librería de componentes): el aviso va en línea, antes de escuchar.
const fuente = (f) => readFileSync(join(__dirname, '../screens', f), 'utf8')
describe.each(['Reportar.jsx', 'Confirmar.jsx'])('%s · aviso antes de escuchar', (f) => {
  const src = fuente(f)
  it('usa la lib del aviso y muestra texto, botones y nota', () => {
    expect(src).toMatch(/from '\.\.\/lib\/avisoVoz\.js'/)
    expect(src).toMatch(/TEXTO_AVISO_VOZ/)
    expect(src).toMatch(/NOTA_VOZ/)
    expect(src).toMatch(/Entendido, usar voz/)
    expect(src).toMatch(/aceptarAvisoVoz\(\)/)
    expect(src).toMatch(/avisoVozAceptado\(\)/)
  })
  it('no usa diálogos del navegador', () => {
    expect(src).not.toMatch(/\b(window\.)?(alert|confirm|prompt)\(/)
  })
})
it('Confirmar: en modo vehículo la escucha automática pasa por escuchaAutomatica', () => {
  const src = fuente('Confirmar.jsx')
  expect(src).toMatch(/escuchaAutomatica\(hayVoz\)/)
  expect(src).not.toMatch(/vivo && hayVoz\)\s*escuchar/)
})
