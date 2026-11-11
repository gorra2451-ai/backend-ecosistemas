-- D-024 · TEMPORAL mid-fi: tumbar un reporte debe costar al menos lo mismo que publicarlo.
-- Con 3 marcas de falso, 3 sesiones anónimas mandaban cualquier reporte (incluida persona_en_riesgo)
-- a en_revision, y la nube no tiene administradores para restaurarlo. Publicar exige 5 "sí" + autor.
-- Se revierte junto con D-022 al cerrar el testeo, cuando exista tope por identidad en marcar_falso.
update public.parametros set valor = 6,
       descripcion = 'Marcas de falso que mandan un reporte a en_revision. TEMPORAL mid-fi (D-024): 6; normal 3'
 where clave = 'banderas_para_revision';
