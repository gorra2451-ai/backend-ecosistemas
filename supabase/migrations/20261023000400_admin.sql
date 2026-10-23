-- =============================================================================
-- Admin (F5-T1): ocultar y restaurar reportes, cola de revisión. Cada acción
-- exitosa queda en acciones_admin en la misma transacción. Ver REGLAS_NEGOCIO §8.
-- =============================================================================

-- Validación común: admin + motivo. Sin grant: solo la usan las RPC de abajo.
create function public.validar_accion_admin(p_motivo text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'no_autorizado';
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'motivo_requerido';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- ocultar_reporte: cualquier estado -> oculto (sale del mapa).
-- -----------------------------------------------------------------------------
create function public.ocultar_reporte(p_reporte_id uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.validar_accion_admin(p_motivo);

  perform 1 from public.reportes where id = p_reporte_id for update;
  if not found then
    raise exception 'reporte_no_existe';
  end if;

  update public.reportes set estado = 'oculto' where id = p_reporte_id;

  insert into public.acciones_admin (admin_id, accion, objetivo_tabla, objetivo_id, motivo)
  values ((select auth.uid()), 'ocultar_reporte', 'reportes', p_reporte_id::text, trim(p_motivo));

  return jsonb_build_object('reporte_id', p_reporte_id, 'estado', 'oculto');
end $$;
grant execute on function public.ocultar_reporte(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- restaurar_reporte: en_revision|oculto -> activo. Reinicia el reloj de expiración.
-- -----------------------------------------------------------------------------
create function public.restaurar_reporte(p_reporte_id uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_estado    public.estado_reporte;
  v_resuelto  timestamptz;
begin
  perform public.validar_accion_admin(p_motivo);

  select estado, resuelto_en into v_estado, v_resuelto from public.reportes where id = p_reporte_id for update;
  if not found then
    raise exception 'reporte_no_existe';
  end if;
  -- Un oculto que ya estaba resuelto no se revive (pondría una inundación vieja en el mapa).
  if v_estado not in ('en_revision', 'oculto') or v_resuelto is not null then
    raise exception 'estado_invalido';
  end if;

  -- La decisión del admin borra las banderas anteriores: si no, un solo falso más lo regresaría a revisión.
  update public.confirmaciones set falso = false where reporte_id = p_reporte_id and falso;

  update public.reportes
     set estado = 'activo',
         ultima_confirmacion = clock_timestamp(),   -- después de limpiar banderas: votos previos no cuentan
         activado_en = coalesce(activado_en, now()),
         resuelto_en = null
   where id = p_reporte_id;

  insert into public.acciones_admin (admin_id, accion, objetivo_tabla, objetivo_id, motivo)
  values ((select auth.uid()), 'restaurar_reporte', 'reportes', p_reporte_id::text, trim(p_motivo));

  return jsonb_build_object('reporte_id', p_reporte_id, 'estado', 'activo');
end $$;
grant execute on function public.restaurar_reporte(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- reportes_en_revision: cola del panel (en_revision y oculto). Sin perfil_id.
-- -----------------------------------------------------------------------------
create function public.reportes_en_revision()
returns table (
  id                   uuid,
  tipo                 public.tipo_reporte,
  lat                  double precision,
  lng                  double precision,
  estado               public.estado_reporte,
  total_falsos         integer,
  total_confirmaciones integer,
  creado_en            timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'no_autorizado';
  end if;

  return query
  select r.id,
         r.tipo,
         extensions.st_y(r.ubicacion::extensions.geometry),
         extensions.st_x(r.ubicacion::extensions.geometry),
         r.estado,
         (select count(*) from public.confirmaciones c where c.reporte_id = r.id and c.falso)::integer,
         (select count(*) from public.confirmaciones c where c.reporte_id = r.id and c.sigue)::integer,
         r.creado_en
    from public.reportes r
   where r.estado in ('en_revision', 'oculto')
   order by r.creado_en desc;
end $$;
grant execute on function public.reportes_en_revision() to authenticated;

-- -----------------------------------------------------------------------------
-- Permisos. El default privileges de la base es por schema y NO quita el EXECUTE
-- global a PUBLIC (en defaults por schema Postgres solo suma), así que se revoca
-- explícito aquí: anon no ejecuta nada de admin.
-- -----------------------------------------------------------------------------
revoke execute on function public.validar_accion_admin(text) from public, anon, authenticated;
revoke execute on function public.ocultar_reporte(uuid, text) from public, anon;
revoke execute on function public.restaurar_reporte(uuid, text) from public, anon;
revoke execute on function public.reportes_en_revision() from public, anon;
