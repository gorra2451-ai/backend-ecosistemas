-- Comparación atómica de la versión caducada sin poner claves en URLs de logs HTTP.
create function public.baja_push_caducada(p_id uuid, p_endpoint text, p_p256dh text, p_auth text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  delete from public.suscripciones_push where id = p_id and endpoint = p_endpoint
    and p256dh = p_p256dh and auth = p_auth;
  return found;
end $$;
revoke execute on function public.baja_push_caducada(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.baja_push_caducada(uuid, text, text, text) to service_role;
