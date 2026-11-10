// Íconos de línea del design system (viewBox 24, stroke currentColor). Siempre acompañados de texto.
const P = {
  calle: <path d="M3 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0M8 3L6 9M16 3l2 6" />,
  casa: <path d="M3 11l9-7 9 7M5 10v10h14V10M8 17c1.3-1 2.7-1 4 0s2.7 1 4 0" />,
  coche: <path d="M4 16l1.6-5.4A2 2 0 0 1 7.5 9h9a2 2 0 0 1 1.9 1.6L20 16M3 16h18v3H3zM2 21c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />,
  riesgo: <><circle cx="12" cy="5" r="2" /><path d="M12 7v6M8 10l4-2 4 2M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /></>,
  mapa: <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14" />,
  lista: <path d="M4 6h16M4 12h16M4 18h10" />,
  refugio: <path d="M3 21h18M5 21V9l7-5 7 5v12M10 21v-6h4v6" />,
  alerta: <path d="M12 3l10 18H2zM12 10v5M12 18v.5" />,
  error: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></>,
  atras: <path d="M15 5l-7 7 7 7" />,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  compartir: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.3 10.8l7.4-3.6M8.3 13.2l7.4 3.6" /></>,
  telefono: <path d="M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  accesibilidad: <><circle cx="12" cy="4.5" r="1.8" /><path d="M5 8.5l7 1.8 7-1.8M12 10.3v4.2M8.8 21l3.2-6.5 3.2 6.5" /></>,
  ajustes: <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>,
  mas: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12l5 5L20 7" />,
  centrar: <><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  pin: <><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  lluvia: <><path d="M7 15a4 4 0 0 1 .5-8 5 5 0 0 1 9.5 1.5A3.5 3.5 0 0 1 17 15z" /><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" /></>,
  escudo: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  campana: <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />,
  voz: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" /></>,
  peaton: <><circle cx="13" cy="4" r="2" /><path d="M10 21l2-6 3 2v4M8 12l3-4 4 1 2 4M11 15l-1-4" /></>,
  moto: <><circle cx="5.5" cy="17" r="3" /><circle cx="18.5" cy="17" r="3" /><path d="M8.5 17H14l3-6h-3L12 8H9M17 11l1.5 6" /></>,
  bici: <><circle cx="6" cy="17" r="3.5" /><circle cx="18" cy="17" r="3.5" /><path d="M6 17l4-8h5l3 8M10 9l3 8M14 6h3" /></>,
  auto: <path d="M4 16l1.6-5.4A2 2 0 0 1 7.5 9h9a2 2 0 0 1 1.9 1.6L20 16M3 16h18v3H3z" />,
  transporte_publico: <><rect x="5" y="3" width="14" height="15" rx="2" /><path d="M5 11h14M8 21v-3M16 21v-3" /></>,
  camara: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
}

export default function Icon({ name, size = 24, stroke = 2.2, label, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }}
      aria-hidden={label ? undefined : 'true'} role={label ? 'img' : undefined} aria-label={label}>
      {P[name] || P.error}
    </svg>
  )
}

export function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="¡Aguas!">
      <rect x="2" y="2" width="60" height="60" rx="18" fill="var(--s1)" stroke="var(--acc)" strokeWidth="3" />
      <path d="M8 36c6-5 12-5 18 0s12 5 18 0 10-5 12-3v19a10 10 0 0 1-10 10H18A10 10 0 0 1 8 52z" fill="var(--acc)" />
    </svg>
  )
}
