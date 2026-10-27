# HANDOFF — Estado actual
> Foto corta para retomar en una sesión nueva. Máx. ~60 líneas.

**Última actualización:** 2026-10-27 · LeoFigo74z (con Codex)
**Fase actual:** mitad de Leo corregida localmente; integración y PR pendientes
**Rama de entrega:** `feat/c-mitad-leo`
**Repo:** https://github.com/gorra2451-ai/backend-ecosistemas

## Dónde quedamos
- Diego completó su 50%: base, reportes, activación, zonas, admin y auditoría. Los PR
  #10 (utilidades invoker + índice) y #11 (endurecimiento nube D-016) fueron aprobados
  por Leo el 27/10; Diego debe fusionarlos.
- Leo completó localmente sus ocho tareas (50%): perfiles/entradas, evidencias,
  Broadcast, refugios, push, avisos de zona, clima y derivación.
- Revisión de Diego: se reprodujeron fallos de activación normal, fin de zona,
  proveedores push y frecuencia de entradas. Una migración nueva y 16 pruebas
  nuevas los corrigen sin editar migraciones existentes.
- Con solo la rama de Leo: `supabase db reset`, 349 pgTAP en 17 archivos,
  10 pruebas Deno, arnés SQL, smoke de concurrencia y diagnóstico 55/0, todo verde.
  La integración temporal con las ramas de #10/#11 pasó 358 pgTAP.
  Falta repetir tras fusionarlos a main; la prueba temporal no sustituye ese paso.
- Nuevos errores del contrato: `proveedor_push_no_permitido` y `limite_entradas`.
  Parámetro provisional `max_entradas_por_hora=20` (P-25) sujeto a Diego.
- Seguridad nube D-016 de Diego: HS256 heredada revocada, SSL obligatorio,
  contraseña robusta, GraphQL apagado; `probar-nube.sh` es verificación externa.
- Supabase remoto solo tiene la base de Diego; **no aplicar db push desde esta rama**.
  Auth anónima remota queda apagada hasta resolver captcha P-16.
- Catálogos de refugios e instituciones vacíos hasta fuentes P-05/P-07; clima manual
  sin fuente P-06/P-23; push real, EXIF, municipios y privacidad de celda pendientes.
- Informe actual para Diego: `docs/INFORME_REVISION_DIEGO_2026-10-27.md`.

## Siguiente paso
1. Diego fusiona los PR #10 y #11 aprobados.
2. Sincronizar `main`, fusionarlo con `--no-ff` en `feat/c-mitad-leo`, conservar
   PROGRESO/HANDOFF/PLAN de ambos y repetir reset, suites, Edge, smoke, diagnóstico.
3. Confirmar P-25 (20 entradas/hora), P-26 (celda ligada al perfil) y P-16.
4. Solo al final subir esta rama autorizada y abrir un PR; Diego revisa/mergea.
   Diego, desde main, decide después cuándo aplicar migraciones remotas.
