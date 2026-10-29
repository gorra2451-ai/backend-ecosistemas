-- F4-T3: carga manual de avisos meteorológicos con fuente verificable.
-- Sin fuente oficial acordada (P-06), no se insertan alertas de producción.
create type public.nivel_alerta_clima as enum ('bajo', 'medio', 'alto');
create table public.alertas_clima (
  id uuid primary key default gen_random_uuid(),
  fuente text not null check (length(trim(fuente)) between 3 and 200),
  fuente_url text not null check (length(fuente_url) between 12 and 500
    and fuente_url ~ '^https://[^[:space:]]+$'),
  nivel public.nivel_alerta_clima not null,
  titulo text not null check (length(trim(titulo)) between 3 and 100),
  descripcion text not null check (length(trim(descripcion)) between 3 and 1000),
  municipio text not null check (length(trim(municipio)) between 2 and 100),
  vigente_desde timestamptz not null,
  vigente_hasta timestamptz not null,
  verificado_en timestamptz,
  creado_en timestamptz not null default now(),
  constraint alerta_intervalo_valido check (vigente_hasta > vigente_desde)
);
create index alertas_clima_vigentes_idx on public.alertas_clima
  (municipio, vigente_hasta) where verificado_en is not null;
alter table public.alertas_clima enable row level security;
revoke all on public.alertas_clima from public, anon, authenticated;
grant select on public.alertas_clima to anon, authenticated;
create policy alertas_clima_lectura on public.alertas_clima
  for select to anon, authenticated using (
    verificado_en is not null and verificado_en <= now()
    and vigente_desde <= now() and vigente_hasta > now());
create view public.alertas_clima_vigentes with (security_invoker = true) as
select id, fuente, fuente_url, nivel, titulo, descripcion, municipio,
  vigente_desde, vigente_hasta, verificado_en
from public.alertas_clima
where verificado_en is not null and verificado_en <= now()
  and vigente_desde <= now() and vigente_hasta > now();
revoke all on public.alertas_clima_vigentes from public, anon, authenticated;
grant select on public.alertas_clima_vigentes to anon, authenticated;

-- El escáner de alertas vigentes encola por municipio; un índice impide repetir
-- la misma alerta para un dispositivo incluso con dos ejecuciones concurrentes.
alter table public.avisos_push alter column celda drop not null;
alter table public.avisos_push add column municipio text;
alter table public.avisos_push add column alerta_clima_id uuid
  references public.alertas_clima(id) on delete cascade;
alter table public.avisos_push add constraint aviso_ambito_unico
  check ((celda is not null) <> (municipio is not null));
alter table public.avisos_push add constraint aviso_clima_ambito
  check ((tipo = 'clima') = (alerta_clima_id is not null and municipio is not null));
create unique index avisos_clima_entrega_unica_idx on public.avisos_push
  (alerta_clima_id, suscripcion_id) where alerta_clima_id is not null;
create index avisos_push_municipio_historial_idx on public.avisos_push
  (suscripcion_id, municipio, creado_en desc) where municipio is not null;

create or replace function private.encolar_alertas_clima_vigentes() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_total integer := 0;
  v_filas integer;
  v_intervalo interval := public.param('minutos_entre_avisos') * interval '1 minute';
  a record;
  s record;
begin
  for a in select id, municipio, titulo, descripcion from public.alertas_clima
    where verificado_en is not null and verificado_en <= now()
      and vigente_desde <= now() and vigente_hasta > now()
    order by id
  loop
    for s in select id from public.suscripciones_push
      where municipio = lower(trim(a.municipio)) order by id for update
    loop
      if not exists (select 1 from public.avisos_push x
          where x.alerta_clima_id = a.id and x.suscripcion_id = s.id)
        and not exists (select 1 from public.avisos_push x
          where x.suscripcion_id = s.id and x.municipio = lower(trim(a.municipio))
            and x.creado_en > now() - v_intervalo)
      then
        insert into public.avisos_push
          (suscripcion_id, municipio, alerta_clima_id, tipo, titulo, mensaje)
        values (s.id, lower(trim(a.municipio)), a.id, 'clima', a.titulo,
          left(a.descripcion, 240))
        on conflict do nothing;
        get diagnostics v_filas = row_count;
        v_total := v_total + v_filas;
      end if;
    end loop;
  end loop;
  return v_total;
end $$;
revoke execute on function private.encolar_alertas_clima_vigentes()
  from public, anon, authenticated;
select cron.schedule('encolar-alertas-clima', '* * * * *',
  'select private.encolar_alertas_clima_vigentes()');
