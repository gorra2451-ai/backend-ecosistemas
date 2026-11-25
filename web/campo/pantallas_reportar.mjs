// Capturas del flujo Reportar / Reportes / 911 / "¿Sigue inundado?" en tamaños reales (escritorio y celular).
// Uso: node pantallas_reportar.mjs <url> <carpeta_salida>   (SOLO=mac-1440,iphone-se para limitar)
// No crea reportes reales: /rpc/crear_reporte se simula con 200.
import { chromium, webkit, devices } from 'playwright'
import { mkdirSync } from 'node:fs'
const [url = 'http://localhost:4174', out = 'capturas-reportar'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const tam = [
  ['mac-1440', chromium, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
  ['mac-1512', webkit, { viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 }],
  ['win-1366', chromium, { viewport: { width: 1366, height: 768 } }],
  ['win-1536', chromium, { viewport: { width: 1536, height: 864 } }],
  ['monitor-1920', chromium, { viewport: { width: 1920, height: 1080 } }],
  ['iphone', webkit, devices['iPhone 13']],
  ['iphone-se', webkit, devices['iPhone SE']],
  ['iphone-max', webkit, devices['iPhone 14 Pro Max']],
  ['pixel', chromium, devices['Pixel 7']],
]
const solo = process.env.SOLO ? process.env.SOLO.split(',') : null
const vis = (p, re) => p.locator('button:visible,a:visible').filter({ hasText: re }).first()
// Botón de reportar: "+" de la barra (celular) o "Reportar" del panel lateral (escritorio).
const reportar = (p) => p.locator('[aria-label="Reportar inundación"]:visible, .mp-report-inv:visible').first().click({ timeout: 4000 })
// La pestaña Reportes solo existe en la barra móvil: en escritorio se encoge la ventana un momento para abrirla.
const pestanaReportes = async (p, disp) => {
  const vp = disp.viewport
  if (vp.width >= 1024) await p.setViewportSize({ width: 390, height: vp.height })
  try { await p.locator('.tab:visible').filter({ hasText: /^Reportes$/ }).first().click({ timeout: 4000 }) }
  finally { if (vp.width >= 1024) await p.setViewportSize(vp) }
}
const alFondo = (p) => p.evaluate(() => {
  [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(e).overflowY))
    .filter((e) => !e.closest('.desk-sidebar,.leaflet-container')).forEach((e) => { e.scrollTop = e.scrollHeight })
})
for (const [nombre, motor, disp] of tam) {
  if (solo && !solo.includes(nombre)) continue
  const b = await motor.launch()
  const ctx = await b.newContext({ ...disp, geolocation: { latitude: 20.6736, longitude: -103.344 }, permissions: ['geolocation'], locale: 'es-MX' })
  await ctx.addInitScript(() => { try { localStorage.setItem('aguas.onboarded', 'true'); localStorage.setItem('aguas.medio', '"auto"') } catch {} })
  await ctx.route('**/rpc/crear_reporte', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"x","estado":"pendiente"}' }))
  // Sesión anónima y reportes cercanos simulados (no se toca la nube)
  const ahora = Math.floor(Date.now() / 1000)
  await ctx.route('**/auth/v1/signup**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    access_token: 'x.eyJzdWIiOiJ1MSJ9.x', token_type: 'bearer', expires_in: 3600, expires_at: ahora + 3600, refresh_token: 'r',
    user: { id: 'u1', aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }) }))
  const cerca = [
    { id: 'c1', tipo: 'calle', gravedad: 'limitado', pasan_carros: false, lat: 20.675, lng: -103.345, distancia_m: 180, ultima_confirmacion: new Date().toISOString(), creado_en: new Date(Date.now() - 20 * 60e3).toISOString(), confirmaciones_si: 2, nivel: 'medio', estado: 'pendiente', es_propio: false },
    { id: 'c2', tipo: 'casa', gravedad: 'bloqueado', pasan_carros: false, lat: 20.676, lng: -103.342, distancia_m: 420, ultima_confirmacion: new Date().toISOString(), creado_en: new Date(Date.now() - 50 * 60e3).toISOString(), confirmaciones_si: 6, nivel: 'alto', estado: 'activo', es_propio: false },
  ]
  const p = await ctx.newPage()
  const foto = async (paso) => { await p.waitForTimeout(700); await p.screenshot({ path: `${out}/${nombre}-${paso}.png` }) }
  const paso = async (n, fn) => { try { await fn(); await foto(n) } catch (e) { console.log(nombre, n, 'falló:', e.message.split('\n')[0]) } }
  // Inicio limpio + escenario de prueba (pines cercanos) para "Cerca de ti" y el aviso "¿Sigue inundado?"
  const inicio = async () => {
    await p.goto(url + '/?prueba=1', { waitUntil: 'networkidle' })
    try {
      await vis(p, /^Más$/).click({ timeout: 4000 })
      await vis(p, /Cargar escenario/).click({ timeout: 4000 })
      await p.keyboard.press('Escape').catch(() => {})
      await p.waitForTimeout(3500) // que se vaya el aviso "Datos de práctica cargados"
    } catch (e) { console.log(nombre, 'sin escenario:', e.message.split('\n')[0]) }
  }
  await inicio()
  await paso('1-tipo', () => reportar(p))
  await paso('2-cuanta', async () => { await p.locator('.rp-tiles .tile').first().click({ timeout: 4000 }); await p.locator('.rp-opt').nth(1).click({ timeout: 4000 }) })
  await paso('2b-cuanta-abajo', () => alFondo(p))
  await paso('3-foto', () => vis(p, /^Continuar$/).click({ timeout: 4000 }))
  await paso('4-enviado', async () => { await vis(p, /Enviar sin foto/).click({ timeout: 4000 }); await p.waitForTimeout(1500) })
  await paso('4b-enviado-abajo', () => alFondo(p))
  await inicio()
  await paso('5-reportes', () => pestanaReportes(p, disp))
  await paso('5b-reportes-abajo', () => alFondo(p))
  await paso('6-mireporte', () => p.locator('.rp-item:visible').first().click({ timeout: 4000 }))
  // Con reportes de otros vecinos cerca: el aviso sale solo (DetectorCercanos) y también desde la lista
  await ctx.route('**/rpc/reportes_cercanos', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cerca) }))
  await paso('7-aviso-solo', async () => { await p.goto(url + '/?prueba=1', { waitUntil: 'networkidle' }); await p.locator('.confirm').first().waitFor({ timeout: 8000 }) })
  await paso('7b-aviso-abajo', () => p.evaluate(() => { const c = document.querySelector('.cf-card'); if (c) c.scrollTop = c.scrollHeight }))
  await paso('7c-sigue', async () => {
    await p.keyboard.press('Escape').catch(() => {})
    await p.locator('.confirm-link:visible').filter({ hasText: /Omitir|Volver|Cerrar/ }).first().click({ timeout: 3000 }).catch(() => {})
    await pestanaReportes(p, disp)
    await p.locator('.rp-item[aria-label*="Confirmar si sigue"]:visible').first().click({ timeout: 4000 })
    await p.locator('.confirm').first().waitFor({ timeout: 4000 })
  })
  await ctx.unroute('**/rpc/reportes_cercanos')
  await inicio()
  await paso('8-riesgo', async () => {
    await reportar(p)
    await p.locator('.rp-tiles .tile--risk').first().click({ timeout: 4000 })
  })
  await paso('8b-riesgo-abajo', () => alFondo(p))
  await b.close()
}
