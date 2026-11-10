-- Capacidad de la cola y retención en el proveedor Web Push.
-- Estos valores se ajustan por migración; no forman parte de la configuración remota de Auth.
insert into public.parametros (clave, valor, descripcion) values
  ('lote_procesar_avisos', 20,
   'Avisos reclamados por ejecución de procesar-avisos (máximo de tomar_avisos_push)'),
  ('ttl_enviar_push_seg', 3600,
   'Segundos que el proveedor Web Push conserva el mensaje para un dispositivo desconectado');
