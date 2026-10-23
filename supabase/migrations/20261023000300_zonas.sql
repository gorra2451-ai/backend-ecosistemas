-- =============================================================================
-- M3 Zonas de calor (F3-T1): nivel por celda y vista pública zonas_publicas.
-- Ver docs/REGLAS_NEGOCIO.md §5 y docs/MODELO_DATOS.md (zonas_publicas).
-- =============================================================================

-- Nivel de una celda: alto si en algún reporte no pasan carros; si no, por umbrales de parametros.
create function public.nivel_para(p_total integer, p_alguno_no_pasan boolean)
returns public.nivel_zona
language sql stable security definer set search_path = '' as $$
  select case
    when coalesce(p_alguno_no_pasan, false)            then 'alto'::public.nivel_zona
    when p_total >= public.param('nivel_alto_min')     then 'alto'::public.nivel_zona
    when p_total >= public.param('nivel_medio_min')    then 'medio'::public.nivel_zona
    else 'bajo'::public.nivel_zona
  end
$$;
grant execute on function public.nivel_para(integer, boolean) to anon, authenticated;

-- Reportes activos agrupados en celdas cuadradas de tamano_celda_m metros (UTM 13N, EPSG:32613).
-- security_invoker: respeta RLS y permisos por columna del que consulta (nunca toca perfil_id).
create view public.zonas_publicas with (security_invoker = true) as
with cfg as (
  select public.param('tamano_celda_m')::double precision as tam
),
activos as (
  select r.id,
         r.pasan_carros,
         coalesce(r.ultima_confirmacion, r.activado_en, r.creado_en) as momento,
         floor(extensions.st_x(u.g) / cfg.tam)::bigint as ix,
         floor(extensions.st_y(u.g) / cfg.tam)::bigint as iy,
         cfg.tam
  from public.reportes r
  cross join cfg
  cross join lateral (
    select extensions.st_transform(r.ubicacion::extensions.geometry, 32613) as g
  ) u
  where r.estado = 'activo'
),
sies as (
  select c.reporte_id, count(*) filter (where c.sigue) as n
  from public.confirmaciones c
  where c.reporte_id in (select id from activos)
  group by c.reporte_id
),
celdas as (
  select a.ix, a.iy, a.tam,
         count(*)::integer                     as total_reportes,
         coalesce(sum(s.n), 0)::integer        as total_confirmaciones,
         bool_or(not a.pasan_carros)           as alguno_no_pasan_carros,
         max(a.momento)                        as actualizado_en
  from activos a
  left join sies s on s.reporte_id = a.id
  group by a.ix, a.iy, a.tam
)
select c.ix || '_' || c.iy                                              as celda,
       extensions.st_y(ctr.p)                                           as lat,
       extensions.st_x(ctr.p)                                           as lng,
       c.total_reportes,
       c.total_confirmaciones,
       public.nivel_para(c.total_reportes, c.alguno_no_pasan_carros)    as nivel,
       c.alguno_no_pasan_carros,
       c.actualizado_en
from celdas c
cross join lateral (
  select extensions.st_transform(
           extensions.st_setsrid(
             extensions.st_makepoint((c.ix + 0.5) * c.tam, (c.iy + 0.5) * c.tam), 32613),
           4326) as p
) ctr;

grant select on public.zonas_publicas to anon, authenticated;
