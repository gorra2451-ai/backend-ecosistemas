// MÓDULO A · Primera vez (Equipo Registro). Pantallas: acceso, privacidad, ubicacion, avisos, onb.
// Look de App.dc.html (DISENO.md §3a); ronda 2: flujo y copy del Equipo Registro donde no choca con el backend.
// Pasos: 1 bienvenida → 2 ubicación → 3 avisos → 4 medio (abre la sesión anónima). privacidad = lectura. En escritorio se ven como tarjeta centrada a pantalla completa.
import { useState } from 'react'
import { Screen, Btn, PorConfirmar } from '../components/ui.jsx'
import Icon, { Logo } from '../components/Icon.jsx'
import { useApp } from '../lib/store.jsx'
import { asegurarSesion, registrarEntrada } from '../lib/api.js'
import { MUNICIPIOS_ZMG, MEDIOS, entrarConMedio, avisoEntrada, pedirPermisoAvisos } from '../lib/onboarding.js'
import '../styles/onboarding.css'

function Onb({ children, label }) {
  return <Screen full onBack={false} label={label}><div className="onb">{children}</div></Screen>
}

function Pasos({ n, total = 4 }) {
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

// ---------- acceso (bienvenida) ----------
// Ronda 2: flujo del Equipo Registro. La bienvenida junta acceso + privacidad: un solo tap ("Comenzar")
// en vez de 3 (continuar + casilla + aceptar). El aviso completo sigue a un tap ("Leer").
const BENEFICIOS = [
  { icon: 'mapa', t: 'Ve dónde hay calles inundadas' },
  { icon: 'check', t: 'Reporta y confirma con tus vecinos' },
  { icon: 'campana', t: 'Recibe avisos de tu zona' },
]

export function Acceso() {
  const { ir } = useApp()
  return (
    <Onb label="Entrar a ¡Aguas!">
      <div className="onb-top"><Marca size={40} /><Pasos n={1} /></div>
      <h1 className="onb-h1">Juntos ante las inundaciones</h1>
      <p className="onb-lead">Un mapa de la ZMG que confirma la gente que está ahí. Entras en segundos.</p>
      <ul className="onb-beneficios">
        {BENEFICIOS.map((b) => (
          <li key={b.t}><Icon name={b.icon} size={26} /><span>{b.t}</span></li>
        ))}
      </ul>
      <div className="onb-sello">
        <Icon name="escudo" size={28} />
        <div>
          <div className="t">Usa la app sin cuenta</div>
          <div className="s">No pedimos nombre, correo ni teléfono. Guardamos solo dónde está cada reporte, nunca tu recorrido.</div>
        </div>
      </div>
      <div className="onb-sello onb-priv">
        <div><div className="t">Aviso de privacidad</div><div className="s">Qué datos usamos y para qué.</div></div>
        <button type="button" className="btn btn-ghost onb-leer" onClick={() => ir('privacidad')}>Leer</button>
      </div>
      <div className="onb-spacer" />
      <button type="button" className="btn btn-primary" onClick={() => ir('ubicacion')}>Comenzar</button>
      <p className="onb-nota">Al comenzar aceptas el aviso de privacidad.</p>
    </Onb>
  )
}

// ---------- privacidad (lectura; se abre desde "Leer") ----------
const FRASES = [
  { t: 'No pedimos tu nombre, correo ni teléfono.' },
  { t: 'Guardamos solo dónde está cada reporte, nunca tu recorrido.' },
  { t: 'Nadie puede ver quién hizo un reporte.' },
  { t: 'Puedes borrar tus reportes y cerrar tu sesión.', nota: 'Por confirmar con backend' },
]

export function Privacidad() {
  const { ir } = useApp()
  return (
    <Onb label="Aviso de privacidad">
      <div className="onb-top">
        <Btn variant="ghost" icon="atras" className="onb-atras" onClick={() => ir('acceso')}>Atrás</Btn>
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
          <p><b>Cómo te mueves.</b> El medio que eliges (a pie, bici, auto o transporte) se guarda con tu visita,
            sin tu ubicación, para saber cuánta gente usa la app y cómo.</p>
          <p><b>Quién lo ve.</b> El mapa muestra los reportes y zonas, nunca quién los hizo. Solo tú puedes ver
            tus propios reportes.</p>
          <p><b>Avisos.</b> Si los activas, guardamos el municipio o la zona aproximada (unos 300 m) de la que
            quieres avisos, nunca tu punto exacto. Se borra al darte de baja o tras un tiempo sin uso.</p>
          <p><b>Borrar tus datos.</b> Borrar tus reportes y cerrar tu sesión desde la app: <PorConfirmar>Por confirmar con backend</PorConfirmar></p>
          <p><b>Aviso legal completo</b> (responsable, derechos ARCO, contacto): <PorConfirmar /></p>
        </div>
      </details>
      <div className="onb-spacer" />
      <button type="button" className="btn btn-primary" onClick={() => ir('acceso')}>Entendido</button>
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
          <p className="onb-opcional">Opcional · puedes cambiarlo después</p>
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
      <p className="onb-opcional">Opcional · puedes cambiarlo después</p>
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
      <div className="onb-top fin"><Pasos n={4} /></div>
      <h1 className="onb-h1 xl">¿Cómo te mueves hoy?</h1>
      <p className="onb-lead">Elige el de tu trayecto de hoy. Al tocarlo entras a la app.</p>
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
