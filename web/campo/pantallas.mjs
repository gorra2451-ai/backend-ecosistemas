// Capturas en tamaños reales (escritorio y celular) para revisar el diseño antes de una presentación.
// Uso: node pantallas.mjs <url> <carpeta_salida>
// Tamaños: Mac 13–14" (1440×900 y 1512×982), Windows laptop (1366×768, 1536×864 a 125 %), monitor 1920×1080,
// iPhone 13 (WebKit) y Pixel 7 (Chromium).
import { chromium, webkit, devices } from 'playwright'
import { mkdirSync } from 'node:fs'
const [url = 'https://aguas-zmg.netlify.app', out = 'capturas'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const tam = [
  ['mac-1440', chromium, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
  ['mac-1512', webkit, { viewport: { width: 1512, height: 982 }, deviceScaleFactor: 2 }],
  ['win-1366', chromium, { viewport: { width: 1366, height: 768 } }],
  ['win-1536', chromium, { viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25 }],
  ['monitor-1920', chromium, { viewport: { width: 1920, height: 1080 } }],
  ['iphone', webkit, devices['iPhone 13']],
  ['iphone-se', webkit, devices['iPhone SE']],
  ['iphone-max', webkit, devices['iPhone 14 Pro Max']],
  ['pixel', chromium, devices['Pixel 7']],
]
const solo = process.env.SOLO ? process.env.SOLO.split(',') : null
for (const [nombre, motor, disp] of tam) {
  if (solo && !solo.includes(nombre)) continue
  const b = await motor.launch()
  const ctx = await b.newContext({ ...disp, geolocation: { latitude: 20.6736, longitude: -103.344 }, permissions: ['geolocation'], locale: 'es-MX' })
  await ctx.addInitScript(() => { localStorage.setItem('aguas.onboarded', 'true'); localStorage.setItem('aguas.medio', '"auto"') })
  const p = await ctx.newPage()
  const foto = async (paso) => { await p.waitForTimeout(1200); await p.screenshot({ path: `${out}/${nombre}-${paso}.png` }) }
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'prueba=1', { waitUntil: 'networkidle' })
  await foto('1-mapa')
  // Escenario de prueba con pines (Más → Simulaciones)
  try {
    await p.locator('button:visible,a:visible').filter({ hasText: /^Más$/ }).first().click({ timeout: 4000 })
    await p.locator('button:visible').filter({ hasText: /Cargar escenario/ }).first().click({ timeout: 4000 })
    await p.keyboard.press('Escape').catch(() => {})
    await p.locator('button:visible,a:visible').filter({ hasText: /^Mapa$/ }).first().click({ timeout: 4000 }).catch(() => {})
    await foto('2-pines')
  } catch (e) { console.log(nombre, 'sin escenario:', e.message.split('\n')[0]) }
  // Ruta a Plaza del Sol
  try {
    await p.locator('button:visible').filter({ hasText: /Buscar dirección/ }).first().click({ timeout: 4000 })
    await p.getByText('Plaza del Sol', { exact: true }).first().click({ timeout: 6000 }) // atajo
    await p.getByText(/Centro comercial/).first().click({ timeout: 8000 })
    await p.locator('button:visible').filter({ hasText: /^Cómo llegar/ }).first().click({ timeout: 6000 })
    await p.waitForTimeout(3000)
    await p.locator('button:visible').filter({ hasText: /Ver ruta en el mapa/ }).first().click({ timeout: 6000 })
    await foto('3-ruta')
  } catch (e) { console.log(nombre, 'sin ruta:', e.message.split('\n')[0]) }
  // Alejar al máximo (rueda del mouse / botón −)
  try { const caja = await p.locator('.leaflet-container').boundingBox()
  await p.mouse.move(caja.x + caja.width * 0.6, caja.y + caja.height * 0.6)
  for (let i = 0; i < 25; i++) { await p.mouse.wheel(0, 400); await p.waitForTimeout(60) } } catch { for (let i = 0; i < 18; i++) await p.locator("[aria-label=\"Alejar el mapa\"]").first().click({ timeout: 2000 }).catch(() => {}) } // trackpad o botón −
  await foto('4-alejado')
  const z = await p.evaluate(() => [...document.querySelectorAll('.leaflet-tile')].map((t) => +t.src.split('/').slice(-3)[0])[0])
  console.log(nombre, 'zoom de las teselas al alejar al máximo:', z)
  await b.close()
}
