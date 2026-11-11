# HANDOFF — Estado actual
> Foto corta para retomar en una sesión nueva. Máx. ~60 líneas. Se reescribe al cerrar cada sesión.

**Última actualización:** 2026-11-11 11:20 · Diego (con Claude Code)
**Fase actual:** F5-T3, mid-fi ENVIADO a testers (testeo 2026-11-11 12:00)
**Liga del testeo:** https://aguas-zmg.netlify.app/?prueba=1 (main `a708f16` desplegado en Netlify prod)
**Rama activa:** ninguna (todo en `main`). Merge a main: Diego, por PR con checks verdes (D-025).

## Dónde quedamos
- Prod con D-026…D-031: hoja arrastrable, atrás dentro de la app, vibración (Android; iOS 18+ con truco), pines por
  tipo con aro de nivel, escala única por altura del agua (solo front), barra píldora con "+", 911 a pantalla
  completa, rutas dentro de la app (OSRM de OSM, origen redondeado ~100 m), simulaciones en Más (modo prueba).
- Nube: migraciones al día (incl. `banderas_midfi` = 6 y `accesibilidad_vibracion`); `probar-nube.sh` 12/12.
- **Semilla del testeo:** 9 reportes activos con prefijo `5eed` (todos los tipos/niveles), vencen 14:07. El humo de
  Diego ya se borró. Todo reporte que NO empiece con `5eed` es de un tester.

## Siguiente paso (en este orden)
1. Durante el testeo (si Diego lo pide): vigilar `en_revision` y `persona_en_riesgo` nuevos con
   `supabase db query --linked`; restaurar/ocultar solo con OK de Diego.
2. Al terminar el testeo: borrar semilla → `delete from auth.users where id::text like '5eed0000-%'` (cascada a
   reportes y confirmaciones). Preguntar a Diego qué hacer con los reportes de testers.
3. Recoger feedback del testeo (voz en iPhone: modelo + versión de iOS si no sonó).
4. Revertir D-022 y D-024 (nueva migración: 1000/60/30 y banderas 3; `0000_base` a 30; quitar bloques de fijación
   en `0200`, `0500`, `1800`).
5. Alinear el nivel en el backend con D-029 (altura del agua, confirmaciones aparte) — P-35.
6. Limpiar `web/.vite/` + `.gitignore`; borrar ramas viejas (`feat/f5-t3-web-voz` y las de hoy ya mergeadas).

## Decisiones abiertas de Diego
- P-35 nivel en backend · P-36 servidor de rutas para producción · P-37 persona en riesgo (911 directo vs formulario).
- Pedidos para después: textura de tarjetas "pasan / no pasan", rutas que esquiven inundaciones, revisar escritorio,
  tope por identidad en `marcar_falso`, captcha (P-16), canales Realtime privados, `npm audit fix`.
- Diego hace él: apagar registro por correo en Supabase Auth; confirmar MFA en GitHub/Supabase/Netlify/correo.

## DUPLICADOS para decidir (cuál se queda)
- Permisos: Registro · Avisos→Preferencias · Mapa. Accesibilidad: Registro paso 2 · Ajustes · panel de Leyenda.
- Medio de transporte: Registro · Monitoreo vial · Más. Ayuda: pestaña "Ayuda" · "¿A quién acudo?".
- Código: "hace X" ×3, distancia ×2, `elegirCercano` vs `reporteParaConfirmar`, `HojaEnviado`, `Flujo` paso 5 muerto.

## No olvidar
- `bash scripts/sync.sh` al iniciar; git solo con `scripts/` (sin trailers de co-autor).
- Pruebas: `supabase db reset && supabase test db`; front: `cd web && npx vitest run && npm run build`.
- Deploy front: `cd web && npm run build && netlify deploy --prod --dir dist --site c8abb1d6-9180-4a14-9de8-9ee8894045be --no-build`.
- `supabase db query --linked -f archivo.sql` (un SQL que empieza con `--` como argumento falla).
- `?prueba=1` modo prueba (`?prueba=0` lo apaga) · `?demo=1` probar aviso de confirmación. Nunca `supabase config push`.
