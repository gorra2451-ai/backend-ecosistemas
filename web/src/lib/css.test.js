import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import postcss from 'postcss'

// Una declaración suelta (p. ej. la 2.ª línea de una regla cuyo selector se borró) hace que el
// navegador descarte la regla SIGUIENTE completa. Pasó con .rp-stepper en reportar.css (ronda 3).
const DIR = join(__dirname, '../styles')

describe('CSS sin reglas rotas', () => {
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.css'))) {
    it(f, () => {
      const raiz = postcss.parse(readFileSync(join(DIR, f), 'utf8'))
      const rotos = []
      raiz.walkRules((r) => { if (/[;{}]|:\s*[\w-]+\s*;/.test(r.selector)) rotos.push(r.selector.slice(0, 80)) })
      expect(rotos).toEqual([])
    })
  }
})
