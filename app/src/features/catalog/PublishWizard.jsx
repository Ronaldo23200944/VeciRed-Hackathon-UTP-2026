import { useEffect, useState } from 'react'
import { CATEGORIAS, ICONOS, ZONAS } from '../../data/demoData'
import PhotoFileField from '../../components/PhotoFileField'
import CategoryIcon from '../../components/CategoryIcon'

const INICIAL = {
  titulo: '',
  categoria: 'Comida',
  descripcion: '',
  zona: 'Cercado',
  precio: '',
}

const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_MB = 5

function VistasPrevias({ vistas, quitarImagen, guardando }) {
  if (!vistas.length) return null
  return (
    <div className="vecired-foto-grid" aria-label="Fotografías seleccionadas">
      {vistas.map((vista, indice) => (
        <div className="vecired-foto-preview" key={vista.url}>
          <img src={vista.url} alt={`Vista previa de fotografía ${indice + 1}`} />
          <button type="button" className="back-link" disabled={guardando}
            onClick={() => quitarImagen(indice)}
            aria-label={`Quitar fotografía ${indice + 1}`}>
            Quitar
          </button>
        </div>
      ))}
    </div>
  )
}

export default function PublishWizard({ onClose, onCreate, enLinea = true }) {
  const [paso, setPaso] = useState(1)
  const [datos, setDatos] = useState(INICIAL)
  const [archivos, setArchivos] = useState([])
  const [vistas, setVistas] = useState([])
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [revisando, setRevisando] = useState(false)

  useEffect(() => {
    const cerrarEsc = (evento) => {
      if (evento.key === 'Escape' && !guardando) onClose()
    }

    window.addEventListener('keydown', cerrarEsc)
    return () => window.removeEventListener('keydown', cerrarEsc)
  }, [onClose, guardando])

  useEffect(() => {
    const nuevasVistas = archivos.map((archivo) => ({
      nombre: archivo.name,
      url: URL.createObjectURL(archivo),
    }))

    setVistas(nuevasVistas)

    return () => {
      nuevasVistas.forEach((vista) => {
        URL.revokeObjectURL(vista.url)
      })
    }
  }, [archivos])

  function cambiar(campo, valor) {
    setDatos((actual) => ({ ...actual, [campo]: valor }))
    setError('')
  }

  function seleccionarImagenes(evento) {
    const seleccion = Array.from(evento.target.files || [])
    evento.target.value = ''

    if (archivos.length + seleccion.length > 3) {
      setError('Puedes seleccionar como máximo 3 fotografías.')
      return
    }

    for (const archivo of seleccion) {
      if (!TIPOS.includes(archivo.type)) {
        setError('Solo se permiten imágenes JPG, PNG y WebP.')
        return
      }

      if (archivo.size > MAX_MB * 1024 * 1024) {
        setError('Cada fotografía debe pesar como máximo 5 MB.')
        return
      }
    }

    setArchivos((actual) => [...actual, ...seleccion])
    setError('')
  }

  function quitarImagen(indice) {
    setArchivos((actual) =>
      actual.filter((_, posicion) => posicion !== indice)
    )
  }

  function siguiente() {
    if (
      paso === 2 &&
      (!datos.titulo.trim() || !datos.descripcion.trim())
    ) {
      setError('Escribe un título y una descripción para continuar.')
      return
    }

    if (paso === 2 && archivos.length === 0) {
      setError('Añade al menos una fotografía para continuar.')
      return
    }

    setError('')
    setPaso((actual) => Math.min(3, actual + 1))
  }

  async function crear(evento) {
    evento.preventDefault()

    // Nunca publicar desde los pasos 1/2 ni desde los campos del paso 3.
    // La confirmación final es obligatoria y explícita.
    if (paso !== 3) {
      siguiente()
      return
    }
    if (archivos.length === 0) {
      setRevisando(false)
      setError('Debes añadir al menos una fotografía antes de publicar.')
      return
    }
    if (!revisando) {
      setRevisando(true)
      return
    }

    if (
      !datos.titulo.trim() ||
      !datos.descripcion.trim() ||
      !datos.zona
    ) {
      setError('Completa los campos obligatorios.')
      return
    }

    if (guardando) return

    setGuardando(true)
    setError('')

    try {
      await onCreate({
        titulo: datos.titulo.trim(),
        categoria: datos.categoria,
        descripcion: datos.descripcion.trim(),
        zona: datos.zona,
        precio: datos.precio.trim() || 'A coordinar',
        archivos,
      })
    } catch (err) {
      setError(err.message || 'No se pudo guardar la publicación.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(evento) => {
        if (
          evento.target === evento.currentTarget &&
          !guardando
        ) {
          onClose()
        }
      }}
    >
      <section
        className="wizard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publicar-titulo"
      >
        <header className="wizard-header">
          <div>
            <span className="eyebrow">MERCADO VECINAL</span>
            <h2 id="publicar-titulo">Publicar una oferta</h2>
          </div>

          <button
            className="close-button"
            type="button"
            onClick={onClose}
            disabled={guardando}
            aria-label="Cerrar formulario"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="steps-label">Paso {paso} de 3 {revisando ? " · Confirmación" : ""}</div>

        <div className="steps-progress" aria-hidden="true">
          <span style={{ width: `${(paso / 3) * 100}%` }} />
        </div>

        <form onSubmit={crear}>
          {paso === 1 && (
            <div className="wizard-stage">
              <h3>¿Qué vas a ofrecer?</h3>
              <p>Elige la categoría de tu producto o servicio.</p>

              <div className="category-grid">
                {CATEGORIAS.filter(
                  (item) => item !== 'Todos'
                ).map((item) => (
                  <button
                    type="button"
                    key={item}
                    aria-pressed={datos.categoria === item}
                    className={`category-option ${
                      datos.categoria === item ? 'chosen' : ''
                    }`}
                    onClick={() => cambiar('categoria', item)}
                  >
                    <span><CategoryIcon categoria={item} /></span>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {paso === 2 && (
            <div className="wizard-stage">
              <h3>Cuéntanos qué ofreces</h3>

              <label className="form-label">
                Nombre del producto o servicio
                <input
                  autoFocus
                  required
                  maxLength={70}
                  placeholder="Ej. Lasañas caseras"
                  value={datos.titulo}
                  onChange={(e) =>
                    cambiar('titulo', e.target.value)
                  }
                />
              </label>

              <label className="form-label">
                Descripción
                <textarea
                  required
                  maxLength={280}
                  rows={5}
                  placeholder="Describe tu producto o servicio..."
                  value={datos.descripcion}
                  onChange={(e) =>
                    cambiar('descripcion', e.target.value)
                  }
                />
              </label>

              <div className="vecired-fotos-paso">
                <strong>Fotografías del producto o servicio (obligatorio, de 1 a 3)</strong>
                <PhotoFileField
                  multiple
                  count={archivos.length}
                  onChange={seleccionarImagenes}
                  disabled={archivos.length >= 3 || guardando}
                />
                <p className="hint">
                  Puedes seleccionar JPG, PNG o WebP; hasta 5 MB por foto.
                  En el siguiente paso podrás añadir o quitar imágenes antes de publicar.
                </p>
                {!enLinea && (
                  <p className="hint" role="status">
                    Sin conexión: las fotografías se guardarán temporalmente en este dispositivo
                    y se subirán al servidor cuando vuelva Internet e inicies sesión.
                  </p>
                )}
                <VistasPrevias vistas={vistas} quitarImagen={quitarImagen} guardando={guardando} />
              </div>
            </div>
          )}

          {paso === 3 && !revisando && (
            <div className="wizard-stage">
              <h3>Completa tu publicación</h3>

              <label className="form-label">
                Zona o barrio
                <select
                  value={datos.zona}
                  onChange={(e) =>
                    cambiar('zona', e.target.value)
                  }
                >
                  {ZONAS.filter(
                    (zona) => zona !== 'Todas las zonas'
                  ).map((zona) => (
                    <option key={zona}>{zona}</option>
                  ))}
                </select>
              </label>

              <label className="form-label">
                Precio o modalidad
                <input
                  maxLength={60}
                  placeholder="Ej. Desde S/ 15"
                  value={datos.precio}
                  onChange={(e) =>
                    cambiar('precio', e.target.value)
                  }
                />
              </label>

              <div className="form-label">
                Fotografías (obligatorio, de 1 a 3)
                <PhotoFileField
                  multiple
                  count={archivos.length}
                  onChange={seleccionarImagenes}
                  disabled={archivos.length >= 3 || guardando}
                />
              </div>

              <p className="hint">
                JPG, PNG o WebP. Máximo 5 MB por fotografía.
                Debes incluir al menos una fotografía.
              </p>

              {!enLinea && (
                <p className="hint" role="status">
                  Sin conexión: las fotos y el anuncio quedarán guardados en este dispositivo.
                  Se sincronizarán al recuperar la conexión.
                </p>
              )}

              <VistasPrevias vistas={vistas} quitarImagen={quitarImagen} guardando={guardando} />

              <div className="info-panel">
                Tu publicación se guardará en VeciRed y estará
                disponible para otros vecinos.
              </div>
            </div>
          )}

          {paso === 3 && revisando && (
            <div className="wizard-stage vecired-review" role="region" aria-label="Revisión de publicación">
              <h3>Revisa tu oferta antes de publicarla</h3>
              <p>Nada se enviará hasta que pulses «Confirmar y publicar».</p>
              <dl className="vecired-review-data">
                <div><dt>Categoría</dt><dd>{datos.categoria}</dd></div>
                <div><dt>Título</dt><dd>{datos.titulo.trim()}</dd></div>
                <div><dt>Descripción</dt><dd>{datos.descripcion.trim()}</dd></div>
                <div><dt>Barrio o distrito</dt><dd>{datos.zona}</dd></div>
                <div><dt>Precio o modalidad</dt><dd>{datos.precio.trim() || 'A coordinar'}</dd></div>
                <div><dt>Fotografías</dt><dd>{archivos.length} de 3</dd></div>
              </dl>
              <VistasPrevias vistas={vistas} quitarImagen={quitarImagen} guardando={guardando} />
              {!enLinea && <p className="hint">Sin conexión: el anuncio y sus fotografías quedarán pendientes de sincronización.</p>}
              <div className="info-panel">Comprueba los datos. Puedes volver a editarlos sin perder lo escrito.</div>
            </div>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="wizard-actions">
            {paso > 1 && (
              <button
                className="button-outline"
                type="button"
                disabled={guardando}
                onClick={() => {
                  if (revisando) setRevisando(false)
                  else setPaso((actual) => actual - 1)
                  setError('')
                }}
              >
                {revisando ? 'Volver a editar' : 'Atrás'}
              </button>
            )}

            {paso < 3 ? (
              <button
                className="button-primary"
                type="button"
                onClick={siguiente}
              >
                Continuar
              </button>
            ) : !revisando ? (
              <button className="button-primary" type="button"
                disabled={guardando}
                onClick={() => {
                  if (archivos.length === 0) {
                    setError('Añade al menos una fotografía para revisar la publicación.')
                    return
                  }
                  setRevisando(true)
                  setError('')
                }}>
                Revisar antes de publicar →
              </button>
            ) : (
              <button
                className="button-primary"
                type="submit"
                disabled={guardando}
              >
                {guardando
                  ? 'Guardando publicación...'
                  : enLinea
                    ? 'Confirmar y publicar'
                    : 'Confirmar guardado pendiente'}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  )
}
