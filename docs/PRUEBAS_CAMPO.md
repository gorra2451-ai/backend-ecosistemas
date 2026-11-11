# Pruebas de campo — antes de cada entrega del front

> Origen: dos fallas reportadas por usuarios el 2026-11-11 que las pruebas unitarias no atraparon
> (voz con acento extranjero en iPhone y reporte colgado manejando con señal débil).
> Regla: **un número de la app sale de una medición, no de una suposición.** Si no se pudo medir, va como
> `POR CONFIRMAR` en `PREGUNTAS.md`.

## 1. Automático (navegador real contra el sitio publicado)

```bash
cd web/campo && npm i && npx playwright install chromium webkit
for m in webkit chromium; do for e in normal lento colgado todo_colgado offline sin_gps; do
  node escenario.mjs $m $e; done; done
```
WebKit = motor de Safari/iPhone (iPhone 13). Chromium = Chrome/Android (Pixel 7). `crear_reporte` se simula:
no se crean reportes reales.

| Escenario | Esperado | Medido 2026-11-11 (WebKit · Chromium) |
|---|---|---|
| normal | "Reporte enviado" en < 2 s | 0.7 s · 0.3 s |
| lento (servidor tarda 4 s) | "Reporte enviado" | 4.4 s · 4.1 s |
| colgado (servidor nunca responde) | "Reporte guardado · No hay señal" en ≤ 16 s y se reenvía solo | 15.5 s, reenvío 0.5 s · 15.5 s, reenvío 11.1 s |
| todo_colgado (sesión y servidor colgados) | igual que colgado | 15.5 s · 15.2 s |
| offline | se guarda al instante y se reenvía al volver la señal | 0.4 s · 0.0 s |
| sin_gps (permiso negado) | pide escribir la ubicación; no deja enviar sin ella | ✔ · ✔ |

## 2. En teléfono real (no se puede simular)

- [ ] **Voz:** activar "Leer en voz alta" en un iPhone y en un Android. Debe sonar con acento mexicano/latino
      (Paulina en iPhone, voz de Google en Android). Nunca Eddy, Flo, Grandma, Rocko ni portugués.
- [ ] **Movimiento:** con medio "Auto", de copiloto (nunca quien maneja): el aviso de confirmar debe ser solo
      de voz/lectura en marcha, y volver a permitir toques al detenerse.
- [ ] **Quieto:** con el teléfono en la mesa 2 min, la app no debe creer que vas en auto.
- [ ] **Señal real débil:** enviar un reporte en un sótano/estacionamiento: debe quedar "guardado" y salir solo
      al recuperar señal.
- [ ] **Permisos negados:** ubicación y micrófono negados → la app explica qué hacer, no se queda cargando.

## 3. Valores y de dónde salen

| Valor | Dónde | Base medida |
|---|---|---|
| Corte de red 15 s | `web/src/lib/red.js` | Servidor real: 0.23–0.42 s por petición (10 muestras, wifi). Peor caso de una conexión nueva en 3G lento (≈ 2 s de ida y vuelta × 4 viajes) ≈ 8 s. 15 s deja margen sin dejar a nadie esperando. |
| Reintento de cola 30 s | `web/src/screens/Reportar.jsx` | Con señal intermitente el navegador no avisa "volvió la red" (medido en Chromium: el reenvío llegó por el reintento, 11 s). |
| Margen de error del GPS | `velocidadDe` en `web/src/lib/confirmar.js` | Se usa la precisión que reporta el propio teléfono (`accuracy`), no un número fijo. |
| Vehículo en movimiento > 4 m/s (14 km/h) | `VEL_MOVIMIENTO_MS` | Solo aplica con medio auto/moto. **POR CONFIRMAR en carretera real** (ver §2). |
| Voz | `elegirVoz` en `web/src/lib/confirmar.js` | Lista real de voces de macOS/iOS (`say -v '?'`): la primera es-MX es "Eddy". |
