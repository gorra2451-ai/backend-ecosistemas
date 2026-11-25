// Matriz de dispositivos del flujo Reportar / Reportes / 911 / "¿Sigue inundado?" (2026-11-25).
// Mide por pantalla: desborde horizontal, botón principal alcanzable, la página no brinca (scrollTop 0), textos de botón partidos.
// Uso: node matriz_reportar.mjs <url> <carpeta>   (SOLO=fold-viejo,iphone-horiz para limitar). No crea reportes reales.
import { webkit, chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'
const [url = 'http://localhost:4176', out = 'capturas-matriz-reportar'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const movil = (w, h, dpr = 3) => ({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true })
const tab = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const esc = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
const D = [
  ['ipad-11-horiz', webkit, devices['iPad (gen 11) landscape'] || tab(1180, 820)], ['ipad-11-vert', webkit, devices['iPad (gen 11)'] || tab(820, 1180)],
  ['ipad-11-safari', webkit, tab(1180, 740)], // iPad real horizontal con la barra de Safari (el perfil de Playwright usa 944×656)
  ['ipad-mini-horiz', webkit, devices['iPad Mini landscape']], ['ipad-mini-vert', webkit, devices['iPad Mini']],
  ['ipad-pro11-horiz', webkit, devices['iPad Pro 11 landscape']], ['ipad-pro13-horiz', webkit, tab(1366, 1024)],
  ['tab-s9-horiz', chromium, devices['Galaxy Tab S9 landscape']], ['tab-s9-vert', chromium, devices['Galaxy Tab S9']],
  ['fold-cerrado', chromium, movil(344, 882, 2.6)], ['fold-abierto', chromium, movil(673, 841, 2.6)], ['fold-viejo', chromium, movil(280, 653, 3)],
  ['surface-duo', chromium, movil(540, 720, 2.5)], ['surface-duo-doble', chromium, movil(1114, 720, 2.5)],
  ['iphone-se3', webkit, devices['iPhone SE (3rd gen)']], ['iphone-15promax', webkit, devices['iPhone 15 Pro Max']], ['galaxy-s24', chromium, devices['Galaxy S24']],
  ['iphone-horiz', webkit, devices['iPhone 15 landscape']],
  ['pc-1024', chromium, esc(1024, 768)], ['pc-1280', chromium, esc(1280, 720)], ['pc-1366', chromium, esc(1366, 768)], ['pc-2560', chromium, esc(2560, 1440)],
]
const solo = process.env.SOLO ? process.env.SOLO.split(',') : null

// Medición en la página: desborde, página desplazada, botones con texto partido o cortado, y si el principal se alcanza.
const medir = (p, selPrincipal) => p.evaluate(async (sel) => {
  const W = innerWidth, H = innerHeight, fuera = []
  const visible = (e) => { const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && e.getClientRects().length }
  const enApp = (e) => !!e.closest('.screen,.confirm') && !e.closest('.leaflet-container')
  for (const e of document.querySelectorAll('button,a,input,.screen-inner > *')) {
    if (!visible(e) || !enApp(e)) continue
    const b = e.getBoundingClientRect()
    if (b.width && (b.right > W + 1 || b.left < -1)) fuera.push((e.textContent || e.className || e.tagName).trim().slice(0, 24))
  }
  const partidos = []
  for (const e of document.querySelectorAll('button,a.btn,a[class^="rp-"],.confirm button')) {
    if (!visible(e) || !enApp(e)) continue
    const t = (e.innerText || '').trim(); if (!t || t.length > 30) continue
    if (e.scrollWidth > e.clientWidth + 2) { partidos.push('CORTADO:' + t.slice(0, 20)); continue }
    // líneas reales del texto (sin contar íconos)
    // líneas del texto: solo nodos de texto (los íconos no cuentan)
    const tops = new Set(); const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT)
    for (let nd = w.nextNode(); nd; nd = w.nextNode()) { if (!nd.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(nd)
      for (const q of r.getClientRects()) if (q.width > 2 && q.height > 8) tops.add(Math.round(q.top / 8)) }
    if (tops.size > 1 && t.split(/\s+/).length <= 4) partidos.push(t.replace(/\n/g, ' ').slice(0, 24))
  }
  let principal = 'n/a', directo = null
  if (sel) {
    const el = [...document.querySelectorAll(sel.css)].find((e) => visible(e) && (!sel.re || new RegExp(sel.re).test(e.textContent.trim())))
    if (!el) principal = 'NO EXISTE'
    else {
      const b0 = el.getBoundingClientRect(); directo = b0.top >= 0 && b0.bottom <= H + 1
      el.scrollIntoView({ block: 'nearest' }); await new Promise((r) => setTimeout(r, 250))
      const b = el.getBoundingClientRect()
      const x = Math.min(W - 2, Math.max(1, b.left + b.width / 2)), y = Math.min(H - 2, Math.max(1, b.top + b.height / 2))
      const tope = document.elementFromPoint(x, y)
      const alcanza = b.top >= -1 && b.bottom <= H + 1 && b.right <= W + 1 && !!tope && (el === tope || el.contains(tope))
      principal = alcanza ? (directo ? 'visible' : 'desplazando') : `NO ALCANZABLE(${Math.round(b.top)}..${Math.round(b.bottom)}/${H}${tope && !el.contains(tope) ? ' tapado:' + (tope.className || tope.tagName).toString().slice(0, 20) : ''})`
    }
  }
  const pag = document.scrollingElement.scrollTop
  // regresar contenedores arriba para la captura
  return { desborde: document.documentElement.scrollWidth > W ? `scrollW ${document.documentElement.scrollWidth}` : fuera.length ? fuera.slice(0, 3).join('|') : '', principal, scrollPagina: pag, partidos: partidos.slice(0, 4).join('|') }
}, selPrincipal)

const P = {
  tipo: { css: '.rp-tiles .tile', re: null },
  cuanta: { css: 'button', re: '^Continuar$' },
  foto: { css: 'button', re: 'Enviar' },
  enviado: { css: 'button,a', re: '^Ver en el mapa$' },
  reportes: { css: '.rp-item', re: null },
  aviso: { css: '.confirm-si', re: null },
  riesgo: { css: '.rp-911', re: null },
}
const filas = []
for (const [n, motor, d] of D) {
  if (solo && !solo.includes(n)) continue
  if (!d) { console.log(n, 'sin perfil'); continue }
  const b = await motor.launch()
  const ctx = await b.newContext({ ...d, geolocation: { latitude: 20.6736, longitude: -103.344 }, permissions: ['geolocation'], locale: 'es-MX' })
  await ctx.addInitScript(() => { try { localStorage.setItem('aguas.onboarded', 'true'); localStorage.setItem('aguas.medio', '"auto"') } catch {} })
  await ctx.route('**/rpc/crear_reporte', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"x","estado":"pendiente"}' }))
  const ahora = Math.floor(Date.now() / 1000)
  await ctx.route('**/auth/v1/signup**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    access_token: 'x.eyJzdWIiOiJ1MSJ9.x', token_type: 'bearer', expires_in: 3600, expires_at: ahora + 3600, refresh_token: 'r',
    user: { id: 'u1', aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }) }))
  const cerca = [
    { id: 'c1', tipo: 'calle', gravedad: 'limitado', pasan_carros: false, lat: 20.675, lng: -103.345, distancia_m: 180, ultima_confirmacion: new Date().toISOString(), creado_en: new Date(Date.now() - 20 * 60e3).toISOString(), confirmaciones_si: 2, nivel: 'medio', estado: 'pendiente', es_propio: false },
    { id: 'c2', tipo: 'casa', gravedad: 'bloqueado', pasan_carros: false, lat: 20.676, lng: -103.342, distancia_m: 420, ultima_confirmacion: new Date().toISOString(), creado_en: new Date(Date.now() - 50 * 60e3).toISOString(), confirmaciones_si: 6, nivel: 'alto', estado: 'activo', es_propio: false },
  ]
  const p = await ctx.newPage(); const vp = d.viewport
  const t = (loc) => (d.hasTouch ? loc.tap({ timeout: 5000 }) : loc.click({ timeout: 5000 }))
  const vis = (re) => p.locator('button:visible,a:visible').filter({ hasText: re }).first()
  const reportar = () => t(p.locator('[aria-label="Reportar inundación"]:visible, .mp-report-inv:visible').first())
  const pestanaReportes = async () => {
    if (vp.width >= 1024) await p.setViewportSize({ width: 390, height: vp.height })
    try { await p.locator('.tab:visible').filter({ hasText: /^Reportes$/ }).first().click({ timeout: 4000 }) }
    finally { if (vp.width >= 1024) await p.setViewportSize(vp) }
  }
  const inicio = async () => {
    await p.goto(url + '/?prueba=1', { waitUntil: 'networkidle' })
    try { await t(vis(/^Más$/)); await t(vis(/Cargar escenario/)); await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(3500) }
    catch (e) { console.log(n, 'sin escenario:', e.message.split('\n')[0]) }
  }
  const r = { n, vp: `${vp.width}×${vp.height}` }
  const paso = async (k, fn) => {
    try {
      await fn(); await p.waitForTimeout(700)
      await p.screenshot({ path: `${out}/${n}-${k}.png` })
      const m = await medir(p, P[k]); r[k] = m
      if (m.principal !== 'visible' && m.principal !== 'n/a') await p.screenshot({ path: `${out}/${n}-${k}-abajo.png` })
    } catch (e) { r[k] = { error: e.message.split('\n')[0].slice(0, 80) } }
  }
  await inicio()
  await paso('tipo', () => reportar())
  await paso('cuanta', async () => { await t(p.locator('.rp-tiles .tile').first()); await p.locator('.rp-opt').nth(1).scrollIntoViewIfNeeded(); await t(p.locator('.rp-opt').nth(1)) })
  await paso('foto', async () => { const c = vis(/^Continuar$/); await c.scrollIntoViewIfNeeded(); await t(c) })
  await paso('enviado', async () => { const c = vis(/Enviar sin foto/); await c.scrollIntoViewIfNeeded(); await t(c); await p.waitForTimeout(1500) })
  await inicio()
  await paso('reportes', () => pestanaReportes())
  await ctx.route('**/rpc/reportes_cercanos', (rr) => rr.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cerca) }))
  await paso('aviso', async () => { await p.goto(url + '/?prueba=1', { waitUntil: 'networkidle' }); await p.locator('.confirm').first().waitFor({ timeout: 8000 }) })
  await ctx.unroute('**/rpc/reportes_cercanos')
  await inicio()
  await paso('riesgo', async () => { await reportar(); await t(p.locator('.rp-tiles .tile--risk').first()) })
  filas.push(r)
  const corto = Object.entries(r).filter(([k]) => P[k]).map(([k, m]) => {
    if (m.error) return `${k}:ERR(${m.error})`
    const mal = [m.desborde && 'desb:' + m.desborde, !/^(visible|n\/a|desplazando)$/.test(m.principal) && m.principal, m.scrollPagina && 'pagScroll:' + m.scrollPagina, m.partidos && 'partido:' + m.partidos].filter(Boolean)
    return `${k}:${mal.length ? mal.join(',') : 'ok' + (m.principal === 'desplazando' ? '(despl)' : '')}`
  })
  console.log(n, r.vp, corto.join('  '))
  await b.close()
}
