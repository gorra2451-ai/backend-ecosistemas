// Comprueba cifrado Web Push/VAPID sin contactar a un proveedor externo.
import webpush from 'npm:web-push@3.6.7'

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
  .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')

Deno.test('la librería prepara un mensaje cifrado y firmado para el navegador', async () => {
  const receptor = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const publica = new Uint8Array(await crypto.subtle.exportKey('raw', receptor.publicKey))
  const auth = crypto.getRandomValues(new Uint8Array(16))
  const vapid = webpush.generateVAPIDKeys()
  const solicitud = webpush.generateRequestDetails({
    endpoint: 'https://fcm.googleapis.com/fcm/send/prueba-local',
    keys: { p256dh: base64url(publica), auth: base64url(auth) },
  }, JSON.stringify({ title: 'Prueba', body: 'Mensaje local' }), {
    vapidDetails: { subject: 'mailto:dev@example.invalid',
      publicKey: vapid.publicKey, privateKey: vapid.privateKey },
    TTL: 60,
  })
  if (!solicitud.body || solicitud.body.length === 0) {
    throw new Error('No se generó un cuerpo cifrado')
  }
  if (!solicitud.headers?.Authorization) {
    throw new Error('No se generó la autorización VAPID')
  }
})
