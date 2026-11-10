# HANDOFF — Estado actual
> Foto corta para retomar en una sesión nueva. Máx. ~60 líneas. Se reescribe al cerrar cada sesión.

**Última actualización:** 2026-11-10 tarde · Diego (con Claude Code)
**Meta:** mid-fi de ¡Aguas! el 2026-11-11 a las 12:00 (liga para que los equipos testeen)
**Rama activa:** `feat/f5-t3-front-midfi-web` → PR #14 (front `web/` + backend v2). `main` tiene PR #12 y #13.

## Dónde quedamos
- **Manda lo validado por los equipos (D-021).** Material en `../06_Prototipos_Equipos/` (5 equipos + `admin.html`).
- Backend v2 local: 4 migraciones `20261110000000..000300`, `supabase test db` 461/461. **No está en la nube.**
- Front: 5 módulos con los flujos de los equipos y el look del design system; 115/115 vitest; en navegador
  solo se probó la ronda 1. Netlify (`aguas-zmg`) sigue con la ronda 1.
- Auth anónima remota: aceptada solo para los testeos (D-019) pero **aún apagada**.

## Siguiente paso (en este orden)
1. LeoFigo74z aprueba PR #14 desde SU cuenta → merge (`gh pr merge 14 --merge`).
2. Desde `main`: `supabase db push` (4 migraciones) → `bash scripts/probar-nube.sh`.
3. Diego enciende Auth anónima (Dashboard → Sign In/Providers) y límite 30/h por IP.
4. `cd web && npm run build && netlify deploy --prod --dir dist --site c8abb1d6-9180-4a14-9de8-9ee8894045be --no-build`.
5. Recorrer la liga en móvil y escritorio, temas claro/oscuro/contraste: reportar → 5 confirmaciones → mapa.
6. Panel de administración desde `admin.html` (reportes, zona, estadísticas, participación, inteligencia,
   config, CSV) con RPC de admin + migración de estadísticas solo-admin. Sin métricas inventadas
   (tiempo de respuesta, evacuados, afectados, "enviado al 911").
7. Diego decide los DUPLICADOS de abajo y se eliminan.

## DUPLICADOS para decidir (cuál se queda)
- Permisos: Registro paso 3 · Avisos→Preferencias (activar push) · ubicación del Mapa.
- Accesibilidad: Registro paso 4 · Ajustes (Avisos).
- Medio de transporte: Registro "medio de hoy" · Monitoreo vial Manejo/Camino/Camión (Avisos) · Más (Mapa).
- Listas de cercanos: "Lo cercano" (Mapa) · "Reportes de otros vecinos" (Mis reportes) · "Vías cercanas"
  (Avisos) · tarjeta "cerca de ti" (Mapa/Inicio).
- Seguimiento de mi reporte: sondeo en Confirmación · Mis reportes / Mi reporte.
- 911: pantalla roja `riesgo` · aviso 911 dentro de Detalles (HTML del equipo).
- Ayuda: pestaña "Ayuda"/"Me pasó algo" · "¿A quién acudo?" del Mapa. Pantalla `alertas` (Avisos) vs
  "Todas las alertas" (hoja del Mapa).
- Rutas alternativas: Inicio · detalle de zona · ¿Puedo pasar?
- `Inicio` ya no está en la barra (Mapa·Reportes·Ayuda, HTML del equipo): solo aparece tras el registro.
- Código: "hace X" ×3, distancia ×2, link de ruta ×2, texto de nivel ×2, `hablar()` ×2,
  `elegirCercano` vs `reporteParaConfirmar`; `HojaEnviado` muerto; `MUNICIPIOS_ZMG` sin uso.

## Abiertos que cambian contrato
- `solo_fuertes` no avisa si una zona sube de bajo a alto (no hay aviso de "escaló").
- P-34: fuente oficial del 071 de CFE. Push: Edge Functions, VAPID y Vault sin configurar en la nube.

## No olvidar
- `bash scripts/sync.sh` al iniciar; git solo con `scripts/` (sin trailers de co-autor).
- Pruebas: `supabase db reset && supabase test db`; front: `cd web && npm run build && npx vitest run`.
- Supabase local con API: `supabase start -x studio,imgproxy,inbucket,analytics,vector,pooler,edge-runtime`;
  front contra local: `VITE_SUPABASE_URL=http://127.0.0.1:55421 VITE_SUPABASE_KEY=<publishable local> npx vite`.
- `?demo=1` en la liga muestra "Probar aviso de confirmación". Nunca `supabase config push`.
- Diseño: canvas https://claude.ai/artifact/AyPk2ZURShcyQLpP6gVKGk (tokens en `web/src/styles/tokens.css`).
