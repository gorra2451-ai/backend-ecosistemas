# HANDOFF — Estado actual
> Foto corta para retomar en una sesión nueva. Máx. ~60 líneas.

**Última actualización:** 2026-10-28 · LeoFigo74z (con Codex)
**Fase actual:** revisión del PR y despliegue controlado por Diego
**Rama activa:** `feat/c-mitad-leo` (publicada, PR #12)
**Repo:** https://github.com/gorra2451-ai/backend-ecosistemas
**PR de Leo:** https://github.com/gorra2451-ai/backend-ecosistemas/pull/12

## Estado verificado
- Diego fusionó PR #10 y #11; `main` está en `088907f`. La rama de Leo
  ya incorporó ese `main` (merge local `7a36974`).
- Según Diego, la migración de auditoría `20261023000600` está en Supabase
  remoto y `probar-nube.sh` pasó 12/12. Ninguna migración de Leo se aplicó
  en la nube.
- Las ocho tareas de Leo (50%) están implementadas y verificadas localmente:
  identidad/entradas, evidencias, Realtime, refugios, Web Push, avisos por
  zona, alertas climáticas y derivación.
- Correcciones pedidas por Diego incluidas: activación sin suscriptores,
  fin de zona, proveedor push y límite de entradas.
- P-25: 20 entradas por perfil/hora en `parametros`, aprobado.
- P-26: celda de ~300 m vinculada al perfil, aprobada con borrado al darse
  de baja o tras 30 días sin renovación ni aviso entregado. Nueva migración:
  parámetro, fecha de última entrega, trigger y job diario. Ver D-017.
- P-16: Auth anónima apagada en la nube hasta captcha y límites; local sí
  puede estar encendida.
- Validación local integrada: `supabase db reset`; 378 pgTAP en 19 archivos;
  arnés SQL 19/19; Edge 10/10; concurrencia HTTP; diagnóstico 56/0;
  lint local sin errores.

## Siguiente paso
1. Diego revisa PR #12 y decide el merge. Leo no hace merge propio.
2. Solo Diego, tras merge, decide aplicar migraciones a Supabase remoto
   y verificar con `scripts/probar-nube.sh`. No encender Auth anónima
   remota antes de captcha y límites.
3. Para uso público siguen pendientes fuentes y catálogos oficiales
   (P-05/P-06/P-07/P-23), EXIF (P-19), proveedores/VAPID y push real
   (P-20), polígonos municipales (P-21) e integración con los frontends.
