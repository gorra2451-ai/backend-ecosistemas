// F4-T2: trabajador interno de la cola. Cada reclamo trae un token para que un
// trabajador atrasado no pueda cerrar un envío reclamado de nuevo.
type Aviso = {
  id: string
  suscripcion_id: string
  titulo: string
  mensaje: string
  token_reclamo: string
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8' },
})
function claveSecreta() {
  const actuales = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (actuales) {
    try { return (JSON.parse(actuales) as Record<string, string>).default }
    catch { /* Se devuelve 503 abajo. */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}
function igualConstante(a: string, b: string) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let distinto = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) distinto |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return distinto === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405)
  const key = claveSecreta()
  const url = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '')
  if (!key || !url) return json({ error: 'servicio_no_configurado' }, 503)
  if (!igualConstante(req.headers.get('apikey') ?? '', key)) {
    return json({ error: 'no_autorizado' }, 401)
  }
  const headers = { apikey: key, 'content-type': 'application/json' }
  const tomar = await fetch(`${url}/rest/v1/rpc/tomar_avisos_push`, {
    method: 'POST', headers, body: JSON.stringify({ p_lote: 5 }),
  })
  if (!tomar.ok) return json({ error: 'cola_no_disponible' }, 502)
  const avisos = await tomar.json() as Aviso[]
  const resultados = await Promise.all(avisos.map(async (a) => {
    let exito = false
    try {
      const envio = await fetch(`${url}/functions/v1/enviar-push`, {
        method: 'POST', headers,
        body: JSON.stringify({ suscripcion_id: a.suscripcion_id,
          titulo: a.titulo, mensaje: a.mensaje }),
        signal: AbortSignal.timeout(15000),
      })
      exito = envio.ok
    } catch { /* Se programa reintento abajo. */ }
    const cierre = await fetch(`${url}/rest/v1/rpc/finalizar_aviso_push`, {
      method: 'POST', headers,
      body: JSON.stringify({ p_id: a.id, p_token: a.token_reclamo, p_exito: exito }),
    })
    if (!cierre.ok) return { cerrado: false, exito: false }
    return { cerrado: await cierre.json() as boolean, exito }
  }))
  if (resultados.some(r => !r.cerrado)) return json({ error: 'cierre_incompleto' }, 502)
  return json({ procesados: resultados.length,
    enviados: resultados.filter(r => r.exito).length,
    reintentos: resultados.filter(r => !r.exito).length })
})
