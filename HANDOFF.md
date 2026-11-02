# HANDOFF — Estado actual
> Foto corta para retomar en una sesión nueva. Máx. ~60 líneas.

**Última actualización:** 2026-11-02 · LeoFigo74z (con Codex)
**Fase actual:** revisión final del PR #12
**Rama activa:** `feat/c-mitad-leo` (publicada, PR #12)
**PR:** https://github.com/gorra2451-ai/backend-ecosistemas/pull/12

## Estado verificado
- PR #10 y #11 fusionados; `main` estaba en `088907f` al integrar
  la rama de Leo (merge `7a36974`).
- La migración de auditoría `20261023000600` está en la nube según
  el compañero; ninguna migración de Leo se aplicó remoto.
- Las ocho tareas de Leo (50%) están implementadas: perfiles/entradas,
  evidencias, Realtime, refugios, Web Push, avisos de zona, clima y
  derivación. El mapa visual corresponde a los equipos de frontend.
- P-25: 20 entradas por perfil/hora. P-26: suscripciones por celda de
  ~300 m, baja inmediata o tras 30 días sin renovación ni entrega.
  Las decisiones están en D-017.
- Ajuste solicitado en PR #12: nueva migración con
  `lote_procesar_avisos=20` y `ttl_enviar_push_seg=3600`.
  `procesar-avisos` y `enviar-push` leen los valores de `parametros`.
- P-16: Auth anónima sigue apagada en la nube. `config.toml` permite
  pruebas locales y advierte NO hacer `supabase config push` hasta
  resolver captcha y límites.
- Validación local: `supabase db reset`, 380/380 pgTAP en 20 archivos,
  arnés SQL 20/20, Edge 13/13 y lectura REST interna de ambos parámetros.
  Concurrencia HTTP y lint local en verde; diagnóstico previo 56/0.

## Siguiente paso
1. El compañero revisa estos dos ajustes y decide aprobar/mergear PR #12.
2. Tras el merge, él decide aplicar migraciones a Supabase remoto y
   verifica con `scripts/probar-nube.sh`. Leo no hace merge ni toca nube.
3. Para uso público siguen pendientes P-16, fuentes/catálogos oficiales,
   EXIF, VAPID y prueba push real, polígonos municipales e integración
   con frontend. Ver `PREGUNTAS.md`.
