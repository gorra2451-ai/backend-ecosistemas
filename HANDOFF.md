# HANDOFF — Estado actual
> Foto corta para retomar en una sesión nueva. Máx. ~60 líneas. Se reescribe al cerrar cada sesión.

**Última actualización:** 2026-11-10 noche · Diego (con Claude Code)
**Fase actual:** F5-T3, integración del front unificado y backend v2 para el mid-fi (local listo, falta la nube)
**Meta:** mid-fi de ¡Aguas! el 2026-11-11 a las 12:00. La maestra manda la liga a personas distintas,
repartidas por la ZMG → la liga va con **`?prueba=1`**: https://aguas-zmg.netlify.app/?prueba=1
**Rama activa:** `feat/f5-t3-front-midfi-web` → PR #14 (front + v2 + D-022 + D-023 + voz). Leo pidió cambios; ya
están hechos → falta su nueva aprobación. Auth anónima en la nube: **activa** (verificado). `feat/f5-t3-web-voz` ya está
integrada en el PR #14 (se puede borrar).

## Dónde quedamos
- Recorrido local completo en Chrome (escritorio + móvil 390 px, claro/oscuro/contraste): registro → reportar →
  5 confirmaciones → zona activa en el mapa por Realtime. ~20 bugs corregidos (ver PROGRESO 2026-11-10 noche).
- Modo prueba `?prueba=1` (D-022): "Cerca de ti" lista toda la ZMG y se confirma sin estar cerca.
- Migración TEMPORAL `20261110192439_parametros_midfi` (D-022): radio 40000, ventana 1440, expiración 180;
  `confirmaciones_para_publicar` sigue en 5. Local: `supabase test db` 465/465 · vitest 143/143 · build OK.
- Revisión de Leo atendida (D-023): sin GPS del dispositivo a Nominatim (buscar solo con botón), sin video (bucket
  solo imágenes), plazo de confirmación validado bajo bloqueo. Voz: "Modo voz" lee zonas ≤ 400 m + "Escuchar";
  "Reportar con voz" llena tipo y gravedad (envío manual). Probado con reconocedor simulado, falta micrófono real.
- Local: pgTAP 481/481 · vitest 194/194 · build OK. **Nada está en la nube todavía** (Netlify con ronda 1).

## Siguiente paso (en este orden)
1. LeoFigo74z aprueba PR #14 desde SU cuenta (prompt que le mandó Diego).
2. `gh pr merge 14 --merge` → `git checkout main && git pull` → `supabase db push` (5 migraciones)
   → `bash scripts/probar-nube.sh`.
4. `cd web && npm run build && netlify deploy --prod --dir dist --site c8abb1d6-9180-4a14-9de8-9ee8894045be --no-build`.
5. Humo en la nube con 2 celulares: liga con `?prueba=1` → reportar en uno → confirmar desde Reportes → "Cerca de ti"
   en el otro. Probar Safari iPhone (colores de zonas) y Realtime.
6. Después del testeo: **revertir D-022** (nueva migración 1000/60/30; `0000_base` a 30; quitar bloque D-022 de
   `0200_confirmacion` y `1800_validado_equipos`).
7. Panel de admin desde `admin.html` (sin métricas inventadas) y los DUPLICADOS de abajo.

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
