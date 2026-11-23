// Privacidad y permisos (testeo de usabilidad: 5 de 10 no encontraron cómo cambiar el permiso de ubicación;
// 2 lo buscaron en Accesibilidad). Id de pantalla: 'privacidad_permisos' · se abre desde Más.
// Muestra el estado REAL del permiso (lo dice el navegador) y cómo cambiarlo. Una página web no puede quitar ni
// volver a pedir un permiso bloqueado: por eso, si está bloqueado, se dan los pasos del teléfono.
import { useCallback, useEffect, useState } from 'react'
import { Screen } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { useApp } from '../lib/store.jsx'
import {
  leerPermisoUbicacion, leerPermisoAvisos, pedirPermisoAvisos, textoPermiso, COMO_CAMBIAR, volverAtras,
} from '../lib/onboarding.js'
import '../styles/onboarding.css'

export function PrivacidadPermisos() {
  const { ir, avisar, pedirUbicacion } = useApp()
  const [ubi, setUbi] = useState('desconocido')
  const [avi, setAvi] = useState('desconocido')
  const [pidiendo, setPidiendo] = useState(null) // 'ubi' | 'avi'

  const leer = useCallback(async () => {
    setUbi(await leerPermisoUbicacion())
    setAvi(leerPermisoAvisos())
  }, [])
  // Se vuelve a leer al regresar de los ajustes del teléfono.
  useEffect(() => {
    leer()
    const alVolver = () => { if (document.visibilityState === 'visible') leer() }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [leer])

  const usarUbicacion = async () => {
    setPidiendo('ubi')
    const u = await pedirUbicacion()
    setPidiendo(null)
    await leer()
    avisar(u ? 'Listo: el mapa ya muestra tu zona' : 'No pudimos usar tu ubicación. Puedes buscar un lugar en el mapa.')
  }
  const activarAvisos = async () => {
    setPidiendo('avi')
    const r = await pedirPermisoAvisos()
    setPidiendo(null)
    await leer()
    if (r === 'concedido') avisar('Avisos permitidos. Elige de qué zonas en Notificaciones.')
  }

  return (
    <Screen titulo="Privacidad y permisos" label="Privacidad y permisos" onBack={() => volverAtras(undefined, ir)}>
      <div className="onb">
        <div className="onb-sello">
          <span className="onb-ic"><Icon name="escudo" /></span>
          <div>
            <div className="t">Tu privacidad</div>
            <ul className="onb-puntos">
              <li>Usamos tu ubicación solo para mostrarte riesgos cerca; no la guardamos.</li>
              <li>Tu ID temporal es un código al azar que no te identifica.</li>
            </ul>
            <button type="button" className="btn-text" onClick={() => ir('privacidad')}>Leer el aviso de privacidad completo</button>
          </div>
        </div>

        <TarjetaPermiso icon="pin" titulo="Ubicación" uso="Para mostrar tu zona en el mapa. No es indispensable: también puedes buscar un lugar."
          estado={ubi} pasos={COMO_CAMBIAR.ubicacion} ocupado={pidiendo === 'ubi'}
          accion={ubi === 'bloqueado' || ubi === 'no_soportado' ? null
            : { texto: pidiendo === 'ubi' ? 'Buscando tu ubicación…' : 'Usar mi ubicación', onClick: usarUbicacion }} />

        <TarjetaPermiso icon="campana" titulo="Notificaciones" uso="Solo te avisamos de las zonas que elijas."
          estado={avi} pasos={COMO_CAMBIAR.avisos} ocupado={pidiendo === 'avi'}
          accion={avi === 'sin_decidir' || avi === 'desconocido'
            ? { texto: pidiendo === 'avi' ? 'Esperando tu respuesta…' : 'Permitir notificaciones', onClick: activarAvisos }
            : avi === 'permitido' ? { texto: 'Elegir de qué zonas', onClick: () => ir('preferencias'), secundario: true } : null} />
      </div>
    </Screen>
  )
}

function TarjetaPermiso({ icon, titulo, uso, estado, pasos, accion, ocupado }) {
  const bloqueado = estado === 'bloqueado' || estado === 'no_soportado'
  return (
    <section className="onb-permiso" aria-label={titulo}>
      <div className="onb-permiso-c">
        <span className="onb-ic"><Icon name={icon} /></span>
        <div>
          <div className="t">{titulo} <span className="onb-tag">Opcional</span></div>
          <div className="s">{uso}</div>
          <p style={{ margin: '8px 0 0', fontSize: 15 }} aria-live="polite">
            Estado: <b>{textoPermiso(estado)}</b>
          </p>
        </div>
      </div>
      {accion && (
        <button type="button" className={'btn ' + (accion.secundario ? 'btn-ghost' : 'btn-primary')}
          disabled={ocupado} aria-busy={ocupado} onClick={accion.onClick}>{accion.texto}</button>
      )}
      {estado !== 'sin_decidir' && (
        <details className="onb-aviso" open={bloqueado}>
          <summary>{bloqueado ? 'Cómo activarlo en tu teléfono' : 'Cómo cambiarlo en tu teléfono'}</summary>
          <div className="onb-aviso-cuerpo">
            {estado === 'bloqueado' && <p>Tu navegador ya no vuelve a preguntar. Cámbialo en el teléfono:</p>}
            {pasos.map((p) => <p key={p.donde}><b>{p.donde}.</b> {p.pasos}</p>)}
          </div>
        </details>
      )}
    </section>
  )
}
