// Piezas comunes. Usa las clases de styles/components.css; no inventes estilos nuevos si ya existe uno.
import Icon from './Icon.jsx'
import { useApp } from '../lib/store.jsx'

export function Screen({ children, titulo, paso, onBack, full = false, label }) {
  const { ir } = useApp()
  return (
    <section className={'screen' + (full ? ' full' : '')} aria-label={label || titulo}>
      <div className="screen-inner">
        {(titulo || onBack !== false) && (
          <header className="screen-head">
            {onBack !== false && (
              <button className="btn-icon" aria-label="Atrás" onClick={onBack || (() => ir(null))}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx)' }}>
                <Icon name="atras" />
              </button>
            )}
            <div style={{ flex: 1 }}>
              {paso && <div className="overline">{paso}</div>}
              {titulo && <h1>{titulo}</h1>}
            </div>
          </header>
        )}
        {children}
      </div>
    </section>
  )
}

export function Btn({ variant = '', icon, children, className = '', style, ...rest }) {
  return (
    <button className={`btn ${variant ? 'btn-' + variant : ''} ${className}`}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 16px', ...style }} {...rest}>
      {icon && <Icon name={icon} />}{children}
    </button>
  )
}

export function Toast() {
  const { toast } = useApp()
  if (!toast) return null
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      <div className="toast rise" style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Icon name="check" size={20} />{toast}</div>
    </div>
  )
}

export function PorConfirmar({ children = 'POR CONFIRMAR' }) {
  return <span className="tag-porconfirmar" style={{ fontFamily: 'var(--f-body)', fontWeight: 700, fontSize: 13 }}>{children}</span>
}
