-- =============================================================================
-- seed.sql (F1-T5) — DATOS FALSOS DE PRUEBA. NADA DE ESTO OCURRIÓ.
-- Sirve para que los equipos de front vean el mapa, zonas y el panel admin sin
-- esperar lluvia. Usuarios, reportes y votos son inventados.
-- Las ubicaciones son cruces conocidos de la ZMG con coordenadas APROXIMADAS
-- (no son puntos de inundación reales ni verificados).
-- Idempotente: se puede correr varias veces (on conflict do nothing).
-- Tiempos relativos a now(): los activos expiran solos a los ~30 min
-- (minutos_expiracion) y los pendientes a los ~60 min (ventana_activacion_min).
-- Los pendientes están a > 150 m de cualquier otro reporte pendiente/activo para
-- que el trigger de activación no los agrupe.
-- =============================================================================

-- Usuarios falsos: 8 anónimos (autores/votantes) + 1 admin de prueba.
insert into auth.users (id, aud, role, is_anonymous) values
  ('5eed0000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', true),
  ('5eed0000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', true),
  ('5eed0000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', true),
  ('5eed0000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', true),
  ('5eed0000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', true),
  ('5eed0000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', true),
  ('5eed0000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', true),
  ('5eed0000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', true),
  ('5eed0000-0000-0000-0000-0000000000ad', 'authenticated', 'authenticated', false)
on conflict do nothing;

insert into public.administradores (perfil_id) values
  ('5eed0000-0000-0000-0000-0000000000ad')
on conflict do nothing;

-- Reportes. Columnas de tiempo: minutos hacia atrás desde now() (null = sin valor).
insert into public.reportes
  (id, perfil_id, tipo, pasan_carros, ubicacion, estado, creado_en, activado_en, ultima_confirmacion, resuelto_en)
select ('5eed1000-0000-0000-0000-0000000000' || v.n)::uuid,
       ('5eed0000-0000-0000-0000-00000000000' || v.autor)::uuid,
       v.tipo::public.tipo_reporte,
       v.pasan_carros,
       public.punto(v.lat, v.lng),
       v.estado::public.estado_reporte,
       now() - make_interval(mins => v.m_creado),
       now() - make_interval(mins => v.m_activado),
       now() - make_interval(mins => v.m_ultima),
       now() - make_interval(mins => v.m_resuelto)
from (values
  -- n,   autor, tipo,                pasan, lat,      lng,       estado,        creado, activado, ultima, resuelto
  -- ACTIVOS: grupo Minerva (Av. López Mateos y Av. Vallarta, Guadalajara)
  ('01', 1, 'calle',             true,  20.6744, -103.3887, 'activo',       40,  35,   5,    null::int),
  ('02', 2, 'calle',             false, 20.6748, -103.3893, 'activo',       38,  35,   6,    null),
  ('03', 3, 'coche',             false, 20.6740, -103.3881, 'activo',       37,  35,   8,    null),
  ('04', 4, 'calle',             true,  20.6751, -103.3884, 'activo',       36,  35,   10,   null),
  ('05', 5, 'casa',              false, 20.6737, -103.3892, 'activo',       35,  35,   12,   null),
  -- ACTIVOS: grupo Av. López Mateos y Av. Lázaro Cárdenas (Zapopan)
  ('06', 2, 'calle',             true,  20.6425, -103.4040, 'activo',       30,  25,   4,    null),
  ('07', 3, 'calle',             false, 20.6429, -103.4045, 'activo',       28,  25,   7,    null),
  ('08', 6, 'coche',             true,  20.6421, -103.4036, 'activo',       26,  25,   9,    null),
  -- ACTIVOS: Centro de Tlaquepaque (Av. Independencia y Av. Juárez)
  ('09', 1, 'calle',             true,  20.6405, -103.3115, 'activo',       25,  20,   3,    null),
  ('10', 4, 'casa',              true,  20.6409, -103.3119, 'activo',       22,  20,   6,    null),
  -- ACTIVOS sueltos
  ('11', 7, 'persona_en_riesgo', false, 20.6243, -103.2340, 'activo',       15,  15,   2,    null),  -- Centro de Tonalá
  ('12', 5, 'calle',             true,  20.6745, -103.3475, 'activo',       20,  18,   5,    null),  -- Av. Juárez y 16 de Septiembre
  ('13', 8, 'calle',             false, 20.6400, -103.3330, 'activo',       24,  20,   11,   null),  -- Lázaro Cárdenas y González Gallo
  ('14', 6, 'calle',             true,  20.6930, -103.3480, 'activo',       19,  17,   4,    null),  -- Av. Alcalde y Circunvalación
  ('15', 7, 'coche',             true,  20.7215, -103.3915, 'activo',       21,  19,   13,   null),  -- Centro de Zapopan
  ('16', 8, 'calle',             true,  20.6000, -103.3600, 'activo',       18,  16,   6,    null),  -- Periférico Sur y Av. 8 de Julio
  ('17', 6, 'calle',             true,  20.7310, -103.3770, 'activo',       23,  21,   8,    null),  -- Periférico Norte y Av. Laureles
  -- PENDIENTES (todos a > 150 m de cualquier pendiente/activo; ninguno persona_en_riesgo)
  ('18', 1, 'calle',             true,  20.7045, -103.4105, 'pendiente',    10,  null, null, null),  -- Av. Patria y Av. Acueducto
  ('19', 2, 'casa',              true,  20.6688, -103.3700, 'pendiente',    12,  null, null, null),  -- Av. Niños Héroes y Av. Chapultepec
  ('20', 3, 'calle',             true,  20.6797, -103.4369, 'pendiente',    8,   null, null, null),  -- Av. Vallarta y Periférico Poniente
  ('21', 4, 'coche',             true,  20.6460, -103.2700, 'pendiente',    14,  null, null, null),  -- Periférico Oriente y Av. Río Nilo
  ('22', 5, 'calle',             true,  20.5640, -103.4410, 'pendiente',    5,   null, null, null),  -- Av. Adolf Horn y López Mateos (Tlajomulco)
  ('23', 6, 'casa',              true,  20.6760, -103.3080, 'pendiente',    9,   null, null, null),  -- Av. Plutarco Elías Calles y Av. Javier Mina
  -- RESUELTOS (de hace unas horas)
  ('24', 7, 'calle',             true,  20.6496, -103.4013, 'resuelto',     300, 290,  200,  170),   -- Av. López Mateos y Av. Mariano Otero
  ('25', 8, 'calle',             false, 20.6950, -103.3540, 'resuelto',     280, 270,  240,  210),   -- Av. Federalismo y Circunvalación
  ('26', 1, 'casa',              true,  20.6680, -103.3390, 'resuelto',     260, 250,  220,  190),   -- Calz. Independencia y Av. Revolución
  ('27', 2, 'calle',             true,  20.7050, -103.3270, 'resuelto',     240, 230,  200,  170),   -- Calz. Independencia y Circunvalación
  ('28', 3, 'coche',             true,  20.6070, -103.3500, 'resuelto',     220, 210,  190,  160),   -- Av. Gobernador Curiel y Periférico Sur
  ('29', 4, 'calle',             true,  20.6385, -103.3650, 'resuelto',     200, 190,  170,  140),   -- Av. Colón y Av. Lázaro Cárdenas
  -- EN REVISIÓN (3 marcas de falso; para el panel admin)
  ('30', 5, 'calle',             true,  20.6950, -103.3750, 'en_revision',  50,  45,   30,   null)   -- Av. Ávila Camacho y Av. Américas
) as v(n, autor, tipo, pasan_carros, lat, lng, estado, m_creado, m_activado, m_ultima, m_resuelto)
on conflict do nothing;

-- Confirmaciones (nunca del autor del reporte). sigue=true es "sí sigue".
insert into public.confirmaciones (reporte_id, perfil_id, sigue, falso)
select ('5eed1000-0000-0000-0000-0000000000' || v.n)::uuid,
       ('5eed0000-0000-0000-0000-00000000000' || v.u)::uuid,
       v.sigue, v.falso
from (values
  ('01', 6, true,  false), ('01', 7, true,  false), ('01', 8, true,  false),
  ('02', 1, true,  false), ('02', 6, true,  false),
  ('03', 7, true,  false),
  ('04', 8, true,  false), ('04', 2, false, false),
  ('06', 1, true,  false), ('06', 4, true,  false),
  ('07', 8, true,  false),
  ('09', 5, true,  false), ('09', 2, true,  false),
  ('11', 1, true,  false), ('11', 2, true,  false), ('11', 3, true,  false),
  ('12', 6, true,  false),
  ('13', 1, false, false),
  ('14', 3, true,  false),
  ('15', 4, true,  false),
  ('16', 2, true,  false),
  ('17', 1, true,  false),
  ('24', 1, false, false), ('24', 2, false, false), ('24', 3, false, false),
  ('25', 3, true,  false),
  ('30', 1, false, true),  ('30', 2, false, true),  ('30', 3, false, true),  ('30', 4, true, false)
) as v(n, u, sigue, falso)
on conflict do nothing;
