-- =============================================================================
-- Base compartida (F1-T1, F1-T3, F1-T4): extensiones, enums, parámetros, ZMG,
-- administradores, reportes, confirmaciones y bitácora de admin.
-- Ver docs/MODELO_DATOS.md. Las reglas de negocio (RPC) viven en migraciones aparte.
-- =============================================================================

create extension if not exists postgis with schema extensions;
create extension if not exists pg_cron;

-- Cerrado por defecto: lo que se cree después en public NO queda abierto a anon/authenticated.
-- Cada migración da los permisos que necesita de forma explícita.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Enums del módulo de reportes (los de COMPANERO van en sus migraciones)
-- -----------------------------------------------------------------------------
create type public.tipo_reporte as enum ('calle', 'casa', 'coche', 'persona_en_riesgo');
create type public.estado_reporte as enum ('pendiente', 'activo', 'resuelto', 'oculto', 'en_revision');
create type public.nivel_zona as enum ('bajo', 'medio', 'alto');

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create function public.tocar_actualizado_en() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

-- Punto geográfico a partir de lat/lng (WGS84).
create function public.punto(p_lat double precision, p_lng double precision)
returns extensions.geography
language sql immutable parallel safe set search_path = '' as $$
  select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
$$;

-- -----------------------------------------------------------------------------
-- parametros: números de negocio (D-004). Se cambian solo por migración.
-- -----------------------------------------------------------------------------
create table public.parametros (
  clave          text primary key,
  valor          numeric not null,
  descripcion    text not null,
  actualizado_en timestamptz not null default now()
);

insert into public.parametros (clave, valor, descripcion) values
  ('umbral_activacion',        5,    'Reportes cercanos que activan una alerta (clase 20-oct)'),
  ('umbral_persona_en_riesgo', 1,    'Reportes persona_en_riesgo que la activan (POR CONFIRMAR)'),
  ('radio_agrupacion_m',       150,  'Radio en metros que agrupa reportes y detecta duplicados'),
  ('ventana_activacion_min',   60,   'Minutos para juntar el umbral; si no, pendiente -> resuelto'),
  ('minutos_expiracion',       30,   'Minutos sin confirmacion "si" para que un activo pase a resuelto (clase 20-oct)'),
  ('votos_no_para_resolver',   3,    'Votos "no" desde el ultimo "si" que resuelven un reporte'),
  ('banderas_para_revision',   3,    'Marcas de falso que mandan un reporte a en_revision'),
  ('max_reportes_por_hora',    5,    'Limite de reportes por usuario por hora'),
  ('tamano_celda_m',           300,  'Lado en metros de la celda de zonas de calor'),
  ('nivel_medio_min',          3,    'Reportes activos en la celda para nivel medio (POR CONFIRMAR)'),
  ('nivel_alto_min',           6,    'Reportes activos en la celda para nivel alto (POR CONFIRMAR)'),
  ('radio_cercanos_max_m',     1000, 'Tope del radio en reportes_cercanos'),
  ('area_max_consulta_km2',    2500, 'Tope del rectangulo en reportes_activos_en_area'),
  ('minutos_entre_avisos',     30,   'Max. 1 aviso por zona por usuario en este lapso (propuesta)');

alter table public.parametros enable row level security;
create policy parametros_lectura_publica on public.parametros
  for select to anon, authenticated using (true);
grant select on public.parametros to anon, authenticated;

create function public.param(p_clave text) returns numeric
language plpgsql stable security definer set search_path = '' as $$
declare
  v numeric;
begin
  select valor into v from public.parametros where clave = p_clave;
  if not found then
    raise exception 'parametro_no_existe: %', p_clave;
  end if;
  return v;
end $$;
grant execute on function public.param(text) to anon, authenticated;
grant execute on function public.punto(double precision, double precision) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- limites_zmg (F1-T4). Polígono PROVISIONAL: rectángulo aproximado (P-13).
-- -----------------------------------------------------------------------------
create table public.limites_zmg (
  id             smallint primary key default 1,
  nombre         text not null,
  area           extensions.geography(MultiPolygon, 4326) not null,
  fuente         text not null,
  actualizado_en timestamptz not null default now()
);
create index limites_zmg_area_idx on public.limites_zmg using gist (area);

insert into public.limites_zmg (nombre, area, fuente) values (
  'Zona Metropolitana de Guadalajara',
  extensions.st_multi(extensions.st_makeenvelope(-103.75, 20.30, -102.95, 21.05, 4326))::extensions.geography,
  'PROVISIONAL: rectangulo aproximado. Reemplazar por poligono oficial (P-13)'
);

alter table public.limites_zmg enable row level security;
create policy limites_zmg_lectura_publica on public.limites_zmg
  for select to anon, authenticated using (true);
grant select on public.limites_zmg to anon, authenticated;

create function public.dentro_de_zmg(p_lat double precision, p_lng double precision) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.limites_zmg z
    where extensions.st_covers(z.area, public.punto(p_lat, p_lng))
  )
$$;
grant execute on function public.dentro_de_zmg(double precision, double precision) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- administradores (F5-T1 la usa). Alta solo por SQL con llave de servicio.
-- -----------------------------------------------------------------------------
create table public.administradores (
  perfil_id uuid primary key references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now()
);
alter table public.administradores enable row level security;
-- Sin políticas ni grants: anon/authenticated no la leen ni la escriben.

create function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.administradores where perfil_id = (select auth.uid()))
$$;
grant execute on function public.es_admin() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- reportes (F1-T3). Escritura solo por RPC. Lectura pública: filas activas, sin perfil_id.
-- -----------------------------------------------------------------------------
create table public.reportes (
  id                  uuid primary key,
  perfil_id           uuid not null references auth.users (id) on delete cascade,
  tipo                public.tipo_reporte not null,
  pasan_carros        boolean not null,
  ubicacion           extensions.geography(Point, 4326) not null,
  precision_m         integer check (precision_m >= 0),
  estado              public.estado_reporte not null default 'pendiente',
  ultima_confirmacion timestamptz,
  activado_en         timestamptz,
  resuelto_en         timestamptz,
  creado_en           timestamptz not null default now()
);
create index reportes_ubicacion_idx on public.reportes using gist (ubicacion);
create index reportes_estado_creado_idx on public.reportes (estado, creado_en);
create index reportes_perfil_creado_idx on public.reportes (perfil_id, creado_en desc);

alter table public.reportes enable row level security;
create policy reportes_lectura_activos on public.reportes
  for select to anon, authenticated using (estado = 'activo');
grant select (id, tipo, pasan_carros, ubicacion, precision_m, estado,
              ultima_confirmacion, activado_en, resuelto_en, creado_en)
  on public.reportes to anon, authenticated;

-- -----------------------------------------------------------------------------
-- confirmaciones (F1-T3). Una por usuario por reporte. Lectura pública sin autor.
-- -----------------------------------------------------------------------------
create table public.confirmaciones (
  id             bigint generated always as identity primary key,
  reporte_id     uuid not null references public.reportes (id) on delete cascade,
  perfil_id      uuid not null references auth.users (id) on delete cascade,
  sigue          boolean not null,
  falso          boolean not null default false,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (reporte_id, perfil_id)
);
create index confirmaciones_perfil_idx on public.confirmaciones (perfil_id);
create trigger confirmaciones_actualizado_en before update on public.confirmaciones
  for each row execute function public.tocar_actualizado_en();

alter table public.confirmaciones enable row level security;
create policy confirmaciones_lectura_de_activos on public.confirmaciones
  for select to anon, authenticated
  using (exists (select 1 from public.reportes r where r.id = reporte_id and r.estado = 'activo'));
grant select (id, reporte_id, sigue, falso, creado_en, actualizado_en)
  on public.confirmaciones to anon, authenticated;

-- -----------------------------------------------------------------------------
-- acciones_admin (F5-T1 escribe aquí). Solo admins la leen.
-- -----------------------------------------------------------------------------
create table public.acciones_admin (
  id             bigint generated always as identity primary key,
  admin_id       uuid references auth.users (id) on delete set null,
  accion         text not null,
  objetivo_tabla text,
  objetivo_id    text,
  motivo         text not null check (length(trim(motivo)) > 0),
  creado_en      timestamptz not null default now()
);
create index acciones_admin_creado_idx on public.acciones_admin (creado_en desc);

alter table public.acciones_admin enable row level security;
create policy acciones_admin_solo_admins on public.acciones_admin
  for select to authenticated using ((select public.es_admin()));
grant select on public.acciones_admin to authenticated;
