import { crearHandler } from './handler.ts'
Deno.serve(crearHandler((nombre) => Deno.env.get(nombre)))
