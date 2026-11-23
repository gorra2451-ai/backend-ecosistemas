// Apodos populares de la ZMG → nombre oficial que sí encuentra Nominatim (testeo de usabilidad:
// 16 de 20 personas obtuvieron "sin resultados" con "la Mine"). Solo lugares que existen con certeza;
// si dudas de uno, no lo agregues (AGENTS.md: no inventar datos). Coincidencia COMPLETA del texto,
// sin acentos ni mayúsculas: "minerva 2" no se toca.
export const normalizar = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

const MINERVA = 'Glorieta Minerva, Guadalajara'
const ARCOS = 'Los Arcos, Guadalajara'
const ESTAMPIDA = 'La Estampida, Zapopan'
const PARQUE_ROJO = 'Parque Revolución, Guadalajara'
const CENTRO = 'Centro Histórico, Guadalajara'
const AKRON = 'Estadio Akron, Zapopan'

export const ALIAS = {
  'la mine': MINERVA, mine: MINERVA, 'la minerva': MINERVA, minerva: MINERVA, 'glorieta la minerva': MINERVA,
  'los arcos': ARCOS, arcos: ARCOS,
  'la estampida': ESTAMPIDA, estampida: ESTAMPIDA,
  'parque rojo': PARQUE_ROJO, 'el parque rojo': PARQUE_ROJO,
  'el centro': CENTRO, 'centro de guadalajara': CENTRO, 'centro de gdl': CENTRO,
  'la catedral': 'Catedral de Guadalajara',
  'la expo': 'Expo Guadalajara',
  chapu: 'Avenida Chapultepec, Guadalajara',
  'el akron': AKRON, akron: AKRON,
  'el iteso': 'ITESO, Tlaquepaque',
}

// Texto que se manda a Nominatim: el nombre oficial si es apodo; si no, el mismo texto recortado.
export function resolverAlias(q) {
  return ALIAS[normalizar(q)] || String(q ?? '').trim()
}
