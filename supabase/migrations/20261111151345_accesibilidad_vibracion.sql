-- D-027: el perfil anónimo guarda también la vibración (se puede apagar). Antes solo `daltonismo`.
-- guardar_accesibilidad ahora MEZCLA: guardar una opción no borra la otra.
alter table public.perfiles drop constraint perfiles_accesibilidad_valida;
alter table public.perfiles add constraint perfiles_accesibilidad_valida check (
  jsonb_typeof(accesibilidad) = 'object'
  and accesibilidad - 'daltonismo' - 'vibracion' = '{}'::jsonb
  and (not (accesibilidad ? 'daltonismo') or jsonb_typeof(accesibilidad -> 'daltonismo') = 'boolean')
  and (not (accesibilidad ? 'vibracion') or jsonb_typeof(accesibilidad -> 'vibracion') = 'boolean')
);

create or replace function public.guardar_accesibilidad(prefs jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'sin_sesion';
  end if;
  if prefs is null or jsonb_typeof(prefs) <> 'object'
     or prefs - 'daltonismo' - 'vibracion' <> '{}'::jsonb
     or ((prefs ? 'daltonismo') and jsonb_typeof(prefs -> 'daltonismo') <> 'boolean')
     or ((prefs ? 'vibracion') and jsonb_typeof(prefs -> 'vibracion') <> 'boolean') then
    raise exception 'parametros_invalidos';
  end if;

  update public.perfiles set accesibilidad = accesibilidad || prefs where id = v_uid;
end $$;
revoke execute on function public.guardar_accesibilidad(jsonb) from public, anon;
grant execute on function public.guardar_accesibilidad(jsonb) to authenticated;
