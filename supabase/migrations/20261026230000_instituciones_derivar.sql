-- F4-T4: catálogo verificable y orientación sin guardar la ubicación consultada.
create type public.tipo_caso as enum
  ('casa', 'coche', 'persona_herida', 'tercero', 'otro');
insert into public.parametros (clave, valor, descripcion) values
  ('radio_refugios_derivacion_m', 20000, 'Radio máximo de refugios en derivación (P-24)'),
  ('max_refugios_derivacion', 5, 'Máximo de refugios devueltos por derivación (P-24)');

create table public.instituciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 3 and 150),
  tipos_caso public.tipo_caso[] not null check (cardinality(tipos_caso) > 0),
  telefono text check (telefono is null or telefono ~ '^[+0-9 ()-]{7,30}$'),
  url text check (url is null or
    (length(url) between 12 and 500 and url ~ '^https://[^[:space:]]+$')),
  municipio text not null check (length(trim(municipio)) between 2 and 100),
  horario text check (horario is null or length(trim(horario)) between 3 and 200),
  fuente text not null check (length(trim(fuente)) between 3 and 500),
  verificado_en timestamptz,
  creado_en timestamptz not null default now(),
  constraint institucion_contacto check (telefono is not null or url is not null)
);
create index instituciones_municipio_verificado_idx on public.instituciones
  (municipio, verificado_en) where verificado_en is not null;
alter table public.instituciones enable row level security;
revoke all on public.instituciones from public, anon, authenticated;
grant select on public.instituciones to anon, authenticated;
create policy instituciones_lectura_verificada on public.instituciones
  for select to anon, authenticated
  using (verificado_en is not null and verificado_en <= now());
create view public.instituciones_publicas with (security_invoker = true) as
select id, nombre, tipos_caso, telefono, url, municipio, horario, fuente, verificado_en
from public.instituciones
where verificado_en is not null and verificado_en <= now();
revoke all on public.instituciones_publicas from public, anon, authenticated;
grant select on public.instituciones_publicas to anon, authenticated;

create function public.derivar(
  p_caso public.tipo_caso, p_municipio text,
  p_lat double precision, p_lng double precision
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_municipio text := lower(trim(p_municipio));
  v_punto extensions.geography;
  v_instituciones jsonb;
  v_refugios jsonb;
  v_pasos jsonb;
begin
  if p_caso is null or p_municipio is null or length(v_municipio) not between 2 and 100
    or p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90
    or p_lng < -180 or p_lng > 180 then
    raise exception 'parametros_invalidos';
  end if;
  v_punto := public.punto(p_lat, p_lng);
  select coalesce(jsonb_agg(to_jsonb(i) order by i.nombre), '[]'::jsonb)
    into v_instituciones
    from public.instituciones_publicas i
    where lower(trim(i.municipio)) = v_municipio
      and p_caso = any(i.tipos_caso);
  select coalesce(jsonb_agg(to_jsonb(r) order by r.distancia_m), '[]'::jsonb)
    into v_refugios from (
      select id, nombre, direccion, municipio, capacidad, fuente, verificado_en,
        extensions.st_y(ubicacion::extensions.geometry) as lat,
        extensions.st_x(ubicacion::extensions.geometry) as lng,
        round(extensions.st_distance(ubicacion, v_punto))::integer as distancia_m
      from public.refugios
      where verificado_en is not null and verificado_en <= now()
        and extensions.st_dwithin(ubicacion, v_punto,
          public.param('radio_refugios_derivacion_m'))
      order by extensions.st_distance(ubicacion, v_punto), id
      limit public.param('max_refugios_derivacion')::integer
    ) r;
  v_pasos := case when p_caso = 'persona_herida'
    then jsonb_build_array('Aléjate del agua y ubícate en un lugar seguro.',
      'Solicita ayuda a los servicios de emergencia de tu localidad.')
    else jsonb_build_array('Aléjate del agua y ubícate en un lugar seguro.',
      'Consulta los contactos verificados disponibles para tu caso y municipio.') end;
  return jsonb_build_object('instituciones', v_instituciones,
    'refugios', v_refugios, 'pasos', v_pasos);
end $$;
revoke execute on function public.derivar(public.tipo_caso, text,
  double precision, double precision) from public, anon, authenticated;
grant execute on function public.derivar(public.tipo_caso, text,
  double precision, double precision) to anon, authenticated;
