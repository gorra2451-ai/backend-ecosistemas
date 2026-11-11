import { describe, it, expect, vi } from 'vitest'
import { fetchConLimite } from './red.js'
import { codigoError } from './api.js'

describe('fetchConLimite (manejando con señal mala)', () => {
  it('corta una petición colgada en vez de esperar para siempre', async () => {
    const colgado = vi.fn((_u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(o.signal.reason))))
    const f = fetchConLimite(colgado, 50)
    await expect(f('https://x.supabase.co/rest/v1/rpc/crear_reporte', {})).rejects.toBeTruthy()
  })
  it('deja pasar las respuestas normales', async () => {
    const f = fetchConLimite(async () => 'ok', 50)
    expect(await f('https://x.supabase.co/rest/v1/rpc/x', {})).toBe('ok')
  })
  it('no corta subidas de fotos (Storage puede tardar más)', async () => {
    const lento = vi.fn((_u, o) => new Promise((res) => setTimeout(() => res(o.signal ? 'con' : 'sin'), 80)))
    expect(await fetchConLimite(lento, 20)('https://x.supabase.co/storage/v1/object/evidencias/a.jpg', {})).toBe('sin')
  })
  it('el corte por tiempo cuenta como sin señal → el reporte se guarda en la cola', async () => {
    const colgado = (_u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(o.signal.reason)))
    const e = await fetchConLimite(colgado, 10)('https://x/rest/v1/rpc/x', {}).catch((x) => x)
    expect(codigoError(e)).toBe('sin_red')
    expect(codigoError({ message: 'AbortError: The operation was aborted.' })).toBe('sin_red')
  })
})
