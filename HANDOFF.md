# HANDOFF — Estado actual
> Foto corta para retomar en una sesión nueva. Máx. ~60 líneas. Se reescribe al cerrar cada sesión.

**Última actualización:** 2026-11-10 21:00 · Diego (con Claude Code)
**Fase actual:** F5-T3, mid-fi desplegado en la nube (falta humo en celulares)
**Meta:** mid-fi de ¡Aguas! el 2026-11-11 a las 12:00. La maestra manda la liga a personas distintas,
repartidas por la ZMG → la liga va con **`?prueba=1`**: https://aguas-zmg.netlify.app/?prueba=1
**Rama activa:** `fix/f5-t3-endurecer-seguridad-midfi` (D-024: banderas 6, throttle Realtime, cabeceras/CSP).
Tras aprobación de Leo: `db push` (1 migración) → probar-nube → deploy.

## Dónde quedamos
- Nube al día: `db push` de 7 migraciones (v2 + D-022 + D-023); `probar-nube.sh` 12/12; Auth anónima OK.
- Parámetros mid-fi en la nube (D-022, TEMPORAL): radio 40000, ventana 1440, expiración 180, 5 confirmaciones.
- Netlify prod con el front unificado (vitest 209/209, build OK). Humo de solo lectura en Chrome sin errores.
- La nube tenía **0 reportes** al desplegar (21:00): todo lo que aparezca antes de las 12:00 es del humo.

## Siguiente paso (en este orden)
1. Humo con 2 celulares: liga con `?prueba=1` → reportar en uno → confirmar desde Reportes → "Cerca de ti" en el
   otro. Probar voz con micrófono real, Safari iPhone (colores de zonas) y Realtime.
2. Moderación en vivo (D-024): vigilar `en_revision` y `persona_en_riesgo` con `supabase db query --linked`.
3. Antes de las 12:00: borrar los reportes del humo (`supabase db query --linked`, con aprobación de Diego).
4. Después del testeo: **revertir D-022 y D-024** (nueva migración 1000/60/30; `0000_base` a 30; quitar bloque D-022 de
   `0200_confirmacion` y `1800_validado_equipos`).
5. Limpiar `web/.vite/` del repo + `.gitignore`; borrar rama `feat/f5-t3-web-voz` (ya integrada).
6. Panel de admin desde `admin.html` (sin métricas inventadas) y los DUPLICADOS de abajo.

## Decisiones abiertas de Diego
- Nivel de zona sale de confirmaciones (D-021): quien reporta "Medio" ve "Bajo". Confunde.
- Front con números fijos (5/10/15/20, `MIN_ATENUAR=60`): leerlos de `parametros` antes de bajar el 5.
- "Mis avisos" por municipio promete zona nueva/despejada/cierres; solo entrega lluvia fuerte.
- Municipio dice "detectado" y nunca se detecta. Botón "Escuchar" solo en móvil.
- Después del mid-fi: tocar el mapa para elegir punto (pedido de Leo); limpiar metadatos de video para reactivarlo.

## DUPLICADOS para decidir (cuál se queda)
- Permisos: Registro paso 3 · Avisos→Preferencias · ubicación del Mapa. Accesibilidad: Registro paso 4 · Ajustes.
- Medio de transporte: Registro · Monitoreo vial (Avisos) · Más (Mapa).
- Listas de cercanos: "Lo cercano" · "Reportes de otros vecinos" · "Vías cercanas" · tarjeta "cerca de ti".
- Seguimiento de mi reporte: sondeo en Confirmación · Mis reportes / Mi reporte. 911: pantalla `riesgo` · Detalles.
- Ayuda: pestaña "Ayuda" · "¿A quién acudo?" del Mapa. `alertas` vs "Todas las alertas". Rutas alternativas ×3.
- Código: "hace X" ×3, distancia ×2, `hablar()` ×2, `elegirCercano` vs `reporteParaConfirmar`, `HojaEnviado` muerto.

## Abiertos que cambian contrato
- `solo_fuertes` no avisa si una zona escala. P-34: fuente oficial del 071 de CFE. Push: VAPID/Vault sin configurar.

## No olvidar
- `bash scripts/sync.sh` al iniciar; git solo con `scripts/` (sin trailers de co-autor).
- Pruebas: `supabase db reset && supabase test db`; front: `cd web && npm run build && npx vitest run`.
- Front contra local: `VITE_SUPABASE_URL=http://127.0.0.1:55421 VITE_SUPABASE_KEY=<publishable local> npx vite`.
- `?demo=1` = botón "Probar aviso de confirmación"; `?prueba=1` = modo prueba (`?prueba=0` lo apaga).
- Nunca `supabase config push`. Diseño: https://claude.ai/artifact/AyPk2ZURShcyQLpP6gVKGk
