// Service Worker de ¡Aguas! — solo avisos push (docs/API.md · Notificaciones).
// El payload trae { title, body, tag }: usamos `tag` para que un reintento reemplace al aviso anterior.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { body: e.data ? e.data.text() : '' } }
  const opts = { body: d.body || '', lang: 'es-MX' }
  if (d.tag) { opts.tag = d.tag; opts.renotify = false }
  e.waitUntil(self.registration.showNotification(d.title || '¡Aguas!', opts))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ls) => {
    const c = ls.find((w) => 'focus' in w)
    return c ? c.focus() : self.clients.openWindow('/')
  }))
})
