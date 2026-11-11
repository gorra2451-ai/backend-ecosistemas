// MÓDULO A · Primera vez (Equipo Registro). Ronda 3: flujo, pantallas y copy del equipo; look del design system.
// Pasos (D-026): 1/4 Bienvenida → 2/4 Accesibilidad → 3/4 ¿Cómo te mueves hoy? → 4/4 Permisos → Registro terminado → ir('inicio').
// Ids: acceso = paso 1 · onb = paso 2 (o "cambiar medio" si ya entró, desde el mapa) · ubicacion y avisos = paso 4
// · privacidad = aviso completo (se abre con "Leer").
import { useEffect, useState } from 'react'
import { Screen, Btn, PorConfirmar } from '../components/ui.jsx'
import Icon, { Logo } from '../components/Icon.jsx'
import { useApp } from '../lib/store.jsx'
import { asegurarSesion, registrarEntrada, guardarAccesibilidad } from '../lib/api.js'
import { vibrar, FRASE_VOZ } from '../lib/haptica.js'
import { hablar } from '../lib/confirmar.js'
import {
  MEDIOS, AJUSTES_A11Y, tituloMedio, a11yActivo, alternarA11y, resumenA11y, idCorto, yaEntro,
  conTiempo, entrarConMedio, avisoEntrada, pedirPermisoAvisos,
} from '../lib/onboarding.js'
import '../styles/onboarding.css'

// Íconos que no están en Icon.jsx (solo de este módulo).
const EXTRA = {
  moto: <><circle cx="5.5" cy="17" r="3" /><circle cx="18.5" cy="17" r="3" /><path d="M8.5 17H14l3-6h-3L12 8H9M17 11l1.5 6" /></>,
  grande: <path d="M3 19l5-12 5 12M5 15h6M15 19l3-7 3 7M16 17h4" />,
  vibra: <><rect x="8" y="4" width="8" height="16" rx="2" /><path d="M4 9v6M20 9v6" /></>,
  dalton: <><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.6-1-2.6 1-1.4 2-1.4h2a4 4 0 0 0 4-4C21 6.5 17 3 12 3z" /><path d="M7.5 11h.1M10 7.5h.1M14.5 7.5h.1" /></>,
  ruta: <><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8" /></>,
}
function Ico({ name, size = 24 }) {
  if (!EXTRA[name]) return <Icon name={name} size={size} />
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>{EXTRA[name]}</svg>
  )
}

function Onb({ children, label }) {
  return <Screen full onBack={false} label={label}><div className="onb">{children}</div></Screen>
}

// Encabezado del equipo: marca (paso 1) o Atrás (pasos 2–4), contador "n/4" y barra de 4 segmentos.
function Cabeza({ n, onAtras }) {
  return (
    <div className="onb-cabeza">
      <div className="onb-top">
        {onAtras
          ? <button type="button" className="onb-atras" aria-label="Atrás" onClick={onAtras}><Icon name="atras" /></button>
          : <span className="onb-marca"><Logo size={36} /><span>¡Aguas!</span></span>}
        <span className="onb-cnt" aria-label={`Paso ${n} de 4`}>{n}/4</span>
      </div>
      <span className="onb-pasos" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => <span key={i} className={i <= n ? 'on' : ''} />)}
      </span>
    </div>
  )
}

// "ID temporal · #A7F3B2". Abre la sesión anónima al mostrarse; si falla no inventa un ID.
function useIdTemporal() {
  const [id, setId] = useState(undefined) // undefined = cargando · null = falló
  useEffect(() => {
    let vivo = true
    conTiempo(asegurarSesion(), 5000)
      .then((r) => { if (vivo) setId(r?.error ? null : idCorto(r?.data)) })
      .catch(() => { if (vivo) setId(null) })
    return () => { vivo = false }
  }, [])
  return id
}
function IdChip({ id }) {
  return (
    <span className="onb-idchip" aria-live="polite">
      {id === undefined ? 'ID temporal · creando…' : id ? `ID temporal · ${id}` : 'ID temporal · se crea al comenzar'}
    </span>
  )
}

// ---------- el flujo completo (estado local; los ids de pantalla solo eligen dónde empieza) ----------
const BENEFICIOS = [
  { icon: 'mapa', t: 'Ve dónde hay riesgo' },
  { icon: 'campana', t: 'Recibe alertas a tiempo' },
  { icon: 'ruta', t: 'Encuentra rutas seguras' },
]

function Flujo({ desde = 1 }) {
  const { ir, avisar, pedirUbicacion, setMedio, prefs, setPrefs, terminarOnboarding } = useApp()
  const [paso, setPaso] = useState(desde)
  const [medio, setMedioLocal] = useState(null)
  const [loc, setLoc] = useState(null)   // null = sin elegir · true · false
  const [not, setNot] = useState(null)
  const [pidiendo, setPidiendo] = useState(null) // 'loc' | 'not'
  const id = useIdTemporal()

  useEffect(() => { window.scrollTo?.(0, 0); document.querySelector('.screen.full')?.scrollTo?.(0, 0) }, [paso])

  const permitirUbicacion = async () => {
    setPidiendo('loc')
    const u = await pedirUbicacion()
    setPidiendo(null)
    setLoc(!!u)
    if (!u) avisar('No pudimos usar tu ubicación. Puedes activarla después.')
  }
  const activarAvisos = async () => {
    setPidiendo('not')
    const r = await pedirPermisoAvisos()
    setPidiendo(null)
    setNot(r === 'concedido')
    if (r === 'negado') avisar('Puedes activarlas después en Ajustes')
    if (r === 'no_soportado') avisar('Este navegador no permite notificaciones')
  }
  const alternar = (k) => {
    const p = alternarA11y(prefs, k)
    setPrefs(p)
    const on = a11yActivo(p, k)
    if (k === 'dalton') guardarAccesibilidad({ daltonismo: on }).catch(() => {}) // igual que Módulo E; si falla, queda local
    if (k === 'vibra') { guardarAccesibilidad({ vibracion: on }).catch(() => {}); if (on) vibrar(p, 80) }
    if (k === 'voz') { if (on) hablar(FRASE_VOZ); else try { window.speechSynthesis?.cancel() } catch { /* nada */ } }
  }
  const reiniciar = () => {
    setMedioLocal(null); setLoc(null); setNot(null)
    setPrefs({ ...prefs, voz: false, a11y: (prefs.a11y || []).filter((x) => x !== 'grande' && x !== 'dalton') })
    setPaso(1)
  }
  const entrar = () => {
    terminarOnboarding()
    ir('inicio')
    if (!medio) return // "Omitir por ahora" = no se registra la entrada
    setMedio(medio)
    entrarConMedio({ asegurarSesion, registrarEntrada }, medio).then(({ error }) => {
      const aviso = avisoEntrada(error)
      if (aviso) avisar(aviso)
    })
  }

  if (paso === 1) return (
    <Onb label="Bienvenida, paso 1 de 4">
      <Cabeza n={1} />
      <h1 className="onb-h1">Juntos ante las inundaciones</h1>
      <p className="onb-lead">Consulta riesgos, recibe alertas y encuentra rutas más seguras en tiempo real.</p>
      <ul className="onb-beneficios">
        {BENEFICIOS.map((b) => <li key={b.t}><span className="onb-ic"><Ico name={b.icon} /></span><span>{b.t}</span></li>)}
      </ul>
      <div className="onb-sello">
        <span className="onb-ic"><Icon name="escudo" /></span>
        <div>
          <div className="t">Usa la app sin cuenta</div>
          <ul className="onb-puntos">
            <li>No pedimos nombre, correo ni teléfono</li>
            <li>Tu ID se crea solo y es temporal: dura solo esta sesión</li>
          </ul>
          <IdChip id={id} />
        </div>
      </div>
      <div className="onb-sello onb-priv">
        <span className="onb-ic"><Icon name="lista" /></span>
        <div className="onb-priv-t"><div className="t">Aviso de privacidad</div><div className="s">Qué datos usamos y para qué.</div></div>
        <button type="button" className="btn btn-ghost onb-leer" onClick={() => ir('privacidad')}>Leer</button>
      </div>
      <div className="onb-spacer" />
      <button type="button" className="btn btn-primary" onClick={() => setPaso(2)}>Comenzar</button>
    </Onb>
  )

  if (paso === 3) {
    const sel = MEDIOS.find((m) => m.id === medio)
    return (
      <Onb label="¿Cómo te mueves hoy?, paso 3 de 4">
        <Cabeza n={3} onAtras={() => setPaso(2)} />
        <h1 className="onb-h1">¿Cómo te mueves hoy?</h1>
        <p className="onb-lead">Elige el transporte de tu trayecto de hoy. No es permanente: lo cambias cuando quieras en Ajustes.</p>
        <OpcionesMedio valor={medio} onElegir={setMedioLocal} />
        {sel && <p className="onb-tip" role="status"><Icon name="alerta" size={22} /><span>{sel.tip}</span></p>}
        <div className="onb-spacer" />
        <button type="button" className="btn btn-primary" disabled={!medio} onClick={() => setPaso(4)}>Continuar</button>
        <button type="button" className="btn-text onb-link" onClick={() => { setMedioLocal(null); setPaso(4) }}>Omitir por ahora</button>
      </Onb>
    )
  }

  if (paso === 4) {
    const yn = (v) => (v === null ? 'sin elegir' : v ? 'sí' : 'no')
    return (
      <Onb label="Permisos, paso 4 de 4">
        <Cabeza n={4} onAtras={() => setPaso(3)} />
        <h1 className="onb-h1">Permisos que te ayudan a estar más seguro</h1>
        <p className="onb-lead">Ambos son opcionales. Puedes cambiarlos o desactivarlos más tarde.</p>
        <Permiso icon="pin" titulo="Ubicación" texto="Para mostrar zonas de riesgo cerca de ti." valor={loc}
          si={pidiendo === 'loc' ? 'Buscando tu ubicación…' : 'Permitir ubicación'} ocupado={pidiendo === 'loc'}
          onSi={permitirUbicacion} onNo={() => setLoc(false)} />
        <Permiso icon="campana" titulo="Notificaciones" texto="Para avisarte de alertas, incluso con la app cerrada." valor={not}
          si={pidiendo === 'not' ? 'Esperando tu respuesta…' : 'Activar notificaciones'} ocupado={pidiendo === 'not'}
          onSi={activarAvisos} onNo={() => setNot(false)} />
        <div className="onb-resumen" aria-live="polite">
          <b>Lo que compartes ahora</b>
          <span>Ubicación: {yn(loc)} · Notificaciones: {yn(not)}</span>
          <span>Nunca pedimos tu nombre, correo ni teléfono.</span>
        </div>
        <div className="onb-spacer" />
        {/* Auditoría: la pantalla "Registro terminado" sobraba; se entra directo al mapa */}
        <button type="button" className="btn btn-primary" disabled={!!pidiendo} onClick={() => { entrar(); avisar('¡Listo! Ya puedes usar la app.') }}>Entrar a la app</button>
      </Onb>
    )
  }

  // Accesibilidad va en el paso 2 (humo 2026-11-11): quien necesita texto grande o daltonismo lo activa antes del resto.
  if (paso === 2) return (
    <Onb label="Ajustes de accesibilidad, paso 2 de 4">
      <Cabeza n={2} onAtras={() => setPaso(1)} />
      <h1 className="onb-h1">Ajustes opcionales de accesibilidad</h1>
      <p className="onb-lead">Los encuentras después en Ajustes, tal como aquí.</p>
      <div className="onb-ajustes">
        {AJUSTES_A11Y.map((a) => {
          const on = a11yActivo(prefs, a.k)
          return (
            <button key={a.k} type="button" className="onb-ajuste" role="switch" aria-checked={on} onClick={() => alternar(a.k)}>
              <span className="onb-ic"><Ico name={a.k === 'voz' ? 'voz' : a.k} /></span>
              <span className="tx"><b>{a.titulo}</b><span>{a.desc}</span></span>
              <span className="onb-sw"><span className="switch" aria-hidden="true"><i /></span><span className="st">{on ? 'Activado' : 'Desactivado'}</span></span>
            </button>
          )
        })}
      </div>
      <div className="onb-spacer" />
      <button type="button" className="btn btn-primary" onClick={() => setPaso(3)}>Continuar</button>
      <button type="button" className="btn-text onb-link" onClick={() => setPaso(3)}>Omitir por ahora</button>
    </Onb>
  )

  // Registro terminado (pantalla final del equipo, sin número de paso)
  return (
    <Onb label="Registro terminado">
      <span className="onb-ok"><Icon name="check" size={44} stroke={2.8} /></span>
      <h1 className="onb-h1 c">¡Registro terminado!</h1>
      <p className="onb-lead c">Ya puedes usar la app.</p>
      <div className="onb-sello onb-final">
        <div className="t">Tu configuración</div>
        <ul className="onb-conf">
          <li>Transporte de hoy: <b>{tituloMedio(medio)}</b></li>
          <li>Ubicación: <b>{loc ? 'permitida' : 'no compartida'}</b></li>
          <li>Notificaciones: <b>{not ? 'activadas' : 'desactivadas'}</b></li>
          <li>Accesibilidad: <b>{resumenA11y(prefs)}</b></li>
        </ul>
        <IdChip id={id} />
        <p className="s">Tu ID es automático y solo dura esta sesión.</p>
      </div>
      <div className="onb-spacer" />
      <button type="button" className="btn btn-primary" onClick={entrar}>Entrar a la app</button>
      <button type="button" className="btn-text onb-link" onClick={reiniciar}>Volver a empezar</button>
    </Onb>
  )
}

function OpcionesMedio({ valor, onElegir }) {
  return (
    <div className="onb-medios" role="radiogroup" aria-label="Medio de transporte">
      {MEDIOS.map((m) => (
        <button key={m.id} type="button" role="radio" aria-checked={valor === m.id}
          className={'onb-opt' + (valor === m.id ? ' sel' : '')} onClick={() => onElegir(m.id)}>
          <span className="onb-ic"><Ico name={m.id} /></span>
          <span className="t">{m.titulo}</span>
          <span className="rd" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

function Permiso({ icon, titulo, texto, valor, si, ocupado, onSi, onNo }) {
  return (
    <div className="onb-permiso">
      <div className="onb-permiso-c">
        <span className="onb-ic"><Icon name={icon} /></span>
        <div><div className="t">{titulo} <span className="onb-tag">Opcional</span></div><div className="s">{texto}</div></div>
      </div>
      <div className="onb-acts" role="group" aria-label={titulo}>
        <button type="button" className={'btn' + (valor === true ? ' sel' : '')} aria-pressed={valor === true}
          disabled={ocupado} aria-busy={ocupado} onClick={onSi}>{si}</button>
        <button type="button" className={'btn' + (valor === false ? ' sel' : '')} aria-pressed={valor === false}
          disabled={ocupado} onClick={onNo}>Ahora no</button>
      </div>
    </div>
  )
}

// ---------- exports (ids de registro.jsx) ----------
export function Acceso() { return <Flujo desde={1} /> }
export function Ubicacion() { return <Flujo desde={4} /> }      // permisos juntos (paso 4)
export function AvisosPermiso() { return <Flujo desde={4} /> }  // ya no es pantalla aparte: paso 4

// onb: sigue desde el paso 2 en la primera vez; si ya entró (botón de modo del mapa), hoja del equipo "Medio de transporte de hoy".
export function Medio() {
  if (!yaEntro()) return <Flujo desde={2} />
  return <CambiarMedio />
}

function CambiarMedio() {
  const { ir, avisar, medio, setMedio } = useApp()
  const [valor, setValor] = useState(medio)
  const listo = () => {
    ir(null)
    if (!valor || valor === medio) return
    setMedio(valor)
    avisar('Transporte actualizado: ' + tituloMedio(valor))
    entrarConMedio({ asegurarSesion, registrarEntrada }, valor).then(({ error }) => {
      const aviso = avisoEntrada(error)
      if (aviso) avisar(aviso)
    })
  }
  return (
    <Screen titulo="Medio de transporte de hoy" onBack={() => ir(null)}>
      <div className="onb">
        <p className="onb-lead">No es permanente. Cámbialo cuando cambie tu trayecto.</p>
        <OpcionesMedio valor={valor} onElegir={setValor} />
        <div className="onb-spacer" />
        <button type="button" className="btn btn-primary" onClick={listo}>Listo</button>
      </div>
    </Screen>
  )
}

// ---------- privacidad (lectura; se abre desde "Leer") ----------
export function Privacidad() {
  const { ir } = useApp()
  const volver = () => ir(yaEntro() ? null : 'acceso')
  return (
    <Onb label="Aviso de privacidad">
      <div className="onb-top">
        <Btn variant="ghost" icon="atras" className="onb-volver" onClick={volver}>Atrás</Btn>
      </div>
      <h1 className="onb-h1">Aviso de privacidad</h1>
      <div className="onb-aviso-cuerpo">
        <h2>¿Qué información usamos?</h2>
        <ul>
          <li>Tu ubicación, solo si decides compartirla.</li>
          <li>Tu medio de transporte, para personalizar recomendaciones.</li>
        </ul>
        <h2>¿Qué no pedimos?</h2>
        <ul><li>Tu nombre, edad, correo ni teléfono.</li></ul>
        <h2>¿Para qué la usamos?</h2>
        <ul>
          <li>Mostrar riesgos y rutas seguras.</li>
          <li>Enviar alertas relevantes.</li>
          <li>Mejorar la plataforma.</li>
        </ul>
      </div>
      <details className="onb-aviso">
        <summary>Más detalle</summary>
        <div className="onb-aviso-cuerpo">
          <p><b>Qué guardamos de un reporte.</b> El punto donde está la inundación, la hora y lo que contestaste.
            No guardamos por dónde te mueves.</p>
          <p><b>Quién lo ve.</b> El mapa muestra los reportes y zonas, nunca quién los hizo.</p>
          <p><b>Avisos.</b> Si los activas, guardamos la zona aproximada (unos 300 m) de la que quieres avisos,
            nunca tu punto exacto.</p>
          <p><b>Aviso legal completo</b> (responsable, derechos ARCO, contacto): <PorConfirmar /></p>
        </div>
      </details>
      <div className="onb-spacer" />
      <button type="button" className="btn btn-primary" onClick={volver}>Entendido</button>
    </Onb>
  )
}
