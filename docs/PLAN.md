# PLAN DE CONSTRUCCIÓN
> Marca `[x]` al terminar. Dueño: **D** = Diego · **C** = LeoFigo74z · **D+C** = juntos.
> `%` = peso de la tarea en el reparto 50/50 (ver `AGENTS.md` §8). Las tareas D+C y la Fase 0 no suman.
> Fechas propuestas; ajustar cuando se confirmen mid-fi y high-fi (P-09).

Las ocho tareas C tienen implementación y revisión local al 26-oct-2026; sus casillas
siguen abiertas para revisión compartida, integración y publicación. Evidencia y
dependencias: `docs/INFORME_PARA_DIEGO_2026-10-26.md`.

## Fase 0 · Arnés y repo — 20 al 26 oct
| Estado | Tarea | Dueño | % |
|---|---|---|---|
| [x] | F0-T1 Arnés: reglas, docs, prompts | D | — |
| [x] | F0-T2 Repo `backend-ecosistemas` en GitHub desde Warp (privado; `main` protegida por regla, D-011) | D | — |
| [ ] | F0-T3 Invitar a C, confirmar su nombre y que pueda abrir sesión con `prompts/inicio_sesion.md` | D | — |
| [ ] | F0-T4 Proyecto Supabase remoto + Supabase CLI y Docker en ambas compus (remoto D-014 y entorno local de Leo funcional; validar cierre conjunto) | D+C | — |
| [x] | F0-T5 Revisar y aprobar `MODELO_DATOS.md` y `API.md` v0 (Diego, D-013) | D+C | — |

## Fase 1 · Base — 27 oct al 2 nov
| Estado | Tarea | Dueño | % |
|---|---|---|---|
| [x] | F1-T1 Migración: extensiones (postgis, pg_cron), enums, `parametros` | D | 4% |
| [ ] | F1-T2 Migración: `perfiles`, `entradas`, auth anónima, RLS + pruebas (lista localmente 2026-10-26; pendiente revisión/PR/nube) | C | 10% |
| [x] | F1-T3 Migración: `reportes`, `confirmaciones`, RLS + pruebas | D | 5% |
| [x] | F1-T4 Polígono de la ZMG y función `dentro_de_zmg` | D | 3% |
| [x] | F1-T5 `seed.sql` con datos de prueba | D | 3% |
| [ ] | F1-T6 Congelar `API.md` v1 (hecho 2026-10-23) y compartir con los 5 equipos (falta) | D+C | — |

## Fase 2 · Reporte y confirmación — 3 al 9 nov
| Estado | Tarea | Dueño | % |
|---|---|---|---|
| [x] | F2-T1 RPC `crear_reporte` con validaciones y límites + pruebas | D | 7% |
| [x] | F2-T2 RPC `confirmar_reporte`, `marcar_falso`, `reportes_cercanos` + pruebas | D | 8% |
| [x] | F2-T3 Activación por umbral y expiración con `pg_cron` + pruebas | D | 7% |
| [ ] | F2-T4 Tabla `evidencias` + RLS, Storage `evidencias` con políticas y `agregar_evidencia` + pruebas (lista localmente 2026-10-26; pendiente revisión/PR/nube y P-19 antes de uso público) | C | 8% |

## Fase 3 · Mapa — 10 al 16 nov
| Estado | Tarea | Dueño | % |
|---|---|---|---|
| [x] | F3-T1 Vista `zonas_publicas` y niveles + pruebas | D | 5% |
| [x] | F3-T2 RPC `reportes_activos_en_area` | D | 3% |
| [ ] | F3-T3 Realtime habilitado en reportes/zonas (lista localmente 2026-10-26; pendiente revisión/PR/nube) | C | 4% |
| [ ] | F3-T4 `refugios` + vista pública (lista localmente 2026-10-26; catálogo vacío hasta P-07, pendiente revisión/PR/nube) | C | 6% |

## Fase 4 · Notificaciones y derivación — 17 al 23 nov
| Estado | Tarea | Dueño | % |
|---|---|---|---|
| [ ] | F4-T1 `suscripciones_push` + Edge Function de envío Web Push (probada localmente; pendiente envío real a navegador, revisión/PR/nube) | C | 5% |
| [ ] | F4-T2 Disparo por cambio de estado con límite anti-spam (probado localmente; pendiente revisión/PR/nube y P-21/P-22) | C | 4% |
| [ ] | F4-T3 `alertas_clima` + carga manual verificada (probado localmente; pendiente P-06/P-23 y revisión/PR/nube) | C | 3% |
| [ ] | F4-T4 `instituciones` verificadas + RPC `derivar` (probado localmente; catálogo vacío hasta P-05/P-07, pendiente revisión/PR/nube) | C | 10% |

## Fase 5 · Admin, seguridad e integración — 24 al 30 nov
| Estado | Tarea | Dueño | % |
|---|---|---|---|
| [x] | F5-T1 Rol admin, ocultar reportes, `acciones_admin` | D | 5% |
| [ ] | F5-T2 Auditoría de RLS y llaves con `prompts/revision_pr.md` | D+C | — |
| [ ] | F5-T3 Integración con cada equipo de front y corrección de contrato | D+C | — |

## Fase 6 · Cierre — diciembre
| Estado | Tarea | Dueño | % |
|---|---|---|---|
| [ ] | F6-T1 Congelar, documentar y preparar demo | D+C | — |

## Suma del reparto
| Persona | Tareas | Total |
|---|---|---|
| Diego | F1-T1 4 · F1-T3 5 · F1-T4 3 · F1-T5 3 · F2-T1 7 · F2-T2 8 · F2-T3 7 · F3-T1 5 · F3-T2 3 · F5-T1 5 | **50%** |
| LeoFigo74z | F1-T2 10 · F2-T4 8 · F3-T3 4 · F3-T4 6 · F4-T1 5 · F4-T2 4 · F4-T3 3 · F4-T4 10 | **50%** |
