// Captura la bienvenida (sin aguas.onboarded) en laptop baja y Mac: el botón principal debe verse sin desplazar.
import { chromium } from 'playwright'
const [url = 'https://aguas-zmg.netlify.app', out = 'capturas'] = process.argv.slice(2)
const b = await chromium.launch()
for (const [n, w, h] of [['win-1366', 1366, 768], ['mac-1440', 1440, 900]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage()
  await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200)
  const btn = p.locator('button:visible').filter({ hasText: /^Comenzar$/ }).first()
  const caja = await btn.boundingBox()
  console.log(n, '"Comenzar" visible sin desplazar:', !!caja && caja.y + caja.height <= h, caja && Math.round(caja.y))
  await p.screenshot({ path: `${out}/${n}-bienvenida.png` })
}
await b.close()
