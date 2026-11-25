// Matriz de dispositivos para Bienvenida, ¿A quién acudo?, Refugios, Avisos, Preferencias, Monitoreo vial,
// Accesibilidad (daltonismo), Privacidad, Más y Buscar. Mide desbordes, botón principal alcanzable, brinco de página,
// encabezado de escritorio en una fila y palabras partidas. Uso: node matriz_ayuda.mjs <url> <carpeta>  (SOLO=fold-viejo,...)
import { webkit, chromium, devices } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
const [url = 'http://localhost:4177', out = 'capturas-matriz-ayuda'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const movil = (w, h, dpr = 3) => ({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true })
const tab = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const esc = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
const D = [
  ['ipad-11-real-horiz', webkit, tab(1180, 820)], ['ipad-11-real-vert', webkit, tab(820, 1180)], // Safari real del iPad (gen 10/11); el perfil de Playwright es 944×656
  ['ipad-11-horiz', webkit, devices['iPad (gen 11) landscape'] || tab(1180, 820)], ['ipad-11-vert', webkit, devices['iPad (gen 11)'] || tab(820, 1180)],
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

// Mide la pantalla visible (última .screen). primario: selector del botón principal que debe poder alcanzarse.
function medir(primario) {
  const W = innerWidth, H = innerHeight
  const s = [...document.querySelectorAll('.screen')].pop()
  const r = {}
  const fuera = []
  if (document.documentElement.scrollWidth > W + 1) fuera.push('doc ' + document.documentElement.scrollWidth)
  const raiz = s || document.body
  for (const e of raiz.querySelectorAll('*')) {
    const b = e.getBoundingClientRect()
    if (!b.width || e.closest('.leaflet-container')) continue
    const cs = getComputedStyle(e)
    if (cs.visibility === 'hidden' || cs.position === 'fixed') continue
    if (b.right > W + 1 || b.left < -1) fuera.push((e.className || e.tagName).toString().slice(0, 30) + ' ' + Math.round(b.left) + '–' + Math.round(b.right))
    if (fuera.length > 4) break
  }
  if (s && s.scrollWidth > s.clientWidth + 1) fuera.push('screen scrollW ' + s.scrollWidth + '/' + s.clientWidth)
  r.dx = fuera.length ? fuera.slice(0, 3).join(' | ') : 0
  // Palabras partidas a media palabra
  const rotas = new Set()
  const tw = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
  let n
  while ((n = tw.nextNode()) && rotas.size < 4) {
    const el = n.parentElement
    if (!el || !el.getClientRects().length || el.closest('.leaflet-container,svg')) continue
    const re = /[\p{L}\p{N}¿?¡!.,:]{5,}/gu
    let m
    while ((m = re.exec(n.data))) {
      const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length)
      const rs = [...rg.getClientRects()].filter((x) => x.width > 0)
      if (rs.length > 1 && Math.abs(rs[0].top - rs[rs.length - 1].top) > 2) rotas.add(m[0])
    }
  }
  r.rotas = rotas.size ? [...rotas].join(',') : 0
  // Botón principal alcanzable desplazando .screen y no tapado (barra inferior, etc.)
  if (s) s.scrollTop = s.scrollHeight
  const tb = document.querySelector('.tabbar')
  const tbTop = tb && getComputedStyle(tb).display !== 'none' ? tb.getBoundingClientRect().top : H
  const lim = Math.min(H, tbTop)
  if (primario) {
    const bt = [...raiz.querySelectorAll(primario)].filter((e) => e.getClientRects().length).pop()
    if (!bt) r.prim = 'no hay'
    else {
      const b = bt.getBoundingClientRect()
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2
      const hit = document.elementFromPoint(cx, cy)
      r.prim = b.bottom <= lim + 1 && b.top >= 0 && hit && (bt === hit || bt.contains(hit)) ? 'ok' : `NO (${Math.round(b.top)}–${Math.round(b.bottom)} lim ${Math.round(lim)} hit ${hit?.className?.toString().slice(0, 20)})`
    }
  }
  // Último contenido visible arriba de la barra inferior
  if (s) {
    const hijos = [...s.querySelectorAll('.screen-inner > *')].filter((e) => e.getClientRects().length && getComputedStyle(e).position !== 'fixed')
    const ult = hijos.reduce((a, e) => (e.getBoundingClientRect().bottom > (a?.getBoundingClientRect().bottom ?? -1) ? e : a), null)
    if (ult) { const bb = ult.getBoundingClientRect().bottom; r.fin = bb <= lim + 1 ? 'ok' : `TAPADO ${Math.round(bb)}>${Math.round(lim)}` }
    s.scrollTop = 0
  }
  r.st = document.scrollingElement.scrollTop + window.scrollY
  // Encabezado de escritorio en una fila
  const hd = document.querySelector('.desk-header')
  if (hd && getComputedStyle(hd).display !== 'none' && hd.getBoundingClientRect().height) {
    const bs = [...hd.querySelectorAll('.mp-nav button, .mp-head-a11y')].filter((e) => e.getClientRects().length)
    const tops = new Set(bs.map((e) => Math.round(e.getBoundingClientRect().top / 4)))
    const multi = bs.filter((e) => e.getClientRects().length > 1 || e.getBoundingClientRect().height > 60).map((e) => e.textContent)
    r.head = tops.size <= 1 && !multi.length && hd.scrollWidth <= hd.clientWidth + 1 ? 'ok' : `MAL filas=${tops.size} ${multi.join('/')} sw=${hd.scrollWidth}/${hd.clientWidth}`
  }
  return r
}

const filas = []
for (const [n, motor, d] of D) {
  if (solo && !solo.includes(n)) continue
  if (!d) { console.log(n, 'sin perfil'); continue }
  const vw = d.viewport.width
  const escr = vw >= 1024
  const b = await motor.launch()
  const nuevo = async (onboarded) => {
    const ctx = await b.newContext({ ...d, geolocation: { latitude: 20.6736, longitude: -103.344 }, permissions: ['geolocation'], locale: 'es-MX' })
    if (onboarded) await ctx.addInitScript(() => { localStorage.setItem('aguas.onboarded', 'true'); localStorage.setItem('aguas.medio', '"auto"') })
    const p = await ctx.newPage()
    await p.goto(url + '?prueba=1', { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
    return p
  }
  const t = async (loc) => (d.hasTouch ? loc.tap({ timeout: 5000 }) : loc.click({ timeout: 5000 }))
  const clic = (p, re, sel = 'button:visible,a:visible') => t(p.locator(sel).filter({ hasText: re }).first())
  const nav = async (p, txt) => escr ? t(p.locator('.desk-header button:visible').filter({ hasText: txt }).first()) : t(p.locator('.tabbar button').filter({ hasText: txt }).first())
  const reg = async (p, paso, prim) => {
    await p.waitForTimeout(600)
    await p.screenshot({ path: `${out}/${n}-${paso}.png` })
    const m = await p.evaluate(medir, prim)
    const r = { n, paso, ...m }
    filas.push(r)
    const malo = Object.entries(m).filter(([k, v]) => v && v !== 'ok' && v !== 0)
    console.log(n.padEnd(18), paso.padEnd(13), malo.length ? JSON.stringify(Object.fromEntries(malo)) : 'ok')
  }
  try {
    const p = await nuevo(false)
    await reg(p, 'onb1', '.btn-primary')
    await clic(p, /^Comenzar$/); await reg(p, 'onb2', '.btn-primary')
    await clic(p, /^Continuar$/); await reg(p, 'onb3', '.btn-primary')
    if (await p.locator('.onb-opt').count()) { await t(p.locator('.onb-opt').first()); await reg(p, 'onb3-sel', '.btn-primary') }
    await clic(p, /^Continuar$/); await reg(p, 'onb4', '.btn-primary')
    await p.context().close()
  } catch (e) { console.log(n, 'onb ERROR', e.message.split('\n')[0]) }
  const p = await nuevo(true)
  const pasos = [
    ['acudo', null, async () => nav(p, escr ? '¿A quién acudo?' : 'Ayuda')],
    ['acudo-resp', null, async () => t(p.locator('.ay-caso').nth(1))],
    ['refugios', null, async () => escr ? nav(p, 'Refugios') : (await nav(p, 'Ayuda'), await clic(p, /Ver refugios cercanos/))],
    ['avisos', null, async () => escr ? nav(p, 'Avisos') : (await nav(p, 'Más'), await clic(p, /Elegir de dónde quiero avisos/, '.screen button:visible'), await t(p.locator('.screen .btn-icon').first()))],
    ['monitoreo', null, async () => clic(p, /Ver cómo están las calles/)],
    ['preferencias', null, async () => (await nav(p, 'Más'), await clic(p, /Elegir de dónde quiero avisos/, '.screen button:visible'))],
    ['mas', null, async () => nav(p, 'Más')],
    ['privacidad', null, async () => (await nav(p, 'Más'), await clic(p, /Privacidad y permisos/))],
    ['buscar', null, async () => escr ? nav(p, 'Buscar') : (await nav(p, 'Mapa'), await t(p.locator('.mp-search:visible').first()))],
    ['ajustes', null, async () => escr ? t(p.locator('.desk-header .mp-head-a11y')) : (await nav(p, 'Más'), await clic(p, /Accesibilidad y apariencia/))],
  ]
  for (const [paso, prim, ir] of pasos) {
    try { await ir(); await reg(p, paso, prim) } catch (e) { console.log(n.padEnd(18), paso.padEnd(13), 'ERROR', e.message.split('\n')[0].slice(0, 100)) }
  }
  // Daltonismo desde Accesibilidad: cambia --ra, data-a11y y hay retroalimentación visible
  try {
    const sw = p.locator('.screen [role=switch]').filter({ hasText: 'Modo daltonismo' }).first()
    await sw.scrollIntoViewIfNeeded()
    const c0 = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ra').trim())
    await t(sw); await p.waitForTimeout(400)
    const c1 = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ra').trim())
    const a = await p.evaluate(() => document.documentElement.getAttribute('data-a11y') || '')
    const toast = await p.locator('.toast:visible').allTextContents().catch(() => [])
    await p.screenshot({ path: `${out}/${n}-ajustes-dalton.png` })
    const st = await p.evaluate(() => document.scrollingElement.scrollTop)
    console.log(n.padEnd(18), 'dalton'.padEnd(13), c0 !== c1 && a.includes('dalton') ? `ok ${c0}→${c1}` : `NO CAMBIA ${c0}/${c1} a11y=${a}`, 'aviso:', toast.join(' | ') || 'NINGUNO', 'st', st)
    filas.push({ n, paso: 'dalton', c0, c1, a, toast: toast.join('|'), st })
    await t(sw)
  } catch (e) { console.log(n, 'dalton ERROR', e.message.split('\n')[0]) }
  await b.close()
}
writeFileSync(`${out}/resultado.json`, JSON.stringify(filas, null, 1))
