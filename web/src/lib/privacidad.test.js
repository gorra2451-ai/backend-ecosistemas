import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Guardas de privacidad sobre el código de las pantallas (revisión PR #14):
// 1) La ubicación del DISPOSITIVO nunca va a Nominatim (tercero). direccionDe solo recibe coordenadas
//    de reportes o zonas, que ya son públicas.
// 2) Las reglas de uso de Nominatim prohíben buscar mientras se teclea: buscarLugar solo al enviar.
const DIR = join(__dirname, '../screens')
const pantallas = readdirSync(DIR).filter((f) => f.endsWith('.jsx')).map((f) => [f, readFileSync(join(DIR, f), 'utf8')])

describe('privacidad · Nominatim', () => {
  it('ninguna pantalla manda ubic (GPS del dispositivo) a direccionDe', () => {
    const malas = pantallas.filter(([, src]) => /direccionDe\(\s*(ubic|u|pos|gps|coords)\s*[.,)]/.test(src)).map(([f]) => f)
    expect(malas).toEqual([])
  })
  it('Reportar no llama a direccionDe (el paso Detalles muestra "Tu ubicación (GPS)")', () => {
    const src = pantallas.find(([f]) => f === 'Reportar.jsx')[1]
    expect(src).not.toMatch(/direccionDe/)
  })
  it('sin autocompletar: buscarLugar no va dentro de un debounce ni de un timer', () => {
    const malas = pantallas.filter(([, src]) => /buscarLugar/.test(src) && /(debounce\(|setTimeout\()[\s\S]{0,300}buscarLugar/.test(src)).map(([f]) => f)
    expect(malas).toEqual([])
  })
})
