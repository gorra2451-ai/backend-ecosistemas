// Reproduce lo del video del iPad (2026-11-25): panel de filtros que parpadea y modo daltonismo que "no cambia".
// Uso: node ipad.mjs <url> <carpeta> [dispositivo]
import { webkit, chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'
const [url = 'https://aguas-zmg.netlify.app', out = 'capturas', disp = 'iPad Pro 11 landscape'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const d = devices[disp]; const motor = d.defaultBrowserType === 'chromium' ? chromium : webkit
const b = await motor.launch()
const ctx = await b.newContext({ ...d, geolocation: { latitude: 20.6736, longitude: -103.344 }, permissions: ['geolocation'], locale: 'es-MX' })
await ctx.addInitScript(() => { localStorage.setItem('aguas.onboarded', 'true') })
const p = await ctx.newPage()
const tag = disp.replace(/\W+/g, '-')
await p.goto(url + (url.includes('?') ? '&' : '?') + 'prueba=1', { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)
console.log(disp, 'viewport', d.viewport, '· desktop layout:', await p.evaluate(() => innerWidth >= 1024))
// 1) Abrir Filtrar y muestrear 20 veces en 2 s si el panel sigue abierto
await p.locator('button:visible').filter({ hasText: /^Filtrar/ }).first().tap()
const muestras = []
for (let i = 0; i < 20; i++) { muestras.push(await p.locator('.mp-capas').count()); await p.waitForTimeout(100) }
console.log('panel abierto en muestras:', muestras.join(''))
const y = await p.evaluate(() => [scrollY, document.scrollingElement.scrollHeight, innerHeight, visualViewport?.height])
console.log('scrollY/alto doc/innerHeight/visualViewport:', y.join(' / '))
await p.screenshot({ path: `${out}/${tag}-1-filtros.png` })
// 2) Tocar "Bajo" y ver si queda presionado y el panel sigue
const chip = p.locator('.mp-chip').first()
const antes = await chip.getAttribute('aria-pressed'); await chip.tap(); await p.waitForTimeout(500)
console.log('chip Bajo aria-pressed', antes, '→', await chip.getAttribute('aria-pressed').catch(() => 'panel cerrado'), '· panel:', await p.locator('.mp-capas').count())
await p.screenshot({ path: `${out}/${tag}-2-tras-bajo.png` })
// ¿el botón Listo se ve completo?
const listo = await p.locator('.mp-capas-acc').boundingBox().catch(() => null)
console.log('barra Ver todos/Listo:', listo && Math.round(listo.y + listo.height), 'de', d.viewport.height)
// 3) Leyenda → daltonismo
await p.locator('.mp-tab').first().tap(); await p.waitForTimeout(300)
const sw = p.locator('.mp-capa--dalton'); await sw.scrollIntoViewIfNeeded()
const c0 = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ra').trim() + ' a11y=' + (document.documentElement.dataset.a11y || ''))
await sw.tap(); await p.waitForTimeout(500)
const c1 = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ra').trim() + ' a11y=' + (document.documentElement.dataset.a11y || ''))
console.log('daltonismo: aria-checked', await sw.getAttribute('aria-checked'), '· --ra', c0, '→', c1)
await p.screenshot({ path: `${out}/${tag}-3-dalton.png` })
await b.close()
