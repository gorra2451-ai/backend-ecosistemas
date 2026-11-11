// Módulo E · Web Push en el navegador. Sin llave VAPID o sin soporte (iPhone sin instalar) no rompe:
// regresa { ok:false, motivo:'no_disponible' } y la pantalla explica que llega en la siguiente versión.
import { suscribirPush, bajaPush } from './api.js'
import { base64UrlABytes } from './ayuda.js'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const pushDisponible = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID

async function registro() {
  return (await navigator.serviceWorker.getRegistration('/')) || navigator.serviceWorker.register('/sw.js')
}

export async function suscripcionActual() {
  if (!pushDisponible()) return null
  try { return await (await registro()).pushManager.getSubscription() } catch { return null }
}

export async function activarPush(municipio) {
  if (!pushDisponible()) return { ok: false, motivo: 'no_disponible' }
  try {
    if ('Notification' in window && Notification.permission !== 'granted') {
      const p = await Notification.requestPermission()
      if (p !== 'granted') return { ok: false, motivo: 'sin_permiso' }
    }
    const reg = await registro()
    await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription())
      || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlABytes(VAPID) }))
    const { error } = await suscribirPush(sub, municipio)
    if (error) return { ok: false, motivo: error }
    return { ok: true }
  } catch {
    return { ok: false, motivo: 'no_disponible' }
  }
}

export async function desactivarPush() {
  const sub = await suscripcionActual()
  if (!sub) return { ok: true }
  await bajaPush(sub.endpoint)
  try { await sub.unsubscribe() } catch { /* ya no existe */ }
  return { ok: true }
}
