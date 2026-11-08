import { useEffect, useRef, useState } from 'react'
import { ZONAS } from '../../data/demoData'
import PhotoFileField from '../../components/PhotoFileField'
import {
  registrarVecino,
  iniciarSesion,
  obtenerPerfil,
  obtenerToken,
  cerrarSesion,
  subirImagenes,
} from '../../api/veciredApi'
import { actualizarPerfil, obtenerAvatarUrl } from '../../api/perfilApi'

const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const TAMANO_MAXIMO = 5 * 1024 * 1024
const ZONAS_DISPONIBLES = ZONAS.filter((z) => z !== 'Todas las zonas')

function notificarPerfil(perfil) {
  if (perfil) window.dispatchEvent(new CustomEvent('vecired:profile-updated', { detail: { perfil } }))
}

function Avatar({ ruta, nombre, preview, tamano = 82 }) {
  const url = preview || obtenerAvatarUrl(ruta)
  const [fallo, setFallo] = useState(false)
  useEffect(() => setFallo(false), [url])
  return (
    <div style={{ width: tamano, height: tamano, borderRadius: '50%', background: '#e6efed', overflow: 'hidden', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      {url && !fallo ? (
        <img src={url} alt={`Foto de perfil de ${nombre || 'vecino'}`} onError={() => setFallo(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span aria-label="Avatar sin fotografía" style={{ fontSize: tamano * 0.37, fontWeight: 700, color: '#226655' }}>
          {(nombre?.trim()?.[0] || 'V').toUpperCase()}
        </span>
      )}
    </div>
  )
}

export default function Account({ onBack, onTutorial, onMyItems, mensajeAcceso = '' }) {
  const [modo, setModo] = useState('inicio')
  const [datos, setDatos] = useState({ full_name: '', email: '', password: '', phone: '', neighborhood: 'Cercado' })
  const [perfil, setPerfil] = useState(null)
  const [foto, setFoto] = useState(null)
  const [preview, setPreview] = useState('')
  const previewRef = useRef('')
  const [edicion, setEdicion] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [cargando, setCargando] = useState(Boolean(obtenerToken()))

  useEffect(() => {
    let activo = true
    if (obtenerToken()) {
      obtenerPerfil()
        .then((p) => { if (activo) { setPerfil(p); setModo('perfil'); notificarPerfil(p) } })
        .catch(() => { if (activo) cerrarSesion() })
        .finally(() => { if (activo) setCargando(false) })
    }
    return () => { activo = false }
  }, [])

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
  }, [])

  function actualizar(campo, valor) {
    setDatos((anterior) => ({ ...anterior, [campo]: valor }))
    setError('')
  }

  function seleccionarFoto(evento) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return
    if (!TIPOS.includes(archivo.type)) return setError('La foto debe ser JPG, PNG o WebP.')
    if (archivo.size > TAMANO_MAXIMO) return setError('La foto no debe superar 5 MB.')
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    const url = URL.createObjectURL(archivo)
    previewRef.current = url
    setPreview(url)
    setFoto(archivo)
    setError('')
  }

  function quitarFotoSeleccionada() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = ''
    setPreview('')
    setFoto(null)
  }

  async function enviar(evento) {
    evento.preventDefault()
    if (ocupado) return
    setOcupado(true)
    setError('')
    setAviso('')

    try {
      if (modo === 'registro') {
        const respuesta = await registrarVecino({
          full_name: datos.full_name.trim(),
          email: datos.email.trim(),
          password: datos.password,
          neighborhood: datos.neighborhood,
          phone: datos.phone.trim() || null,
        })
        let advertencia = ''
        if (foto) {
          try {
            // Primero se registra la cuenta y se obtiene un token.
            // Después se sube la foto; su ausencia nunca bloquea el registro.
            const rutas = await subirImagenes([foto])
            if (!rutas?.[0]) throw new Error('El servidor no devolvió una fotografía.')
            await actualizarPerfil({ avatar_url: rutas[0] })
          } catch (errorFoto) {
            advertencia = `Tu cuenta se creó, pero la foto no se guardó: ${errorFoto.message}`
          }
        }
        const actual = await obtenerPerfil().catch(() => respuesta?.user || null)
        setPerfil(actual)
        notificarPerfil(actual)
        setModo('perfil')
        setAviso(advertencia || 'Cuenta creada correctamente. Bienvenido a VeciRed.')
        setDatos((anterior) => ({ ...anterior, password: '' }))
        quitarFotoSeleccionada()
      } else {
        const respuesta = await iniciarSesion({ email: datos.email.trim(), password: datos.password })
        const actual = await obtenerPerfil().catch(() => respuesta?.user || null)
        setPerfil(actual)
        notificarPerfil(actual)
        setModo('perfil')
        setDatos((anterior) => ({ ...anterior, password: '' }))
        setAviso('Sesión iniciada correctamente.')
      }
    } catch (e) {
      setError(e.message || 'No fue posible completar la operación.')
    } finally {
      setOcupado(false)
    }
  }

  async function cambiarFotoPerfil(evento) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo || ocupado) return
    if (!TIPOS.includes(archivo.type) || archivo.size > TAMANO_MAXIMO) {
      return setError('Usa una foto JPG, PNG o WebP de hasta 5 MB.')
    }
    setError('')
    setAviso('')
    setOcupado(true)
    try {
      const rutas = await subirImagenes([archivo])
      if (!rutas?.[0]) throw new Error('El servidor no devolvió una fotografía.')
      const resultado = await actualizarPerfil({ avatar_url: rutas[0] })
      setPerfil(resultado)
      notificarPerfil(resultado)
      setAviso('Fotografía de perfil actualizada.')
    } catch (e) {
      setError(e.message || 'No se pudo actualizar la fotografía.')
    } finally {
      setOcupado(false)
    }
  }

  async function quitarFotoPerfil() {
    if (ocupado) return
    setOcupado(true)
    setError('')
    try {
      const resultado = await actualizarPerfil({ avatar_url: null })
      setPerfil(resultado)
      notificarPerfil(resultado)
      setAviso('Fotografía de perfil retirada.')
    } catch (e) {
      setError(e.message || 'No se pudo retirar la fotografía.')
    } finally {
      setOcupado(false)
    }
  }

  async function guardarDatos(evento) {
    evento.preventDefault()
    if (ocupado) return
    setOcupado(true)
    setError('')
    try {
      const resultado = await actualizarPerfil({
        full_name: edicion.full_name,
        neighborhood: edicion.neighborhood,
        phone: edicion.phone,
      })
      setPerfil(resultado)
      notificarPerfil(resultado)
      setEdicion(null)
      setAviso('Datos de tu perfil actualizados.')
    } catch (e) {
      setError(e.message || 'No se pudo guardar tu perfil.')
    } finally {
      setOcupado(false)
    }
  }

  function salir() {
    cerrarSesion()
    setPerfil(null)
    setEdicion(null)
    setModo('inicio')
    setAviso('Has cerrado sesión.')
    setError('')
  }

  return (
    <section className="page container" aria-labelledby="cuenta-titulo">
      <button className="back-link" type="button" onClick={onBack}>‹ Volver al inicio</button>
      <div className="account-banner">
        <Avatar ruta={perfil?.avatar_url} nombre={perfil?.full_name} preview={modo === 'registro' ? preview : ''} />
        <div>
          <h1 id="cuenta-titulo">Mi cuenta</h1>
          <p>Tu espacio dentro de la comunidad VeciRed.</p>
        </div>
      </div>

      <div className="detail-panel">
        {mensajeAcceso && !perfil && <p className="info-panel" role="status">{mensajeAcceso}</p>}
        {cargando ? (
          <p>Comprobando sesión...</p>
        ) : perfil ? (
          <>
            <h2>{perfil.full_name || 'Mi perfil'}</h2>
            <p><strong>Correo:</strong> {perfil.email}</p>
            <p><strong>Barrio:</strong> {perfil.neighborhood || 'No indicado'}</p>
            <p><strong>Celular:</strong> {perfil.phone || 'No registrado (opcional)'}</p>
            <p className="hint">La fotografía es opcional. No supone verificación de identidad.</p>

            <div className="form-label">
              {perfil.avatar_url ? 'Cambiar fotografía de perfil' : 'Agregar fotografía de perfil'}
              <PhotoFileField onChange={cambiarFotoPerfil} disabled={ocupado} />
            </div>
            {perfil.avatar_url && (
              <button type="button" className="button-outline" onClick={quitarFotoPerfil} disabled={ocupado}>Quitar fotografía</button>
            )}

            {edicion ? (
              <form onSubmit={guardarDatos}>
                <label className="form-label">Nombre completo
                  <input required maxLength={150} value={edicion.full_name} onChange={(e) => setEdicion({ ...edicion, full_name: e.target.value })} />
                </label>
                <label className="form-label">Celular (opcional)
                  <input type="tel" autoComplete="tel-national" inputMode="numeric" maxLength={9} pattern="9[0-9]{8}" title="Celular peruano: nueve dígitos, empieza con 9" placeholder="987654321" value={edicion.phone} onChange={(e) => setEdicion({ ...edicion, phone: e.target.value.replace(/\D/g, '').slice(0, 9) })} />
                </label>
                <label className="form-label">Barrio o distrito
                  <select value={edicion.neighborhood} onChange={(e) => setEdicion({ ...edicion, neighborhood: e.target.value })}>
                    {ZONAS_DISPONIBLES.map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                </label>
                <div className="account-edit-actions">
                  <button className="button-primary" type="submit" disabled={ocupado}>Guardar cambios</button>
                  <button className="button-outline" type="button" onClick={() => setEdicion(null)} disabled={ocupado}>Cancelar</button>
                </div>
              </form>
            ) : (
              <div className="account-actions">
                <button className="button-outline" type="button" onClick={() => setEdicion({ full_name: perfil.full_name || '', phone: perfil.phone || '', neighborhood: perfil.neighborhood || 'Cercado' })}>Editar datos</button>
                <button className="button-outline" type="button" onClick={onMyItems}>Mis publicaciones</button>
                <button className="button-outline" type="button" onClick={salir} disabled={ocupado}>Cerrar sesión</button>
              </div>
            )}
          </>
        ) : (
          <>
            <h2>{modo === 'registro' ? 'Crear cuenta vecinal' : 'Iniciar sesión'}</h2>
            <form onSubmit={enviar}>
              {modo === 'registro' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 14 }}>
                    <Avatar preview={preview} nombre={datos.full_name} tamano={96} />
                  </div>
                  <div className="form-label">Foto de perfil (opcional)
                    <PhotoFileField onChange={seleccionarFoto} disabled={ocupado} />
                  </div>
                  {foto && <button className="back-link" type="button" onClick={quitarFotoSeleccionada}>Quitar foto seleccionada</button>}
                  <p className="hint">JPG, PNG o WebP. Hasta 5 MB. Puedes agregarla después.</p>
                  <label className="form-label">Nombre completo
                    <input required autoComplete="name" maxLength={150} value={datos.full_name} onChange={(e) => actualizar('full_name', e.target.value)} />
                  </label>
                  <label className="form-label">Celular (opcional)
                    <input type="tel" autoComplete="tel-national" inputMode="numeric" maxLength={9} pattern="9[0-9]{8}" title="Celular peruano: nueve dígitos, empieza con 9" placeholder="987654321" value={datos.phone} onChange={(e) => actualizar('phone', e.target.value.replace(/\D/g, '').slice(0, 9))} />
                  </label>
                  <label className="form-label">Barrio o distrito
                    <select value={datos.neighborhood} onChange={(e) => actualizar('neighborhood', e.target.value)}>
                      {ZONAS_DISPONIBLES.map((z) => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </label>
                </>
              )}
              <label className="form-label">Correo electrónico
                <input type="email" required autoComplete="email" value={datos.email} onChange={(e) => actualizar('email', e.target.value)} />
              </label>
              <label className="form-label">Contraseña
                <input type="password" required minLength={8} autoComplete={modo === 'registro' ? 'new-password' : 'current-password'} value={datos.password} onChange={(e) => actualizar('password', e.target.value)} />
              </label>
              <button className="button-primary wide" type="submit" disabled={ocupado}>{ocupado ? 'Procesando...' : modo === 'registro' ? 'Crear mi cuenta' : 'Ingresar'}</button>
            </form>
            <button type="button" className="back-link" onClick={() => { setModo(modo === 'registro' ? 'inicio' : 'registro'); setError(''); setAviso('') }}>
              {modo === 'registro' ? 'Ya tengo cuenta' : 'No tengo cuenta · Registrarme'}
            </button>
            <p className="hint">No solicites ni publiques DNI, fecha de nacimiento o dirección exacta para usar la comunidad.</p>
          </>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        {aviso && <p className="hint" role="status">{aviso}</p>}
      </div>

      <div className="detail-panel">
        <h2>Aprende a usar VeciRed</h2>
        <p>Busca productos y servicios, ayuda a tus vecinos y publica tus ofertas.</p>
        <button className="button-outline" type="button" onClick={onTutorial}>Ver tutorial</button>
      </div>
    </section>
  )
}
