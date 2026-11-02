-- F3-T4: catálogo vacío hasta contar con refugios oficiales verificados (P-07).
-- Solo servicio/administración lo alimentan; el cliente solo lee lo verificado.

create table public.refugios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  ubicacion extensions.geography(Point, 4326) not null,
  direccion text not null check (length(trim(direccion)) > 0),
  municipio text not null check (length(trim(municipio)) > 0),
  capacidad integer check (capacidad >= 0),
  fuente text not null check (length(trim(fuente)) > 0),
  verificado_en timestamptz,
  creado_en timestamptz not null default now()
);
create index refugios_ubicacion_idx on public.refugios using gist (ubicacion);
create index refugios_municipio_verificado_idx on public.refugios (municipio, verificado_en)
  where verificado_en is not null;

alter table public.refugios enable row level security;
revoke all on public.refugios from public, anon, authenticated;
grant select on public.refugios to anon, authenticated;
create policy refugios_solo_verificados on public.refugios
  for select to anon, authenticated
  using (verificado_en is not null and verificado_en <= now());

create view public.refugios_publicos with (security_invoker = true) as
select id, nombre,
  extensions.st_y(ubicacion::extensions.geometry) as lat,
  extensions.st_x(ubicacion::extensions.geometry) as lng,
  direccion, municipio, capacidad, fuente, verificado_en
from public.refugios
where verificado_en is not null and verificado_en <= now();
revoke all on public.refugios_publicos from public, anon, authenticated;
grant select on public.refugios_publicos to anon, authenticated;
