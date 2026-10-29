# HANDOFF — Estado actual
> Foto corta para retomar en una sesión nueva. Máx. ~60 líneas.

**Última actualización:** 2026-10-28 · LeoFigo74z (con Codex)
**Fase actual:** integrar `main` y cerrar retención de suscripciones antes del PR
**Rama activa:** `feat/c-mitad-leo` (solo local hasta la validación final)
**Repo:** https://github.com/gorra2451-ai/backend-ecosistemas

## Dónde quedamos
- Diego completó su 50%: base, reportes, activación, zonas y admin.
  PR #10 y #11 aprobados por Leo y fusionados; `main` está en `088907f`.
- La migración de auditoría del PR #10 ya está en la nube según Diego;
  `scripts/probar-nube.sh` dio 12/12. Ninguna migración de Leo se aplicó remoto.
- Leo completó localmente sus ocho tareas (50%): perfiles/entradas, evidencias,
  Broadcast, refugios, push, avisos de zona, clima y derivación.
- Revisión de Diego: se corrigieron activación normal, fin de zona, proveedor
  push y frecuencia de entradas con una migración nueva y 16 pruebas.
- Antes de integrar `main`: 349 pgTAP en 17 archivos, 10 Deno, arnés SQL,
  smoke de concurrencia y diagnóstico 55/0 en verde. Integración temporal
  de PR #10/#11 con la rama de Leo: 358 pgTAP; repetir ahora con `main` real.
- P-25 aprobado por Diego: `max_entradas_por_hora=20` en `parametros`.
- P-26 aprobado: celda aproximada ligada a perfil, borrado al darse de baja
  o tras 30 días sin uso. Falta migración, pgTAP y documentación de retención.
- P-16 confirmado: Auth anónima remota apagada hasta captcha y límites.
- Catálogos oficiales P-05/P-07, clima P-06/P-23, EXIF P-19, push real P-20
  y polígonos P-21 siguen pendientes para uso público.
- Seguridad nube D-016: HS256 heredada revocada, SSL obligatorio,
  contraseña robusta y GraphQL apagado. `probar-nube.sh` revisa desde fuera.

## Siguiente paso
1. Resolver el merge `main` → `feat/c-mitad-leo` conservando la bitácora
   y la arquitectura de ambos. No hacer `supabase db push`.
2. Añadir prueba que falle para caducidad de suscripciones, nueva migración
   con `dias_retencion_suscripcion=30` y pg_cron; resolver P-25/P-26 en
   `PREGUNTAS.md` y documentar decisión en `DECISIONES.md`.
3. Repetir reset, pgTAP, arnés SQL, Edge, smoke y diagnóstico; revisar diff.
4. Subir solo esta rama autorizada y abrir PR con `PUSH_AUTORIZADO=1`.
   Diego revisa/mergea y decide después el despliegue remoto.