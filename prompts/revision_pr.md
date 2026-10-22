# Prompt · Revisión de PR (la otra persona revisa con su IA)

Revisa este PR del repo `backend-ecosistemas` contra `AGENTS.md`. Responde en lista:

1. ¿Hace solo lo que dice la tarea de `docs/PLAN.md`?
2. ¿Cambia el esquema? → ¿por migración nueva y sin editar migraciones viejas?
3. ¿Todas las tablas nuevas tienen RLS y políticas mínimas?
4. ¿Hay secretos, llaves o datos personales en el diff?
5. ¿Las reglas nuevas tienen prueba en `supabase/tests/`?
6. ¿Se actualizó `docs/API.md` si cambia algo que el front consume?
7. ¿Hay números de negocio escritos en el código en vez de `parametros`?
8. ¿Se actualizaron PLAN, PROGRESO y HANDOFF?

Termina con: Aprobar / Pedir cambios, y la lista de cambios concretos.
