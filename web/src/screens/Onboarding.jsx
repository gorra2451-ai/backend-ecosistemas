// MÓDULO A · Primera vez (Equipo Registro). Pantallas: acceso, privacidad, ubicacion, avisos, onb.
// Copy y flujo de App.dc.html (DISENO.md §3a). En escritorio se ven como tarjeta centrada a pantalla completa.
import { useState } from 'react'
import { Screen, Btn, PorConfirmar } from '../components/ui.jsx'
import Icon, { Logo } from '../components/Icon.jsx'
import { useApp } from '../lib/store.jsx'
import { asegurarSesion, registrarEntrada } from '../lib/api.js'
import { MUNICIPIOS_ZMG, MEDIOS, entrarConMedio, avisoEntrada, pedirPermisoAvisos } from '../lib/onboarding.js'
import '../styles/onboarding.css'

const IconoUsuario = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
)

function Onb({ children, label }) {
  return <Screen full onBack={false} label={label}><div className="onb">{children}</div></Screen>
}

function Pasos({ n, total = 3 }) {
  return (
    <span className="onb-pasos">
      {Array.from({ length: total }, (_, i) => <span key={i} className={i < n ? 'on' : ''} aria-hidden="true" />)}
      <span className="sr-only">Paso {n} de {total}</span>
    </span>
  )
}

function Marca({ size = 52 }) {
  return (
    <div className="onb-marca">
      <Logo size={size} />
      <span>¡Aguas!</span>
    </div>
  )
}

// ---------- acceso ----------
export function Acceso() {
  const { ir } = useApp()
  return (
    <Onb label="Entrar a ¡Aguas!">
      <Marca />
      <h1 className="onb-h1">Ve y reporta calles inundadas con tus vecinos</h1>
      <p className="onb-lead">Un mapa de la ZMG que confirma la gente que está ahí. Entras en segundos.</p>
      <div className="onb-spacer" />
      <button type="button" className="btn btn-primary onb-anon" onClick={() => ir('privacidad')}>
        <span className="t">Continuar sin cuenta</span>
        <span className="s">Anónimo · recomendado</span>
      </button>
      <button type="button" className="btn btn-disabled onb-google" disabled aria-describedby="onb-google-nota">
        <IconoUsuario />Continuar con Google
      </button>
      <div id="onb-google-nota" className="onb-nota">
        Aún no disponible: el inicio con Google no existe todavía en el backend.
      </div>
      <div className="onb-centro"><PorConfirmar>Google: por confirmar con backend</PorConfirmar></div>
      <button type="button" className="btn-text onb-link" onClick={() => ir('privacidad')}>Leer el aviso de privacidad</button>
    </Onb>
  )
}

// ---------- privacidad ----------
const FRASES = [
  { t: 'No pedimos tu nombre, correo ni teléfono.' },
  { t: 'Guardamos solo dónde está cada reporte, nunca tu recorrido.' },
  { t: 'Nadie puede ver quién hizo un reporte.' },
  { t: 'Puedes borrar tus reportes y cerrar tu sesión.', nota: 'Por confirmar con backend' },
]

export function Privacidad() {
  const { ir } = useApp()
  const [acepto, setAcepto] = useState(false)
  return (
    <Onb label="Aviso de privacidad">
      <div className="onb-top">
        <Btn variant="ghost" icon="atras" className="onb-atras" onClick={() => ir('acceso')}>Atrás</Btn>
        <Pasos n={1} />
      </div>
      <h1 className="onb-h1">Tu privacidad, en corto</h1>
      <ul className="onb-frases">
        {FRASES.map((f) => (
          <li key={f.t}>
            <Icon name="escudo" />
            <span><span className="t">{f.t}</span>{f.nota && <span className="nota">{f.nota}</span>}</span>
          </li>
        ))}
      </ul>
      <details className="onb-aviso">
        <summary>Leer el aviso completo</summary>
        <div className="onb-aviso-cuerpo">
          <p><b>Qué no pedimos.</b> Entras con una sesión anónima: un identificador al azar que no lleva tu nombre,
            correo, teléfono ni edad.</p>
          <p><b>Qué guardamos de un reporte.</b> El punto donde está la inundación, la hora y lo que contestaste
            (por ejemplo, si pasan carros). No guardamos por dónde te mueves.</p>
          <p><b>Quién lo ve.</b> El mapa muestra los reportes y zonas, nunca quién los hizo. Solo tú puedes ver
            tus propios reportes.</p>
          <p><b>Avisos.</b> Si los activas, guardamos el municipio o la zona aproximada (unos 300 m) de la que
            quieres avisos, nunca tu punto exacto. Se borra al darte de baja o tras un tiempo sin uso.</p>
          <p><b>Borrar tus datos.</b> Borrar tus reportes y cerrar tu sesión desde la app: <PorConfirmar>Por confirmar con backend</PorConfirmar></p>
          <p><b>Aviso legal completo</b> (responsable, derechos ARCO, contacto): <PorConfirmar /></p>
        </div>
      </details>
      <div className="onb-spacer" />
      <label className="onb-check">
        <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
        Leí y acepto el aviso de privacidad
      </label>
      {acepto
        ? <button type="button" className="btn btn-primary" onClick={() => ir('ubicacion')}>Aceptar y seguir</button>
        : <button type="button" className="btn btn-disabled" disabled>Marca la casilla para seguir</button>}
    </Onb>
  )
}

// ---------- ubicacion ----------
export function Ubicacion() {
  const { ir, pedirUbicacion, avisar, municipio, setMunicipio } = useApp()
  const [elegir, setElegir] = useState(false)   // mostrar selector de municipio
  const [negada, setNegada] = useState(false)
  const [pidiendo, setPidiendo] = useState(false)

  const permitir = async () => {
    setPidiendo(true)
    const u = await pedirUbicacion()
    setPidiendo(false)
    if (u) { avisar('Ubicación permitida mientras usas la app'); ir('avisos') }
    else { setNegada(true); setElegir(true) }
  }
  const elegirMunicipio = (m) => { setMunicipio(m); avisar(`Listo: ${m}. Puedes activar tu ubicación después.`); ir('avisos') }

  return (
    <Onb label="Permiso de ubicación">
      <div className="onb-top fin"><Pasos n={2} /></div>
      <span className="onb-icono"><Icon name="pin" size={48} stroke={1.8} /></span>
      {!elegir ? (
        <>
          <h1 className="onb-h1">¿Usamos tu ubicación?</h1>
          <p className="onb-lead">Para poner tu reporte donde estás y mostrarte lo que pasa a 300 m. Solo mientras usas la app; nunca guardamos tu recorrido.</p>
          <div className="onb-spacer" />
          <button type="button" className="btn btn-primary" onClick={permitir} disabled={pidiendo} aria-busy={pidiendo}>
            {pidiendo ? 'Buscando tu ubicación…' : 'Permitir ubicación'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setElegir(true)}>Ahora no · elegiré mi municipio</button>
        </>
      ) : (
        <>
          <h1 className="onb-h1">¿En qué municipio estás?</h1>
          <p className="onb-lead">
            {negada ? 'No pudimos usar tu ubicación. ' : ''}Te mostramos el mapa de tu municipio. Puedes cambiarlo después.
          </p>
          <div className="onb-municipios" role="group" aria-label="Municipios de la ZMG">
            {MUNICIPIOS_ZMG.map((m) => (
              <button key={m} type="button" className={'btn onb-muni' + (m === municipio ? ' sel' : '')}
                aria-pressed={m === municipio} onClick={() => elegirMunicipio(m)}>
                {m === municipio && <Icon name="check" size={20} />}{m}
              </button>
            ))}
          </div>
          <div className="onb-spacer" />
          <button type="button" className="btn-text onb-link" onClick={() => { setElegir(false); setNegada(false) }}>Mejor usar mi ubicación</button>
        </>
      )}
    </Onb>
  )
}

// ---------- avisos ----------
export function AvisosPermiso() {
  const { ir, avisar } = useApp()
  const [pidiendo, setPidiendo] = useState(false)
  const permitir = async () => {
    setPidiendo(true)
    const r = await pedirPermisoAvisos()
    setPidiendo(false)
    if (r === 'concedido') avisar('Permiso concedido. Elige tus zonas en Avisos.')
    else if (r === 'negado') avisar('Puedes activarlos después en Avisos')
    else avisar('Este navegador no permite avisos')
    ir('onb')
  }
  return (
    <Onb label="Permiso de avisos">
      <div className="onb-top fin"><Pasos n={3} /></div>
      <span className="onb-icono"><Icon name="campana" size={48} stroke={1.8} /></span>
      <h1 className="onb-h1">¿Te avisamos si algo cambia?</h1>
      <p className="onb-lead">Solo si se inunda o se despeja tu zona, o si viene lluvia fuerte. Máximo 1 aviso por zona cada 30 min. Así lo pidió casi la mitad de las personas encuestadas (49.3 %).</p>
      <div className="onb-spacer" />
      <button type="button" className="btn btn-primary" onClick={permitir} disabled={pidiendo} aria-busy={pidiendo}>
        {pidiendo ? 'Esperando tu respuesta…' : 'Permitir avisos'}
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => ir('onb')}>Ahora no</button>
    </Onb>
  )
}

// ---------- onb: ¿Cómo te mueves hoy? ----------
export function Medio() {
  const { ir, avisar, setMedio, terminarOnboarding } = useApp()
  const [enviando, setEnviando] = useState(null)

  const elegir = async (medio) => {
    if (enviando) return
    setEnviando(medio)
    const { error } = await entrarConMedio({ asegurarSesion, registrarEntrada }, medio)
    setMedio(medio)
    terminarOnboarding()
    ir(null)
    const aviso = avisoEntrada(error)
    if (aviso) avisar(aviso)
  }

  return (
    <Onb label="¿Cómo te mueves hoy?">
      <Marca size={44} />
      <p className="onb-intro">Ve y reporta calles inundadas en la ZMG, junto con tus vecinos.</p>
      <div className="onb-sello">
        <Icon name="escudo" size={28} />
        <div><div className="t">Anónimo. No guardamos dónde estás.</div><div className="s">Sin correo, teléfono ni nombre.</div></div>
      </div>
      <h1 className="onb-h1 xl">¿Cómo te mueves hoy?</h1>
      <div className="onb-medios">
        {MEDIOS.map((m) => (
          <button key={m.id} type="button" className="tile onb-medio" onClick={() => elegir(m.id)}
            disabled={!!enviando} aria-busy={enviando === m.id}>
            <Icon name={m.id} size={48} stroke={1.8} />
            {m.titulo}
            <span className="s">{enviando === m.id ? 'Entrando…' : m.sub}</span>
          </button>
        ))}
      </div>
    </Onb>
  )
}
