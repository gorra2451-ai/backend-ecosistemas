# Construcción módulos de Diego · Plan de implementación

> **Para agentes:** usa superpowers:test-driven-development. Cada módulo es independiente; solo
> depende de la migración base. Pasos con casillas `- [ ]`.

**Goal:** construir todas las tareas con dueño D de `docs/PLAN.md` (F2-T1, F2-T2, F2-T3, F3-T1,
F3-T2, F5-T1, F1-T5) sobre la base ya mergeada (F1-T1, F1-T3, F1-T4).

**Architecture:** toda la lógica en Postgres: RPC `security definer` con `search_path = ''`, vistas
`security_invoker`, permisos por columna. Cada módulo = 1 migración + 1 archivo pgTAP, con
nombres fijos para que no choquen.

**Tech Stack:** Supabase (Postgres 17, PostGIS en schema `extensions`, pg_cron), pgTAP.

**Spec:** `docs/MODELO_DATOS.md`, `docs/REGLAS_NEGOCIO.md`, `docs/API.md` (v0 revisado),
`supabase/migrations/20261023000000_base.sql`, `supabase/tests/0000_base.test.sql`.

## Global Constraints
- Reglas obligatorias: `AGENTS.md`. Números de negocio solo con `public.param('clave')`; nunca literales.
- Nombres en español, snake_case. PostGIS siempre calificado: `extensions.st_dwithin(...)`.
- Funciones: `security definer set search_path = ''`, todo calificado con schema (`public.`, `extensions.`, `auth.`).
- Las funciones nacen **sin** permiso de ejecución (default privileges cerrados en la base):
  cada RPC lleva su `grant execute on function public.f(<tipos>) to authenticated;` (y `anon` solo si es lectura pública).
- Errores de negocio: `raise exception '<codigo>';` (errcode P0001) con el código exacto de `docs/API.md`.
  Sin sesión: `if (select auth.uid()) is null then raise exception 'sin_sesion'; end if;`
- Hora siempre del servidor (`now()`); nunca del cliente.
- Lat/lng de salida: `extensions.st_y(ubicacion::extensions.geometry)` / `st_x`. Entrada: `public.punto(p_lat, p_lng)`.
- `perfil_id` nunca sale de una función, salvo `es_propio boolean` del usuario actual.
- No editar: migraciones de otros, `docs/*`, `PLAN/PROGRESO/HANDOFF`, `scripts/`, `.github/`.
  Los cambios de contrato se reportan al integrador.
- Verificar solo con `bash scripts/probar-db.sh supabase/tests/<tu_archivo>`. **Prohibido** correr
  `supabase db reset`, `supabase test db`, `supabase start/stop` o `db start` (Postgres compartido).
- Commits con `git commit` en tu rama de worktree, formato `tipo(modulo): mensaje`, sin co-autor. No push.

## Interfaces de la base (ya existen)
- `public.param(p_clave text) returns numeric` — falla con `parametro_no_existe: <clave>`.
- `public.punto(p_lat float8, p_lng float8) returns extensions.geography`
- `public.dentro_de_zmg(p_lat float8, p_lng float8) returns boolean`
- `public.es_admin() returns boolean`
- Enums: `tipo_reporte`, `estado_reporte` (`pendiente|activo|resuelto|oculto|en_revision`), `nivel_zona`.
- Tablas: `reportes`, `confirmaciones` (única `(reporte_id, perfil_id)`, columnas `sigue`, `falso`,
  `actualizado_en` con trigger), `administradores`, `acciones_admin`, `parametros`, `limites_zmg`.
- Lectura `anon/authenticated`: `reportes` filas `activo` y columnas sin `perfil_id`; `confirmaciones`
  de reportes activos sin `perfil_id`.

## Plantilla de prueba (copiar en cada archivo)
```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(<n>);
delete from public.reportes;          -- aislar de seed.sql (el rollback lo restaura)
insert into auth.users (id, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated');
-- actuar como A:
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
-- ... pruebas ...
reset role;                           -- volver a postgres para preparar/inspeccionar datos
select * from finish();
rollback;
```
Para simular tiempo: como `postgres`, `update public.reportes set creado_en = now() - interval '61 minutes' ...`.
Coordenadas de prueba dentro de la ZMG: centro GDL `20.6597, -103.3496`; ~111 m al norte = `+0.001` lat.

## Review Focus
1. Reintento del mismo `p_id` por el mismo usuario tras éxito → devuelve el existente, no error ni duplicado (M1).
2. Usuario intenta leer autoría por cualquier salida (RPC, vista, `es_propio` de otro) → nunca ve `perfil_id` (M1–M3).
3. Cambiar voto de "sí" a "no" y de vuelta → una sola fila, conteos correctos (M2).
4. Reportes en la frontera de celda / lat-lng en orden invertido (lng como lat) → `fuera_de_zmg`, no un punto absurdo (M1, M3).
5. Admin sin motivo o usuario normal llamando RPC de admin → `motivo_requerido` / `no_autorizado`, sin escribir bitácora (M4).

---

### Módulo M1: Reportes (F2-T1, F3-T2)
**Files:** Create `supabase/migrations/20261023000100_reportes_rpc.sql`, Test `supabase/tests/0100_reportes_rpc.test.sql`

**Produces:**
- `public.crear_reporte(p_id uuid, p_tipo public.tipo_reporte, p_pasan_carros boolean, p_lat float8, p_lng float8, p_precision_m integer default null) returns jsonb` → `{"id": uuid, "estado": text}`; grant `authenticated`.
- `public.reportes_activos_en_area(min_lat float8, min_lng float8, max_lat float8, max_lng float8) returns table(id uuid, tipo public.tipo_reporte, pasan_carros boolean, lat float8, lng float8, ultima_confirmacion timestamptz, creado_en timestamptz)`; grant `anon, authenticated`.

Reglas de `crear_reporte`, en este orden: `sin_sesion` → si `p_id` existe: del mismo usuario devuelve
`{id, estado}` actual; de otro → `id_en_uso` → `fuera_de_zmg` (`dentro_de_zmg`) → `limite_por_hora`
(reportes del usuario con `creado_en > now() - 1 h` ≥ `max_reportes_por_hora`) → `duplicado_cercano`
(reporte propio `pendiente|activo` a ≤ `radio_agrupacion_m`) → insert (`estado` pendiente, `creado_en`
del servidor) → **releer** `estado` después del insert (un trigger de M2 puede activarlo) → devolver.

`reportes_activos_en_area`: solo `activo`; si el área del rectángulo (km², vía geografía) >
`area_max_consulta_km2` → `area_demasiado_grande`; ordenar `persona_en_riesgo` primero, luego `creado_en desc`.

- [ ] Prueba (≥14 casos): crea pendiente; devuelve `{id, estado:'pendiente'}`; `perfil_id` = A y `creado_en` del servidor; reintento mismo id → mismo resultado y 1 fila; id de otro usuario → `id_en_uso`; sin sesión → `sin_sesion`; fuera de ZMG (CDMX y lat/lng invertidos) → `fuera_de_zmg`; 6.º reporte en la hora → `limite_por_hora` (separar puntos > radio); reporte propio a 50 m → `duplicado_cercano`; a 50 m de otro usuario sí se permite; reporte propio viejo `resuelto` cercano no bloquea; área: devuelve solo activos dentro, sin pendientes; área enorme → `area_demasiado_grande`; `anon` puede llamar `reportes_activos_en_area` y no `crear_reporte` (42501).
- [ ] Verla fallar: `bash scripts/probar-db.sh supabase/tests/0100_reportes_rpc.test.sql`
- [ ] Implementar la migración.
- [ ] Verla pasar; commit `feat(reportes): crear_reporte y reportes_activos_en_area`.

### Módulo M2: Confirmación, activación y expiración (F2-T2, F2-T3)
**Files:** Create `supabase/migrations/20261023000200_confirmacion.sql`, Test `supabase/tests/0200_confirmacion.test.sql`

**Produces:**
- Trigger `reportes_activacion` `after insert on public.reportes for each row when (new.estado = 'pendiente')` → `public.evaluar_activacion(p_reporte_id uuid) returns public.estado_reporte`.
  - `persona_en_riesgo`: reportes `pendiente|activo` del mismo tipo a ≤ radio en la ventana ≥ `umbral_persona_en_riesgo` → `activo`.
  - Si existe un `activo` a ≤ `radio_agrupacion_m` → el nuevo nace `activo`.
  - Si no: reportes `pendiente|activo` a ≤ radio con `creado_en ≥ now() - ventana_activacion_min` (incluido él) ≥ `umbral_activacion` → todos esos `pendiente` pasan a `activo`.
  - Al activar: `activado_en = now()`, `ultima_confirmacion = now()`.
- `public.confirmar_reporte(p_reporte_id uuid, p_sigue boolean) returns jsonb` → `{"reporte_id","estado"}`; errores `sin_sesion`, `reporte_no_existe`, `propio_reporte`, `reporte_no_activo`. Upsert en `confirmaciones` (`falso` se conserva salvo que pase a sí → `falso=false`). "sí" → `ultima_confirmacion = now()`. "no" → si los `sigue=false` con `actualizado_en > ultima_confirmacion` ≥ `votos_no_para_resolver` → `resuelto`, `resuelto_en = now()`. Grant `authenticated`.
- `public.marcar_falso(p_reporte_id uuid) returns jsonb` → mismos errores; upsert `sigue=false, falso=true`; si `falso=true` ≥ `banderas_para_revision` → `en_revision`; si no, aplica la regla de "no". Grant `authenticated`.
- `public.reportes_cercanos(p_lat float8, p_lng float8, p_radio_m integer) returns table(id uuid, tipo public.tipo_reporte, pasan_carros boolean, lat float8, lng float8, distancia_m float8, ultima_confirmacion timestamptz, es_propio boolean)` → solo `activo`, radio topado a `radio_cercanos_max_m`, orden por distancia. Grant `authenticated`.
- `public.expirar_reportes() returns integer` (filas cambiadas): `activo` con `coalesce(ultima_confirmacion, activado_en, creado_en) < now() - minutos_expiracion` → `resuelto`; `pendiente` con `creado_en < now() - ventana_activacion_min` → `resuelto`; pone `resuelto_en`. Sin grant a clientes.
- pg_cron: `cron.schedule('expirar-reportes', '*/5 * * * *', 'select public.expirar_reportes()')`.

- [ ] Prueba (≥16 casos): 4 reportes cercanos de usuarios distintos siguen pendiente y el 5.º activa los 5; reportes fuera del radio o de la ventana no cuentan; nuevo junto a un activo nace activo; `persona_en_riesgo` activa con 1; confirmar sí actualiza `ultima_confirmacion`; propio → `propio_reporte`; no activo → `reporte_no_activo`; inexistente → `reporte_no_existe`; sí→no→sí deja 1 fila; 3 "no" resuelven; "no" anteriores al último "sí" no cuentan; 3 falsos → `en_revision`; `reportes_cercanos` ordena por distancia, topa el radio, `es_propio` correcto y no devuelve pendientes; `expirar_reportes` resuelve activos viejos y pendientes viejos y no toca recientes; job `expirar-reportes` existe en `cron.job`.
- [ ] Verla fallar → implementar → verla pasar; commit `feat(confirmacion): activación, confirmación, falsos y expiración`.

### Módulo M3: Zonas de calor (F3-T1)
**Files:** Create `supabase/migrations/20261023000300_zonas.sql`, Test `supabase/tests/0300_zonas.test.sql`

**Produces:**
- `public.nivel_para(p_total integer, p_alguno_no_pasan boolean) returns public.nivel_zona` (`alto` si `p_alguno_no_pasan`; si no, por `nivel_medio_min` / `nivel_alto_min`). Grant `anon, authenticated`.
- Vista `public.zonas_publicas with (security_invoker = true)`: reportes `activo` agrupados por celda de `tamano_celda_m` en EPSG:32613 (`floor(x/tam)`, `floor(y/tam)`). Columnas: `celda text` (`'<ix>_<iy>'`), `lat float8`, `lng float8` (centro de la celda en WGS84), `total_reportes int`, `total_confirmaciones int` (confirmaciones `sigue=true`), `nivel public.nivel_zona`, `alguno_no_pasan_carros boolean`, `actualizado_en timestamptz` (máx. de `coalesce(ultima_confirmacion, activado_en, creado_en)`). Grant select `anon, authenticated`.

- [ ] Prueba (≥10 casos): `anon` lee la vista; pendientes/resueltos/ocultos/en_revision no cuentan; 2 activos en la misma celda → 1 fila con total 2, nivel bajo; 3 → medio; 6 → alto; uno con `pasan_carros=false` → alto; reportes a > 1 km → celdas distintas; centro de celda cae dentro de la celda (distancia al reporte < tam·√2); `total_confirmaciones` cuenta solo "sí"; la vista no expone `perfil_id` (no hay columna); `nivel_para` respeta los parámetros si se cambian (update en `parametros` dentro de la prueba).
- [ ] Verla fallar → implementar → verla pasar; commit `feat(zonas): vista zonas_publicas con niveles`.

### Módulo M4: Admin (F5-T1) y seed (F1-T5)
**Files:** Create `supabase/migrations/20261023000400_admin.sql`, `supabase/seed.sql`; Test `supabase/tests/0400_admin.test.sql`

**Produces** (todas: `no_autorizado` si `not public.es_admin()`, `motivo_requerido` si motivo vacío/nulo, `reporte_no_existe`; cada acción inserta en `acciones_admin` en la misma transacción; grant `authenticated`):
- `public.ocultar_reporte(p_reporte_id uuid, p_motivo text) returns jsonb` → estado `oculto`; `{"reporte_id","estado"}`.
- `public.restaurar_reporte(p_reporte_id uuid, p_motivo text) returns jsonb` → de `en_revision|oculto` a `activo` (`ultima_confirmacion = now()`); otro estado → `estado_invalido`.
- `public.reportes_en_revision() returns table(id uuid, tipo public.tipo_reporte, lat float8, lng float8, estado public.estado_reporte, total_falsos integer, total_confirmaciones integer, creado_en timestamptz)` → estados `en_revision` y `oculto`.

`seed.sql` (sin RPC, inserts directos como postgres, idempotente con `on conflict do nothing`):
usuarios anónimos falsos en `auth.users` (ids fijos `5eed0000-...`), 1 admin en `administradores`,
~30 reportes en puntos reales de la ZMG (avenidas conocidas de GDL/Zapopan/Tlaquepaque/Tonalá):
mezcla de `activo` (insertar ya `activo` con `activado_en`/`ultima_confirmacion`), `pendiente`,
`resuelto`, 1 `en_revision`; confirmaciones de varios usuarios. Comentario arriba: "datos falsos".

- [ ] Prueba (≥12 casos): normal → `no_autorizado` en las 3 y sin filas nuevas en bitácora; admin oculta → `oculto` + 1 fila en `acciones_admin` con motivo; motivo vacío/espacios → `motivo_requerido`; restaurar `en_revision` → `activo`; restaurar `resuelto` → `estado_invalido`; inexistente → `reporte_no_existe`; `reportes_en_revision` lista solo `en_revision|oculto` con `total_falsos` correcto; admin no puede leer `perfil_id`; `anon` no ejecuta (42501).
- [ ] Verla fallar → implementar → verla pasar (`probar-db.sh` aplica también `seed.sql`: debe correr limpio); commit `feat(admin): ocultar, restaurar y revisión; seed de prueba`.
