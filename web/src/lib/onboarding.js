// Lógica del módulo A (Primera vez). Sin JSX para poder probarla sola.

// Los 6 municipios que muestra el canvas (Avisos). Nombres cortos, como en la app.
export const MUNICIPIOS_ZMG = ['Guadalajara', 'Zapopan', 'Tlaquepaque', 'Tonalá', 'Tlajomulco', 'El Salto']

// Ronda 3: opciones, orden y consejos del Equipo Registro. 'moto' ya existe en medio_transporte (contrato v2).
export const MEDIOS = [
  { id: 'peaton', titulo: 'Caminando (peatón)', tip: 'Con agua en movimiento es fácil perder el equilibrio. Te mostramos calles más seguras a pie.' },
  { id: 'moto', titulo: 'Motocicleta', tip: 'Con agua se pierde tracción y no se ven los baches. Te avisamos qué zonas evitar.' },
  { id: 'bici', titulo: 'Bicicleta', tip: 'El agua esconde baches y alcantarillas. Te sugerimos rutas más altas.' },
  { id: 'auto', titulo: 'Automóvil', tip: 'Con unos 30 cm de agua un auto puede flotar. Te avisamos qué calles evitar.' },
  { id: 'transporte_publico', titulo: 'Transporte público', tip: 'Las rutas pueden cambiar o suspenderse. Te avisamos con tiempo.' },
]
export const tituloMedio = (id) => MEDIOS.find((m) => m.id === id)?.titulo || 'sin elegir'

// Ajustes de accesibilidad del paso 4 (Equipo Registro), con los mismos valores que usa el Módulo E:
// 'grande' y 'dalton' viven en prefs.a11y; 'voz' es prefs.voz (booleano).
export const AJUSTES_A11Y = [
  { k: 'grande', titulo: 'Texto grande', desc: 'Letras más grandes en toda la app.' },
  { k: 'voz', titulo: 'Modo voz', desc: 'La app lee en voz alta las alertas.' },
  { k: 'dalton', titulo: 'Modo para daltonismo', desc: 'Cambia los colores del mapa para que se distingan mejor.' },
  { k: 'vibra', titulo: 'Vibración', desc: 'El teléfono vibra un poco al tocar (solo Android).' },
]
export const a11yActivo = (prefs, k) => (k === 'voz' ? !!prefs?.voz : k === 'vibra' ? prefs?.vibra !== false : (prefs?.a11y || []).includes(k))
export function alternarA11y(prefs, k) {
  const p = prefs || {}
  const v = !a11yActivo(p, k)
  if (k === 'voz') return { ...p, voz: v }
  if (k === 'vibra') return { ...p, vibra: v }
  const a = p.a11y || []
  return { ...p, a11y: v ? [...a, k] : a.filter((x) => x !== k) }
}
// "texto grande, modo voz" o "ninguna activada" (resumen final del equipo)
export function resumenA11y(prefs) {
  const n = { grande: 'texto grande', voz: 'modo voz', dalton: 'daltonismo' }
  return AJUSTES_A11Y.filter((a) => n[a.k] && a11yActivo(prefs, a.k)).map((a) => n[a.k]).join(', ') || 'ninguna activada'
}

// "#A7F3B2": 6 primeros caracteres del id de la sesión anónima, en mayúsculas. null si no hay sesión.
export function idCorto(session) {
  const id = session?.user?.id
  return typeof id === 'string' && id.length >= 6 ? '#' + id.slice(0, 6).toUpperCase() : null
}

// ¿Ya terminó la primera vez? (misma llave que store.jsx)
export function yaEntro() {
  try { return JSON.parse(localStorage.getItem('aguas.onboarded') || 'false') === true } catch { return false }
}

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

// ---------- Privacidad y permisos (testeo de usabilidad: 5 de 10 no encontraron cómo cambiar el permiso) ----------
// Estados: permitido · bloqueado · sin_decidir · no_soportado · desconocido (el navegador no dice).
export function normalizarPermiso(v) {
  if (v === 'granted') return 'permitido'
  if (v === 'denied') return 'bloqueado'
  if (v === 'prompt' || v === 'default') return 'sin_decidir'
  return 'desconocido'
}
const TEXTOS_PERMISO = {
  permitido: 'Permitido',
  bloqueado: 'No permitido',
  sin_decidir: 'Sin decidir',
  no_soportado: 'No disponible en este navegador',
  desconocido: 'Tu navegador no lo indica',
}
export const textoPermiso = (estado) => TEXTOS_PERMISO[estado] || TEXTOS_PERMISO.desconocido

export async function leerPermisoUbicacion(
  perms = typeof navigator !== 'undefined' ? navigator.permissions : undefined,
  geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined,
) {
  if (!geo) return 'no_soportado'
  try { return perms ? normalizarPermiso((await perms.query({ name: 'geolocation' })).state) : 'desconocido' } catch { return 'desconocido' }
}

// Notification.permission es síncrono y más confiable que permissions.query({name:'notifications'}) en Safari.
export function leerPermisoAvisos(N = typeof window !== 'undefined' ? window.Notification : undefined) {
  if (!N) return 'no_soportado'
  return normalizarPermiso(N.permission)
}

// Cómo cambiarlo cuando el navegador ya no vuelve a preguntar (bloqueado) o para quitarlo (permitido).
export const COMO_CAMBIAR = {
  ubicacion: [
    { donde: 'iPhone (Safari)', pasos: 'Toca "aA" en la barra de dirección › Configuración del sitio web › Ubicación › Permitir. Si sigue sin funcionar: Ajustes › Privacidad y seguridad › Localización › Sitios web de Safari.' },
    { donde: 'Android (Chrome)', pasos: 'Toca el ícono a la izquierda de la dirección › Permisos › Ubicación › Permitir. Revisa también que la ubicación del teléfono esté encendida.' },
  ],
  avisos: [
    { donde: 'iPhone (Safari)', pasos: 'Los avisos solo funcionan si agregas ¡Aguas! a tu pantalla de inicio (Compartir › Agregar a inicio). Después: Ajustes › Notificaciones › ¡Aguas!.' },
    { donde: 'Android (Chrome)', pasos: 'Toca el ícono a la izquierda de la dirección › Permisos › Notificaciones › Permitir.' },
  ],
}

// Botón "Atrás" de una pantalla: si la app abrió esta pantalla desde otra (historial propio, lib/historial.js),
// regresa a esa; si se entró directo, va al respaldo (mapa por omisión).
export function volverAtras(h = typeof window !== 'undefined' ? window.history : undefined, ir, respaldo = null) {
  if (Number(h?.state?.aguasD) > 0) { try { h.back(); return } catch { /* sin historial */ } }
  ir(respaldo)
}
