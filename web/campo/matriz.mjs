// Matriz de dispositivos (2026-11-25): panel de filtros, filtro por nivel, daltonismo, desbordes. Uso: node matriz.mjs <url> <carpeta>
import { webkit, chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'
const [url = 'https://aguas-zmg.netlify.app', out = 'capturas'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const movil = (w, h, dpr = 3) => ({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true })
const tab = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const esc = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
const D = [
  ['ipad-11-horiz', webkit, devices['iPad (gen 11) landscape'] || tab(1180, 820)], ['ipad-11-vert', webkit, devices['iPad (gen 11)'] || tab(820, 1180)],
  ['ipad-mini-horiz', webkit, devices['iPad Mini landscape']], ['ipad-mini-vert', webkit, devices['iPad Mini']],
  ['ipad-pro11-horiz', webkit, devices['iPad Pro 11 landscape']], ['ipad-pro13-horiz', webkit, tab(1366, 1024)],
  ['tab-s9-horiz', chromium, devices['Galaxy Tab S9 landscape']], ['tab-s9-vert', chromium, devices['Galaxy Tab S9']],
  ['fold-cerrado', chromium, movil(344, 882, 2.6)], ['fold-abierto', chromium, movil(673, 841, 2.6)], ['fold-viejo', chromium, movil(280, 653, 3)],
  ['surface-duo', chromium, movil(540, 720, 2.5)], ['surface-duo-doble', chromium, movil(1114, 720, 2.5)],
  ['iphone-se3', webkit, devices['iPhone SE (3rd gen)']], ['iphone-15promax', webkit, devices['iPhone 15 Pro Max']], ['galaxy-s24', chromium, devices['Galaxy S24']],
  ['iphone-horiz', webkit, devices['iPhone 15 landscape']],
  ['pc-1024', chromium, esc(1024, 768)], ['pc-1280', chromium, esc(1280, 720)], ['pc-1366', chromium, esc(1366, 768)], ['mac-1440', chromium, esc(1440, 900)], ['pc-2560', chromium, esc(2560, 1440)],
]
const solo = process.env.SOLO ? process.env.SOLO.split(',') : null
const filas = []
for (const [n, motor, d] of D) {
  if (solo && !solo.includes(n)) continue
  if (!d) { console.log(n, 'sin perfil'); continue }
  const b = await motor.launch()
  const ctx = await b.newContext({ ...d, geolocation: { latitude: 20.6736, longitude: -103.344 }, permissions: ['geolocation'], locale: 'es-MX' })
  await ctx.addInitScript(() => { localStorage.setItem('aguas.onboarded', 'true') })
  const p = await ctx.newPage(); const vw = d.viewport.width, vh = d.viewport.height
  const t = async (loc) => (d.hasTouch ? loc.tap({ timeout: 5000 }) : loc.click({ timeout: 5000 }))
  const r = { n, vp: `${vw}×${vh}` }
  try {
    await p.goto(url + '?prueba=1', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
    // escenario con pines
    const mas = p.locator('button:visible,a:visible').filter({ hasText: /^Más$/ }).first()
    await t(mas); await t(p.locator('button:visible').filter({ hasText: /Cargar escenario/ }).first())
    await t(p.locator('button:visible,a:visible').filter({ hasText: /^Mapa$/ }).first()).catch(() => {})
    await p.waitForTimeout(1500)
    r.desborde_x = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll('button,a')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.right > innerWidth + 1 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.leaflet-container') }).length)
    await p.screenshot({ path: `${out}/${n}-1-mapa.png` })
    const pines0 = await p.locator('.leaflet-marker-icon .pin').count()
    await t(p.locator('button:visible').filter({ hasText: /^Filtrar/ }).first()); await p.waitForTimeout(600)
    const box = await p.locator('.mp-capas').boundingBox()
    r.panel_cabe = !!box && box.y >= 0 && box.y + box.height <= vh + 1
    const acc = await p.locator('.mp-capas-acc').boundingBox(); r.listo_visible = !!acc && acc.y + acc.height <= vh + 1
    await t(p.locator('.mp-chip').first()); await p.waitForTimeout(700)
    r.panel_sigue = await p.locator('.mp-capas').count() === 1
    r.bajo = await p.locator('.mp-chip').first().getAttribute('aria-pressed')
    // El filtro de nivel debe ocultar los pines de ese nivel (escenario: 8 pines, 2 de nivel bajo)
    r.pines_sin_bajo = await p.locator('.leaflet-marker-icon .pin').count()
    await p.screenshot({ path: `${out}/${n}-2-filtros.png` })
    r.scroll_pagina = await p.evaluate(() => document.scrollingElement.scrollTop)
    await t(p.locator('.mp-capas-acc .btn').first()) // Ver todos
    await t(p.locator('.mp-tab').first()); await p.waitForTimeout(300)
    const sw = p.locator('.mp-capa--dalton'); await sw.scrollIntoViewIfNeeded()
    const c0 = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ra').trim())
    await t(sw); await p.waitForTimeout(500)
    const c1 = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ra').trim())
    r.dalton = c0 !== c1 ? `${c0}→${c1}` : 'NO CAMBIA'
    await p.screenshot({ path: `${out}/${n}-3-dalton.png` })
    await t(sw) // regresa
    r.pines = pines0
  } catch (e) { r.error = e.message.split('\n')[0].slice(0, 90) }
  filas.push(r); console.log(JSON.stringify(r))
  await b.close()
}
