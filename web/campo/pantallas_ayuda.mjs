// Capturas de Bienvenida (4 pasos), ¿A quién acudo?, Refugios, Avisos, Preferencias, Accesibilidad,
// Monitoreo vial y Privacidad y permisos en tamaños reales de escritorio y celular.
// Uso: node pantallas_ayuda.mjs <url> <carpeta_salida>   (SOLO=mac-1440,iphone-se para limitar)
import { chromium, webkit, devices } from 'playwright'
import { mkdirSync } from 'node:fs'
const [url = 'http://localhost:4175', out = 'capturas-ayuda'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const tam = [
  ['mac-1440', chromium, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
  ['mac-1512', webkit, { viewport: { width: 1512, height: 982 }, deviceScaleFactor: 2 }],
  ['win-1366', chromium, { viewport: { width: 1366, height: 768 } }],
  ['win-1536', chromium, { viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25 }],
  ['monitor-1920', chromium, { viewport: { width: 1920, height: 1080 } }],
  ['iphone-se', webkit, devices['iPhone SE']],
  ['iphone', webkit, devices['iPhone 13']],
  ['iphone-max', webkit, devices['iPhone 14 Pro Max']],
  ['pixel', chromium, devices['Pixel 7']],
]
const solo = process.env.SOLO ? process.env.SOLO.split(',') : null
const u = url + (url.includes('?') ? '&' : '?') + 'prueba=1'
for (const [nombre, motor, disp] of tam) {
  if (solo && !solo.includes(nombre)) continue
  const esc = (disp.viewport?.width || 0) >= 1024
  const b = await motor.launch()
  const nuevo = async (onboarded) => {
    const ctx = await b.newContext({ ...disp, geolocation: { latitude: 20.6736, longitude: -103.344 }, permissions: ['geolocation'], locale: 'es-MX' })
    if (onboarded) await ctx.addInitScript(() => { localStorage.setItem('aguas.onboarded', 'true'); localStorage.setItem('aguas.medio', '"auto"') })
    const p = await ctx.newPage()
    await p.goto(u, { waitUntil: 'networkidle' })
    return p
  }
  const foto = async (p, paso, abajo = true) => {
    await p.waitForTimeout(700)
    await p.screenshot({ path: `${out}/${nombre}-${paso}.png` })
    if (!abajo) return
    const mas = await p.evaluate(() => { const s = [...document.querySelectorAll('.screen')].pop(); if (!s || s.scrollHeight <= s.clientHeight + 4) return false; s.scrollTop = s.scrollHeight; return true })
    if (mas) { await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${nombre}-${paso}-abajo.png` }) }
  }
  const clic = (p, re, sel = 'button:visible,a:visible') => p.locator(sel).filter({ hasText: re }).first().click({ timeout: 5000 })
  const nav = async (p, txt) => {
    if (esc) await p.locator('.desk-header button:visible').filter({ hasText: txt }).first().click({ timeout: 5000 })
    else await p.locator('.tabbar button').filter({ hasText: txt }).first().click({ timeout: 5000 })
  }
  // Bienvenida
  try {
    const p = await nuevo(false)
    await foto(p, 'onb1')
    await clic(p, /^Comenzar$/); await foto(p, 'onb2')
    await clic(p, /^Continuar$/); await p.locator('.onb-opt').first().click(); await foto(p, 'onb3')
    await clic(p, /^Continuar$/); await foto(p, 'onb4')
    await p.context().close()
  } catch (e) { console.log(nombre, 'onb:', e.message.split('\n')[0]) }
  const p = await nuevo(true)
  const pasos = [
    ['acudo', async () => nav(p, esc ? '¿A quién acudo?' : 'Ayuda')],
    ['acudo-resp', async () => p.locator('.ay-caso').nth(1).click()],
    ['refugios', async () => esc ? nav(p, 'Refugios') : (await nav(p, 'Ayuda'), await clic(p, /Ver refugios cercanos/))],
    ['avisos', async () => esc ? nav(p, 'Avisos') : (await nav(p, 'Más'), await clic(p, /Elegir de dónde quiero avisos/, '.screen button:visible'), await p.locator('.screen .btn-icon').first().click())],
    ['monitoreo', async () => clic(p, /Ver cómo están las calles/)],
    ['preferencias', async () => (await nav(p, 'Más'), await clic(p, /Elegir de dónde quiero avisos/, '.screen button:visible'))],
    ['ajustes', async () => esc ? p.locator('.desk-header button').filter({ hasText: 'Accesibilidad' }).click() : (await nav(p, 'Más'), await clic(p, /Accesibilidad y apariencia/))],
    ['privacidad', async () => (await nav(p, 'Más'), await clic(p, /Privacidad y permisos/))],
  ]
  for (const [paso, ir] of pasos) {
    try { await ir(); await foto(p, paso) } catch (e) { console.log(nombre, paso + ':', e.message.split('\n')[0]) }
  }
  await b.close()
}
