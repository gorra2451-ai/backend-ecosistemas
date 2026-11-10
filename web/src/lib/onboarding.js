// Lógica del módulo A (Primera vez). Sin JSX para poder probarla sola.

// Los 6 municipios que muestra el canvas (Avisos). Nombres cortos, como en la app.
export const MUNICIPIOS_ZMG = ['Guadalajara', 'Zapopan', 'Tlaquepaque', 'Tonalá', 'Tlajomulco', 'El Salto']

// Nombres del Equipo Registro (ronda 2). Sin 'moto': no existe en el enum medio_transporte (P-28).
export const MEDIOS = [
  { id: 'peaton', titulo: 'Caminando', sub: 'Cruces de riesgo' },
  { id: 'bici', titulo: 'Bicicleta', sub: 'Cruces de riesgo' },
  { id: 'auto', titulo: 'Automóvil', sub: 'Modo manejo llega en la siguiente versión' },
  { id: 'transporte_publico', titulo: 'Transporte público', sub: 'Estado de tu zona' },
]

// Resuelve con { data:null, error:'sin_red' } si la promesa tarda más de `ms`: el onboarding nunca se traba.
export function conTiempo(promesa, ms = 5000) {
  let t
  const limite = new Promise((res) => { t = setTimeout(() => res({ data: null, error: 'sin_red' }), ms) })
  return Promise.race([Promise.resolve(promesa), limite]).finally(() => clearTimeout(t))
}

// Abre la sesión anónima y registra la visita con el medio elegido.
// Nunca lanza: regresa { error } (null si todo salió bien) para que la pantalla siga igual.
export async function entrarConMedio({ asegurarSesion, registrarEntrada }, medio, ms = 5000) {
  try {
    const s = await conTiempo(asegurarSesion(), ms)
    if (s?.error) return { error: s.error }
    const r = await conTiempo(registrarEntrada(medio), ms)
    return { error: r?.error || null }
  } catch {
    return { error: 'desconocido' }
  }
}

// Texto discreto para el toast cuando no se pudo registrar la entrada.
export function avisoEntrada(error) {
  if (!error) return null
  if (error === 'sin_red') return 'Sin conexión: entraste igual, sin registrar tu visita'
  if (error === 'limite_entradas') return 'Entraste igual; ya registramos varias visitas esta hora'
  return 'Entraste igual; no pudimos registrar tu visita'
}

// Resultado de pedir permiso de notificaciones. No suscribe push (eso es del módulo de Avisos).
export async function pedirPermisoAvisos(N = typeof window !== 'undefined' ? window.Notification : undefined) {
  if (!N || typeof N.requestPermission !== 'function') return 'no_soportado'
  try {
    const r = await N.requestPermission()
    return r === 'granted' ? 'concedido' : 'negado'
  } catch {
    return 'negado'
  }
}
