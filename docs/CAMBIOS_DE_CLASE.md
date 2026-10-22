# Cómo entra un cambio acordado en clase
> Nada se cambia en el código "porque se dijo en clase". Todo cambio deja rastro en este orden.

```
clase → PREGUNTAS.md → DECISIONES.md → tarea en PLAN.md → PR
```

## 1. Clase → `PREGUNTAS.md`
- Quien estuvo en clase anota el cambio **el mismo día** como fila nueva (`P-XX`):
  qué se dijo, quién lo dijo y qué fase bloquea.
- Si responde una pregunta ya abierta, se anota la respuesta en esa fila.

## 2. `PREGUNTAS.md` → `DECISIONES.md`
- Los dos (Diego y COMPANERO) acuerdan la respuesta.
- Se agrega una decisión nueva `D-XXX`. Si contradice una anterior, la anterior se marca
  "Reemplazada por D-XXX" y **no se borra**.
- La fila de la pregunta se marca ✔ con el número de decisión.

## 3. `DECISIONES.md` → tarea en `docs/PLAN.md`
Primero ver qué tipo de cambio es (D-010):

| Tipo de cambio | Cómo se aplica | Tarea |
|---|---|---|
| Un número (umbral, minutos, radio) | `UPDATE` a `parametros` vía migración nueva | Pequeña, sin %; dueño del módulo |
| Un dato por confirmar (teléfono, institución) | Migración o seed con el dato verificado y su fuente | Dueño del módulo |
| Una regla o tabla nueva | Migración nueva + pruebas + `docs/API.md` si el front lo usa | Tarea nueva con dueño y % |

- Si mueve el reparto 50/50, se ajustan los % en `PLAN.md` y `AGENTS.md` §8 en el mismo PR.

## 4. Tarea → PR
- Rama propia (`scripts/nueva-tarea.sh`), mismo flujo que cualquier tarea.
- El PR cita la `P-XX` y la `D-XXX`.
- Si cambia el contrato, se avisa en `PROGRESO.md` a los equipos de front.
