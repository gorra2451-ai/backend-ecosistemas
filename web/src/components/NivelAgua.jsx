// Dibujo "¿hasta dónde llega el agua?" (D-028): referencia FIJA (banqueta y llanta de un carro), no la estatura de
// quien reporta, para que Bajo/Medio/Alto signifiquen lo mismo para todos.
const AGUA_Y = { bajo: 50, medio: 39, alto: 22 } // y de la superficie del agua (piso en 58)

export default function NivelAgua({ nivel = 'bajo', size = 72 }) {
  const y = AGUA_Y[nivel] ?? AGUA_Y.bajo
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 90 72" aria-hidden="true" style={{ flex: 'none' }}>
      {/* banqueta */}
      <rect x="2" y="46" width="22" height="12" rx="1.5" fill="var(--s2)" stroke="var(--mu)" strokeWidth="1.5" />
      {/* carro: carrocería + llanta */}
      <path d="M34 40l6-12h26l8 12z" fill="none" stroke="var(--tx)" strokeWidth="2.4" strokeLinejoin="round" />
      <rect x="30" y="40" width="54" height="8" rx="3" fill="none" stroke="var(--tx)" strokeWidth="2.4" />
      <circle cx="46" cy="50" r="8" fill="var(--bg)" stroke="var(--tx)" strokeWidth="2.4" />
      <circle cx="72" cy="50" r="8" fill="var(--bg)" stroke="var(--tx)" strokeWidth="2.4" />
      {/* agua */}
      <rect x="0" y={y} width="90" height={58 - y} fill="var(--acc)" opacity="0.45" />
      <path d={`M0 ${y}q7.5-4 15 0t15 0 15 0 15 0 15 0 15 0`} fill="none" stroke="var(--acc)" strokeWidth="2.4" />
      <line x1="0" y1="58" x2="90" y2="58" stroke="var(--mu)" strokeWidth="2" />
    </svg>
  )
}
