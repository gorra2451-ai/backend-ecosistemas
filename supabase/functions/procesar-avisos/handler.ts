import { contextoServidor, igualConstante, json, type Entorno } from '../_shared/servidor.ts'
type Aviso = { id: string; suscripcion_id: string; titulo: string; mensaje: string; token_reclamo: string }
export function crearHandler(env: Entorno, solicitar: typeof fetch = fetch) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405)
    const contexto = contextoServidor(env)
    if (!contexto) return json({ error: 'servicio_no_configurado' }, 503)
    const { key, url, headers } = contexto
    if (!igualConstante(req.headers.get('apikey') ?? '', key)) return json({ error: 'no_autorizado' }, 401)
    let avisos: Aviso[]
    try {
      const tomar = await solicitar(`${url}/rest/v1/rpc/tomar_avisos_push`, {
        method: 'POST', headers, body: JSON.stringify({ p_lote: 5 }), signal: AbortSignal.timeout(5000),
      })
      if (!tomar.ok) return json({ error: 'cola_no_disponible' }, 502)
      avisos = await tomar.json()
      if (!Array.isArray(avisos)) throw new Error()
    } catch { return json({ error: 'cola_no_disponible' }, 502) }
    const resultados = await Promise.all(avisos.map(async (a) => {
      let exito = false, descartado = false
      try {
        const envio = await solicitar(`${url}/functions/v1/enviar-push`, {
          method: 'POST', headers,
          body: JSON.stringify({ suscripcion_id: a.suscripcion_id,
            titulo: a.titulo, mensaje: a.mensaje, tag: a.id }), signal: AbortSignal.timeout(15000),
        })
        exito = envio.ok
        if (envio.status === 410 || envio.status === 404) {
          const motivo = await envio.json()
          descartado = motivo.motivo === 'suscripcion_caducada' || motivo.error === 'suscripcion_no_existe'
        }
      } catch { /* Registrar fallo; la concesión permite recuperar trabajos interrumpidos. */ }
      try {
        const cierre = await solicitar(`${url}/rest/v1/rpc/finalizar_aviso_push`, {
          method: 'POST', headers, signal: AbortSignal.timeout(5000),
          body: JSON.stringify({ p_id: a.id, p_token: a.token_reclamo, p_exito: exito,
            p_descartado: descartado }),
        })
        // La FK puede haber borrado la entrega al caducar la suscripción.
        return { cerrado: cierre.ok && (await cierre.json() === true || descartado), exito, descartado }
      } catch { return { cerrado: false, exito, descartado } }
    }))
    if (resultados.some(r => !r.cerrado)) return json({ error: 'cierre_incompleto' }, 502)
    return json({ procesados: resultados.length, enviados: resultados.filter(r => r.exito).length,
      descartados: resultados.filter(r => r.descartado).length,
      reintentos: resultados.filter(r => !r.exito && !r.descartado).length })
  }
}
