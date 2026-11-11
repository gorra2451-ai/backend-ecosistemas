-- D-022 · Parámetros temporales del mid-fi (testeo del 2026-11-11 en adelante).
-- Los testers reciben la liga por separado, en distintos puntos de la ZMG y a distintas horas:
-- con 1 km de radio, 60 min de ventana y 30 min de expiración casi ningún reporte llegaría a publicarse.
-- confirmaciones_para_publicar se queda en 5 (el copy del front lo dice).
-- TEMPORAL: se revierte con otra migración al cerrar el testeo (1000 / 60 / 30).
update public.parametros set valor = 40000,
       descripcion = 'Tope del radio en reportes_cercanos. TEMPORAL mid-fi (D-022): 40000 para ?prueba=1; normal 1000'
 where clave = 'radio_cercanos_max_m';
update public.parametros set valor = 1440,
       descripcion = 'Minutos para juntar confirmaciones_para_publicar; si no, pendiente -> resuelto. TEMPORAL mid-fi (D-022): 1440; normal 60'
 where clave = 'ventana_activacion_min';
update public.parametros set valor = 180,
       descripcion = 'Minutos sin confirmación para que un activo expire. TEMPORAL mid-fi (D-022): 180; normal 30'
 where clave = 'minutos_expiracion';
