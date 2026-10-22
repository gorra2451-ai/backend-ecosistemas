# MODELO DE DATOS (borrador para aprobar en Fase 1)
> Nombres en español, snake_case. Toda tabla con RLS. Ubicaciones en `geography(Point, 4326)`.

## Diagrama
```
auth.users ─1──1─ perfiles
perfiles ─1──n─ entradas            (medio de transporte por visita)
perfiles ─1──n─ reportes ─1──n─ confirmaciones ─n──1─ perfiles
reportes ─1──n─ evidencias          (foto/video en Storage)
reportes ─n──1─ zonas (vista calculada)
perfiles ─1──n─ suscripciones_push
alertas_clima · instituciones · refugios · parametros · acciones_admin
```

## Tablas
### perfiles
| Columna | Tipo | Nota |
|---|---|---|
| id | uuid PK = auth.users.id | Usuario anónimo |
| rol | enum `usuario`,`admin` | Default `usuario` |
| accesibilidad | jsonb | Ej. `{"daltonismo":true,"voz":false}` |
| creado_en | timestamptz | |

### entradas
| id uuid PK | perfil_id | medio enum `peaton`,`bici`,`auto`,`transporte_publico` | creado_en |

### reportes
| Columna | Tipo | Nota |
|---|---|---|
| id | uuid PK | Lo genera el cliente → reintentos no duplican |
| perfil_id | uuid | Nunca se expone |
| tipo | enum `calle`,`casa`,`coche`,`persona_en_riesgo` | |
| pasan_carros | boolean | Medida simple de gravedad |
| ubicacion | geography(Point) | Obligatoria |
| precision_m | int | Precisión del GPS |
| estado | enum `pendiente`,`activo`,`resuelto`,`oculto` | Ver REGLAS_NEGOCIO |
| ultima_confirmacion | timestamptz | Para expirar |
| creado_en | timestamptz | Automática |

### confirmaciones
| id | reporte_id | perfil_id | sigue boolean | creado_en | — único (reporte_id, perfil_id) |

### evidencias
| id | reporte_id | ruta_storage | tipo enum `foto`,`video` | creado_en |

### zonas (vista)
Agrupa reportes `activo` en celdas de tamaño `parametros.tamano_celda_m`.
Columnas: celda, centro, total_reportes, total_confirmaciones, nivel (`bajo`,`medio`,`alto`),
alguno_no_pasan_carros, actualizado_en.

### suscripciones_push
| id | perfil_id | endpoint | p256dh | auth | zonas_interes geography? | creado_en |

### alertas_clima
| id | fuente | nivel enum | titulo | descripcion | area geography(Polygon)? | vigente_desde | vigente_hasta |

### instituciones
| id | nombre | tipos_caso enum[] | telefono | url | municipio | horario | fuente | verificado_en |
> Sin datos verificados no se publica (`verificado_en` nulo = oculto).

### refugios
| id | nombre | ubicacion | direccion | capacidad | fuente | verificado_en |

### parametros
| clave text PK | valor numeric | descripcion | actualizado_en |
Valores iniciales provisionales. **5 y 30 salieron de clase; el resto son propuestas de arranque** para ajustar con testeo (ver PREGUNTAS):
`umbral_activacion=5`, `radio_agrupacion_m=150`, `ventana_activacion_min=60`,
`minutos_expiracion=30`, `votos_no_para_resolver=3`, `tamano_celda_m=300`,
`max_reportes_por_hora=5`.

### acciones_admin
| id | admin_id | accion | objetivo_tabla | objetivo_id | motivo | creado_en |
