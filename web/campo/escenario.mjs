// Pruebas de campo (docs/PRUEBAS_CAMPO.md). crear_reporte se simula: no crea reportes reales en la nube.
// Uso: cd web/campo && npm i && npx playwright install chromium webkit && node escenario.mjs <webkit|chromium> <normal|lento|colgado|todo_colgado|offline|sin_gps>
import { webkit, chromium, devices } from 'playwright'
const [motor, esc] = process.argv.slice(2)
const b = await (motor === 'webkit' ? webkit : chromium).launch()
const disp = motor === 'webkit' ? devices['iPhone 13'] : devices['Pixel 7']
const ctx = await b.newContext({ ...disp, geolocation: { latitude: 20.6736, longitude: -103.344 }, permissions: esc === 'sin_gps' ? [] : ['geolocation'], locale: 'es-MX' })
await ctx.addInitScript(() => { localStorage.setItem('aguas.onboarded', 'true'); localStorage.setItem('aguas.medio', '"auto"') })
const p = await ctx.newPage()
let modo = esc
const ok = (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"x","estado":"pendiente"}' })
await p.route('**/rpc/crear_reporte', async (r) => {
  if (modo === 'colgado' || modo === 'todo_colgado') return // nunca responde
  if (modo === 'lento') await new Promise((s) => setTimeout(s, 4000))
  return ok(r)
})
await p.goto('https://aguas-zmg.netlify.app', { waitUntil: 'networkidle' })
if (esc === 'todo_colgado') await p.route('**/*.supabase.co/**', (r) => { if (!r.request().url().includes('crear_reporte')) return }) // auth y todo lo demás también colgado
const texto = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
const clic = async (sel) => (sel.startsWith('css=') ? p.locator(sel.slice(4)) : p.locator('button:visible,label:visible').filter({ hasText: new RegExp(sel, 'i') })).first().click({ timeout: 8000 })
await clic("css=[aria-label='Reportar inundación']"); await clic('^Calle'); await clic('^Medio')
await p.waitForTimeout(esc === 'sin_gps' ? 14000 : 1500)
if (esc === 'sin_gps') { const t = await texto(); console.log(motor, esc, '| detalles:', (t.match(/(No tenemos tu ubicación[^.]*\.|Buscando tu ubicación…|Tu ubicación[^·]{0,40})/) || ['?'])[0], '| continuar habilitado:', await p.locator('button:visible').filter({ hasText: /Continuar/ }).first().isEnabled().catch(() => 'no hay')); await b.close(); process.exit() }
await clic('Continuar')
if (esc === 'offline') await ctx.setOffline(true)
const t0 = Date.now()
await clic('Enviar sin foto')
let fin = null
while (Date.now() - t0 < 45000) {
  const t = await texto()
  if (!/Enviando tu reporte/.test(t)) { fin = t; break }
  await p.waitForTimeout(250)
}
const seg = ((Date.now() - t0) / 1000).toFixed(1)
const res = !fin ? 'SIGUE EN "Enviando…" a los 45 s' : (fin.match(/(No hay señal|se envía sola|Algo salió mal|Reporte enviado|Recibimos|Gracias|enviado|en la cola|Sin señal)[^.]{0,60}/i) || [fin.slice(0, 120)])[0]
console.log(motor, esc, `| ${seg} s →`, res)
if (esc === 'colgado' || esc === 'todo_colgado' || esc === 'offline') {
  modo = 'normal'; await p.unroute('**/*.supabase.co/**').catch(() => {}); await ctx.setOffline(false)
  const t1 = Date.now(); let reenviado = false
  while (Date.now() - t1 < 40000) { if (/Volvió la señal/.test(await texto())) { reenviado = true; break } await p.waitForTimeout(500) }
  console.log(motor, esc, '| cola al volver la señal:', reenviado ? `se reenvió sola en ${((Date.now() - t1) / 1000).toFixed(1)} s` : 'NO se reenvió en 40 s')
}
await b.close()
