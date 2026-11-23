// Pin del destino en el mapa (MapView · CentrarEn). Testeo: 9 de 20 se confundieron al cambiar de destino y
// el punto era negro sobre negro. Ahora: pin de acento con borde blanco + etiqueta con el nombre, alto contraste.
// El nombre viene de OpenStreetMap (texto de terceros): se escapa antes de meterlo al HTML del ícono.
export const escaparHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export const nombreCorto = (nombre, max = 28) => {
  const t = String(nombre || '').split(',')[0].trim()
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}

export function htmlDestino(nombre) {
  const t = escaparHtml(nombreCorto(nombre) || 'Destino')
  return '<div aria-label="Destino: ' + t + '" style="position:relative;width:28px;height:28px">'
    + '<div style="width:28px;height:28px;box-sizing:border-box;border-radius:50%;background:var(--acc);border:4px solid #fff;'
    + 'box-shadow:0 0 0 2px #05080F,0 4px 12px rgba(0,0,0,.5)"></div>'
    + '<div style="position:absolute;left:34px;top:50%;transform:translateY(-50%);white-space:nowrap;'
    + 'background:#fff;color:#05080F;border:2px solid #05080F;border-radius:10px;padding:3px 8px;'
    + 'font:800 14px/1.2 var(--f-body);box-shadow:0 4px 12px rgba(0,0,0,.45)">' + t + '</div></div>'
}
