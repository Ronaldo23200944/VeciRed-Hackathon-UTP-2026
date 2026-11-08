import { useEffect, useState } from 'react'
import { CATEGORIAS, ZONAS } from '../../data/demoData'
import { subirImagenes } from '../../api/veciredApi'
import {
  cargarMisPublicaciones,
  eliminarMiPublicacion,
  editarMiPublicacion,
  finalizarMiPublicacion,
  pausarMiPublicacion,
  reactivarMiPublicacion,
} from '../../api/misPublicacionesApi'
import PhotoFileField from '../../components/PhotoFileField'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '')
const zonas = ZONAS.filter((zona) => zona !== 'Todas las zonas')
const categorias = CATEGORIAS.filter((categoria) => categoria !== 'Todos')
const finalizaciones = [
  { value: 'venta', label: 'Venta concretada' },
  { value: 'prestamo', label: 'Préstamo entregado' },
  { value: 'donacion', label: 'Donación realizada' },
  { value: 'otro', label: 'Servicio o acuerdo completado' },
]

function formDesde(item) {
  return {
    title: item.title || '',
    description: item.description || '',
    category: item.category || 'Hogar',
    neighborhood: item.neighborhood || 'Cercado',
    price_range: item.price_range || 'A coordinar',
  }
}

export default function MyPublications({ onBack, onChanged }) {
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState(null)
  const [fotos, setFotos] = useState([])
  const [tipoPorId, setTipoPorId] = useState({})

  useEffect(() => {
    let activo = true
    cargarMisPublicaciones()
      .then((resultado) => { if (activo) setItems(resultado) })
      .catch((err) => { if (activo) setError(err.message) })
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [])

  function iniciarEdicion(item) {
    setError('')
    setAviso('')
    setEditandoId(item.id)
    setForm(formDesde(item))
    setFotos([])
  }

  function seleccionarFotos(evento) {
    const seleccion = Array.from(evento.target.files || [])
    evento.target.value = ''
    if (seleccion.length > 3 || seleccion.some((f) => !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024)) {
      setError('Selecciona máximo tres fotos JPG, PNG o WebP de hasta 5 MB cada una.')
      return
    }
    setFotos(seleccion)
    setError('')
  }

  function actualizarLocal(item) {
    setItems((actuales) => actuales.map((actual) => actual.id === item.id ? item : actual))
    // La pantalla permanece abierta y el estado se actualiza sin recargar.
    // El componente principal necesita recibir el registro actualizado.
    try {
      onChanged?.(item)
    } catch (error) {
      console.warn('No se pudo refrescar el catálogo local:', error)
    }
  }

  async function guardarCambios(evento) {
    evento.preventDefault()
    if (!editandoId || !form || ocupado) return
    const id = editandoId
    setOcupado(id)
    setError('')
    setAviso('')
    try {
      const datos = { ...form }
      if (fotos.length) {
        const rutas = await subirImagenes(fotos)
        if (!Array.isArray(rutas) || rutas.length !== fotos.length) throw new Error('No se pudieron subir las fotografías seleccionadas.')
        datos.images = rutas
      }
      const respuesta = await editarMiPublicacion(id, datos)
      actualizarLocal(respuesta.item)
      setEditandoId(null)
      setForm(null)
      setFotos([])
      setAviso('Publicación actualizada correctamente.')
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado('')
    }
  }

  async function actuar(item, accion) {
    if (ocupado) return
    if (accion === 'finalizar') {
      const tipo = tipoPorId[item.id] || 'venta'
      const nombre = finalizaciones.find((x) => x.value === tipo)?.label || 'Acuerdo concretado'
      if (!window.confirm(`¿Confirmas: ${nombre.toLowerCase()}? La publicación dejará de aparecer en Explorar.`)) return
    }
    setOcupado(item.id)
    setError('')
    setAviso('')
    try {
      let respuesta
      if (accion === 'finalizar') respuesta = await finalizarMiPublicacion(item.id, tipoPorId[item.id] || 'venta')
      if (accion === 'pausar') respuesta = await pausarMiPublicacion(item.id)
      if (accion === 'reactivar') respuesta = await reactivarMiPublicacion(item.id)
      actualizarLocal(respuesta.item)
      setAviso(accion === 'finalizar'
        ? 'Acuerdo concretado. Puedes seguir gestionando tus publicaciones aquí.'
        : 'Estado de la publicación actualizado.')
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado('')
    }
  }

  async function eliminarDefinitivamente(item) {
    if (ocupado) return
    if (!navigator.onLine) {
      setError('Necesitas conexión para eliminar una publicación del servidor.')
      return
    }
    if (!window.confirm(`¿Eliminar definitivamente «${item.title}»? Se borrarán la publicación y sus reseñas asociadas. Esta acción no se puede deshacer.`)) return

    setOcupado(item.id)
    setError('')
    setAviso('')
    try {
      await eliminarMiPublicacion(item.id)
      setItems((actuales) => actuales.filter((actual) => actual.id !== item.id))
      if (editandoId === item.id) {
        setEditandoId(null)
        setForm(null)
        setFotos([])
      }
      setAviso('Publicación eliminada definitivamente.')
      // El catálogo elimina también esta publicación de su lista local.
      try {
        onChanged?.({ ...item, status: 'eliminado' })
      } catch (error) {
        console.warn('No se pudo actualizar el catálogo local tras eliminar:', error)
      }
    } catch (err) {
      setError(err.message || 'No se pudo eliminar la publicación.')
    } finally {
      setOcupado('')
    }
  }

  return (
    <section className="page container vecired-my-items" aria-labelledby="mis-publicaciones-titulo">
      <button type="button" className="back-link" onClick={onBack}>‹ Volver a Mi cuenta</button>
      <div className="page-heading">
        <h1 id="mis-publicaciones-titulo">Mis publicaciones</h1>
        <p>Edita tus anuncios, páusalos o registra los acuerdos concretados.</p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {aviso && <p className="hint" role="status">{aviso}</p>}
      {cargando && <p>Cargando publicaciones...</p>}
      {!cargando && !items.length && !error && <div className="detail-panel"><p>Aún no tienes publicaciones creadas desde esta cuenta.</p></div>}
      {items.map((item) => (
        <article key={item.id} className="vecired-item">
          <div className="vecired-item-heading">
            <h2>{item.title}</h2>
            <span className="vecired-state">{item.status === 'archivado' && item.completion_type ? `Concretado: ${item.completion_type}` : item.status}</span>
          </div>
          <p className="vecired-help">{item.category} · {item.neighborhood} · {item.price_range}</p>
          {item.completed_at && <p className="vecired-help">Acuerdo registrado: {new Date(item.completed_at).toLocaleDateString('es-PE')}</p>}
          {Array.isArray(item.images) && item.images.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 10 }}>
              {item.images.filter((r) => typeof r === 'string' && /^\/uploads\/[0-9a-f-]+\.webp$/i.test(r)).map((ruta) => (
                <img key={ruta} src={`${API_URL}${ruta}`} alt="Fotografía de la publicación" loading="lazy" style={{ width: 86, height: 76, objectFit: 'cover', borderRadius: 10 }} />
              ))}
            </div>
          )}

          {editandoId === item.id ? (
            <form onSubmit={guardarCambios}>
              <label className="form-label">Título
                <input required minLength={3} maxLength={150} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="form-label">Descripción
                <textarea required minLength={5} maxLength={5000} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <label className="form-label">Categoría
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {!categorias.includes(form.category) && <option value={form.category}>{form.category}</option>}
                  {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="form-label">Zona
                <select value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}>
                  {!zonas.includes(form.neighborhood) && <option value={form.neighborhood}>{form.neighborhood}</option>}
                  {zonas.map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              </label>
              <label className="form-label">Precio o modalidad
                <input maxLength={60} value={form.price_range} onChange={(e) => setForm({ ...form, price_range: e.target.value })} />
              </label>
              <div className="form-label">
                Reemplazar fotos (opcional)
                <PhotoFileField onChange={seleccionarFotos} multiple count={fotos.length} label="Elegir nuevas fotografías" disabled={Boolean(ocupado)} />
                <p className="vecired-help">Si no seleccionas fotos, se conservarán las existentes.</p>
              </div>
              <div className="vecired-item-actions">
                <button type="submit" className="button-primary" disabled={Boolean(ocupado)}>Guardar cambios</button>
                <button type="button" className="button-outline" disabled={Boolean(ocupado)} onClick={() => { setEditandoId(null); setFotos([]) }}>Cancelar</button>
              </div>
            </form>
          ) : (
            <div className="vecired-item-actions">
              <button type="button" className="button-outline" disabled={Boolean(ocupado)} onClick={() => iniciarEdicion(item)}>Editar</button>
              {item.status === 'activo' && <button type="button" className="button-outline" disabled={Boolean(ocupado)} onClick={() => actuar(item, 'pausar')}>Pausar</button>}
              {item.status !== 'activo' && <button type="button" className="button-outline" disabled={Boolean(ocupado)} onClick={() => actuar(item, 'reactivar')}>Reactivar</button>}
              <button type="button" className="button-outline vecired-delete" disabled={Boolean(ocupado)} onClick={() => eliminarDefinitivamente(item)}>Eliminar publicación</button>
            </div>
          )}
          {editandoId !== item.id && item.status !== 'archivado' && item.status !== 'agotado' && (
            <div className="vecired-concretar">
              <label className="form-label">Acuerdo concretado
                <select value={tipoPorId[item.id] || 'venta'} onChange={(e) => setTipoPorId((anterior) => ({ ...anterior, [item.id]: e.target.value }))}>
                  {finalizaciones.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <button className="button-primary" type="button" disabled={Boolean(ocupado)} onClick={() => actuar(item, 'finalizar')}>Marcar como concretado</button>
              <p className="vecired-help">Esto oculta el anuncio del catálogo. En préstamos, indica entrega; no confirma devolución.</p>
            </div>
          )}
        </article>
      ))}
    </section>
  )
}
