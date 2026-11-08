
import { useEffect, useState } from 'react'

import BottomNav from './components/BottomNav'
import CategoryIcon from './components/CategoryIcon'
import OfferCard from './components/OfferCard'

import Catalog from './features/catalog/Catalog'
import OfferDetail from './features/catalog/OfferDetail'
import PublishWizard from './features/catalog/PublishWizard'
import MyPublications from './features/catalog/MyPublications'

import Account from './features/auth/Account'
import Tutorial from './features/tutorial/Tutorial'
import MapPage from './features/map/MapPage'
import SolidarityHub from './features/solidarity/SolidarityHub'

import {
  CATEGORIAS,
  ICONOS,
  OFERTAS_DEMO,
} from './data/demoData'

import {
  obtenerPublicaciones,
  crearPublicacion,
  subirImagenes,
  obtenerToken,
  obtenerPerfil,
} from './api/veciredApi'

import {
  aOferta,
  aPublicacion,
} from './api/adaptadores'
import { obtenerAvatarUrl } from './api/perfilApi'

import './App.css'
import './styles/vecired-final.css'
import OfflineWidget from './offline/OfflineWidget'
import {
  saveToOutbox,
  getOutboxItems,
  sincronizarPendientes,
  obtenerIdVecinoActual,
} from './offline/syncManager'

// Foto en la cabecera: muestra fallback si todavía no hay avatar o falla la URL.
function AvatarCabecera({ perfil }) {
  const ruta = obtenerAvatarUrl(perfil?.avatar_url)
  const [fallo, setFallo] = useState(false)
  useEffect(() => setFallo(false), [ruta])

  if (ruta && !fallo) {
    return <img className="profile-trigger-image" src={ruta} alt="" onError={() => setFallo(true)} />
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}

// Ofertas textuales guardadas localmente mientras no había red.
function aOfertaPendiente(entrada) {
  const datos = entrada.data || {}
  const categoria = datos.category || 'Hogar'
  return {
    id: entrada.client_id,
    titulo: datos.title || '',
    descripcion: datos.description || '',
    detalle: datos.description || '',
    categoria,
    zona: datos.neighborhood || 'Zona vecinal',
    precio: datos.price_range || 'A coordinar',
    vendedor: 'Pendiente de sincronización',
    icono: ICONOS[categoria] || '🏠',
    imagenes: [],
    opiniones: [],
    lat: null,
    lng: null,
    origen: 'pendiente',
  }
}

// ============================================================
// APLICACIÓN PRINCIPAL
// ============================================================

export default function App() {

  // ----------------------------------------------------------
  // ESTADOS GENERALES
  // ----------------------------------------------------------

  const [pantalla, setPantalla] = useState('inicio')

  const [ofertas, setOfertas] = useState(OFERTAS_DEMO)

  const [ofertaSeleccionada, setOfertaSeleccionada] =
    useState(null)

  const [categoria, setCategoria] = useState('Todos')

  const [zona, setZona] = useState('Todas las zonas')

  const [busqueda, setBusqueda] = useState('')

  const [mostrarPublicar, setMostrarPublicar] =
    useState(false)

  const [enLinea, setEnLinea] = useState(
    typeof navigator === 'undefined'
      ? true
      : navigator.onLine
  )

  const [aviso, setAviso] = useState('')
  const [perfilCabecera, setPerfilCabecera] = useState(null)

  const [mapaDestacadoId, setMapaDestacadoId] =
    useState(null)

  const [modoDemostracion, setModoDemostracion] =
    useState(true)

  // ----------------------------------------------------------
  // REFRESCAR CABECERA AL CAMBIAR CUENTA O FOTO DE PERFIL
  // ----------------------------------------------------------

  useEffect(() => {
    let montado = true
    let solicitud = 0

    async function consultarCuenta() {
      const actual = ++solicitud
      if (!obtenerToken()) {
        if (montado) setPerfilCabecera(null)
        return
      }
      try {
        const perfil = await obtenerPerfil()
        if (montado && actual === solicitud) setPerfilCabecera(perfil)
      } catch {
        if (montado && actual === solicitud) setPerfilCabecera(null)
      }
    }

    function recibirPerfil(evento) {
      const perfil = evento.detail?.perfil
      if (perfil && obtenerToken()) {
        solicitud += 1
        if (montado) setPerfilCabecera(perfil)
      } else {
        consultarCuenta()
      }
    }

    consultarCuenta()
    window.addEventListener('vecired:auth-changed', consultarCuenta)
    window.addEventListener('vecired:profile-updated', recibirPerfil)
    return () => {
      montado = false
      window.removeEventListener('vecired:auth-changed', consultarCuenta)
      window.removeEventListener('vecired:profile-updated', recibirPerfil)
    }
  }, [])

  // ----------------------------------------------------------
  // DETECTAR CONEXIÓN A INTERNET
  // ----------------------------------------------------------

  useEffect(() => {
    const actualizar = () => {
      setEnLinea(navigator.onLine)
    }

    window.addEventListener('online', actualizar)
    window.addEventListener('offline', actualizar)

    return () => {
      window.removeEventListener('online', actualizar)
      window.removeEventListener('offline', actualizar)
    }
  }, [])

  // ----------------------------------------------------------
  // CARGAR PUBLICACIONES REALES DESDE POSTGRESQL
  // ----------------------------------------------------------

  useEffect(() => {
    let activo = true

    async function cargarPublicaciones() {
      try {
        const publicaciones = await obtenerPublicaciones()

        if (!activo) return

        if (!Array.isArray(publicaciones)) {
          throw new Error(
            'La API no devolvió una lista de publicaciones.'
          )
        }

        console.log(
          `VeciRed: ${publicaciones.length} publicaciones reales encontradas`
        )

        if (publicaciones.length > 0) {
          const ofertasReales = publicaciones.map(aOferta)

          setOfertas((anteriores) => [
            ...anteriores.filter((oferta) => oferta.origen === 'pendiente'),
            ...ofertasReales,
          ])
          setModoDemostracion(false)
        } else {
          // Se conservan las ofertas de demostración
          // cuando todavía no hay publicaciones reales.
          setOfertas((anteriores) => {
            const pendientes = anteriores.filter(
              (oferta) => oferta.origen === 'pendiente'
            )
            return pendientes.length ? pendientes : OFERTAS_DEMO
          })
        }

      } catch (error) {
        if (!activo) return

        console.error(
          'Error consultando PostgreSQL:',
          error.message
        )
      }
    }

    cargarPublicaciones()

    return () => {
      activo = false
    }
  }, [])

  // ----------------------------------------------------------
  // COLA OFFLINE: MOSTRAR PENDIENTES Y SINCRONIZAR AL VOLVER
  // ----------------------------------------------------------

  useEffect(() => {
    let montado = true

    async function cargarPendientes() {
      try {
        const usuario = obtenerIdVecinoActual()
        const entradas = await getOutboxItems()
        if (!montado) return

        setOfertas((anteriores) => {
          const otras = anteriores.filter((oferta) => oferta.origen !== 'pendiente')
          const pendientes = entradas
            .filter((registro) => registro.owner_id === usuario && registro.entity === 'items')
            .map(aOfertaPendiente)
          return pendientes.length
            ? [
                ...pendientes,
                ...otras.filter((oferta) => !OFERTAS_DEMO.some((demo) => demo.id === oferta.id)),
              ]
            : otras
        })
      } catch (error) {
        console.warn('No se pudo leer la cola offline:', error)
      }
    }

    async function recuperarConexion() {
      if (!navigator.onLine || !obtenerToken()) return

      try {
        const resultado = await sincronizarPendientes()
        if (!montado) return

        await cargarPendientes()
        if (resultado.sincronizadas > 0) {
          const publicaciones = await obtenerPublicaciones()
          if (!montado) return
          if (Array.isArray(publicaciones)) {
            setOfertas((anteriores) => [
              ...anteriores.filter((oferta) => oferta.origen === 'pendiente'),
              ...publicaciones.map(aOferta),
            ])
            setModoDemostracion(false)
          }
          setAviso(`${resultado.sincronizadas} publicación(es) pendiente(s) sincronizada(s) con PostgreSQL.`)
        }
        if (resultado.fallidas > 0) {
          setAviso('Hay publicaciones sin sincronizar. Comprueba tu conexión y vuelve a intentarlo.')
        }
      } catch (error) {
        console.warn('La sincronización quedó pendiente:', error.message)
      }
    }

    function alConectar() {
      recuperarConexion()
    }

    function alCambiarCuenta() {
      cargarPendientes()
      recuperarConexion()
    }

    cargarPendientes()
    recuperarConexion()
    window.addEventListener('online', alConectar)
    window.addEventListener('vecired:auth-changed', alCambiarCuenta)

    return () => {
      montado = false
      window.removeEventListener('online', alConectar)
      window.removeEventListener('vecired:auth-changed', alCambiarCuenta)
    }
  }, [])

  // ----------------------------------------------------------
  // NAVEGACIÓN
  // ----------------------------------------------------------

  const navegar = (destino) => {
    if (destino === 'publicar') {
      if (!obtenerToken()) {
        setMostrarPublicar(false)
        setPantalla('cuenta')
        setAviso('Para publicar una oferta, inicia sesión o crea tu cuenta vecinal.')
        window.scrollTo({ top: 0, behavior: 'instant' })
        return
      }
      setAviso('')
      setMostrarPublicar(true)
      return
    }

    setAviso('')
    setPantalla(destino)

    window.scrollTo({
      top: 0,
      behavior: 'instant',
    })
  }

  const abrirOferta = (oferta) => {
    setOfertaSeleccionada(oferta)
    navegar('detalle')
  }

  const explorarCategoria = (opcion) => {
    setCategoria(opcion)
    navegar('explorar')
  }

  const irAlMapa = (id = null) => {
    setMapaDestacadoId(id)
    navegar('mapa')
  }

  // ----------------------------------------------------------
  // PUBLICAR OFERTA REAL CON IMÁGENES
  // ----------------------------------------------------------

  const publicar = async (oferta) => {

    // Verificar que el vecino esté autenticado.
    if (!obtenerToken()) {
      throw new Error(
        'Debes iniciar sesión en Mi cuenta antes de publicar.'
      )
    }

    // Separar los archivos del resto de los datos.
    const {
      archivos = [],
      ...datosOferta
    } = oferta

    // Toda publicación nueva requiere al menos una fotografía.
    if (!Array.isArray(archivos) || archivos.length < 1 || archivos.length > 3) {
      throw new Error('Selecciona de una a tres fotografías para publicar.')
    }

    // IndexedDB guarda los archivos pendientes si no hay conexión.
    if (!navigator.onLine) {
      const registro = await saveToOutbox(aPublicacion(datosOferta), archivos)
      const pendiente = aOfertaPendiente(registro)
      setOfertas((anteriores) => [
        pendiente,
        ...(modoDemostracion
          ? anteriores.filter((actual) => actual.origen === 'pendiente')
          : anteriores.filter((actual) => actual.id !== pendiente.id)),
      ])
      setModoDemostracion(false)
      setMostrarPublicar(false)
      setCategoria('Todos')
      setZona('Todas las zonas')
      setBusqueda('')
      navegar('explorar')
      setAviso('Publicación y fotos guardadas en este dispositivo. Se sincronizarán al recuperar Internet.')
      return
    }

    // 1. Subir imágenes al backend.
    // Si no hay imágenes, devuelve un arreglo vacío.
    const images = await subirImagenes(archivos)

    // 2. Convertir los datos al formato PostgreSQL.
    const datosPublicacion = {
      ...aPublicacion(datosOferta),
      images,
    }

    // 3. Crear publicación real.
    const respuesta = await crearPublicacion(
      datosPublicacion
    )

    // 4. Comprobar que PostgreSQL la haya guardado.
    if (!respuesta.item?.id) {
      throw new Error(
        'El servidor no confirmó la publicación.'
      )
    }

    // 5. Adaptar la respuesta para React.
    const nuevaOferta = aOferta(respuesta.item)

    // 6. Mostrar la publicación inmediatamente.
    setOfertas((anteriores) => {

      const ofertasActuales = modoDemostracion
        ? []
        : anteriores

      return [
        nuevaOferta,
        ...ofertasActuales.filter(
          (existente) =>
            existente.id !== nuevaOferta.id
        ),
      ]
    })

    // Ya estamos trabajando con publicaciones reales.
    setModoDemostracion(false)

    // 7. Cerrar formulario.
    setMostrarPublicar(false)

    // 8. Restablecer los filtros.
    setCategoria('Todos')
    setZona('Todas las zonas')
    setBusqueda('')

    // 9. Ir al catálogo.
    navegar('explorar')

    // 10. Mostrar confirmación.
    setAviso(
      '¡Tu publicación se guardó correctamente en VeciRed!'
    )
  }

  // ----------------------------------------------------------
  // BOTONES DE NAVEGACIÓN INFERIOR
  // ----------------------------------------------------------

  const esNav = [
    'inicio',
    'explorar',
    'mapa',
    'solidaridad',
    'emergencia',
  ].includes(pantalla)

  // ==========================================================
  // INTERFAZ
  // ==========================================================

  return (
    <div className="app-shell">

      {/* ================================================== */}
      {/* ENCABEZADO */}
      {/* ================================================== */}

      <header className="topbar">

        <button
          className="brand"
          type="button"
          onClick={() => navegar('inicio')}
          aria-label="VeciRed, ir al inicio"
        >
          <span className="brand-symbol">
            V
          </span>

          <span>
            Veci<strong>Red</strong>
          </span>
        </button>

        <div className="topbar-actions">

          <span
            className={`connection-state ${
              enLinea ? 'online' : 'offline'
            }`}
          >
            <span
              aria-hidden="true"
              className="connection-dot"
            />

            {enLinea
              ? 'Con conexión'
              : 'Sin conexión'}
          </span>

          <button
            className="profile-trigger"
            type="button"
            onClick={() => navegar('cuenta')}
            aria-label={perfilCabecera?.full_name ? `Mi cuenta: ${perfilCabecera.full_name}` : 'Mi cuenta'}
          >
            <AvatarCabecera perfil={perfilCabecera} />
          </button>

        </div>

      </header>

      {/* ================================================== */}
      {/* CONTENIDO PRINCIPAL */}
      {/* ================================================== */}

      <main className="app-content">

        {/* ================================================ */}
        {/* INICIO */}
        {/* ================================================ */}

        {pantalla === 'inicio' && (
          <>

            <section className="home-hero">

              <span className="hero-pill">
                TU COMUNIDAD, MÁS CERCA
              </span>

              <h1>
                Lo mejor de tu barrio, a un paso.
              </h1>

              <p>
                Descubre lo que ofrecen tus vecinos,
                recomienda y apoya el comercio local.
              </p>

              <button
                type="button"
                className="button-white"
                onClick={() => navegar('explorar')}
              >
                Explorar mi barrio{' '}
                <span aria-hidden="true">
                  →
                </span>
              </button>

              <button
                type="button"
                className="hero-map-link"
                onClick={() => irAlMapa()}
              >
                Ver mapa de mi barrio
              </button>

              <span
                className="hero-orbit"
                aria-hidden="true"
              >
                ✳
              </span>

            </section>

            {/* CATEGORÍAS */}

            <section className="container section-block">

              <div className="section-title">
                <div>
                  <h2>¿Qué necesitas hoy?</h2>
                  <p>Encuentra algo cerca de ti</p>
                </div>
              </div>

              <div className="home-categories">

                {CATEGORIAS
                  .filter(
                    (item) => item !== 'Todos'
                  )
                  .map((item) => (

                    <button
                      key={item}
                      type="button"
                      className="home-category"
                      onClick={() =>
                        explorarCategoria(item)
                      }
                    >
                      <span aria-hidden="true">
                        <CategoryIcon categoria={item} />
                      </span>

                      {item}
                    </button>

                  ))}

              </div>

            </section>

            {/* RECOMENDADOS */}

            <section className="container section-block">

              <div className="section-title">

                <div>
                  <h2>Recomendados del barrio</h2>
                  <p>Ideas para descubrir</p>
                </div>

                <button
                  type="button"
                  onClick={() => navegar('explorar')}
                >
                  Ver todo →
                </button>

              </div>

              <div className="offer-list">

                {ofertas
                  .slice(0, 3)
                  .map((oferta) => (

                    <OfferCard
                      key={oferta.id}
                      oferta={oferta}
                      onOpen={abrirOferta}
                    />

                  ))}

              </div>

            </section>

            {/* TUTORIAL */}

            <section className="container">

              <button
                type="button"
                className="tutorial-banner"
                onClick={() => navegar('tutorial')}
              >

                <span><CategoryIcon categoria="Tutorial" /></span>

                <span>
                  <strong>
                    ¿Primera vez en VeciRed?
                  </strong>

                  <small>
                    Conoce cómo funciona en pocos pasos
                  </small>
                </span>

                <span aria-hidden="true">
                  ›
                </span>

              </button>

              <p className="demo-disclaimer">
                {modoDemostracion
                  ? 'Versión de demostración. Los perfiles, ofertas y recomendaciones mostrados son ficticios.'
                  : 'Catálogo conectado a PostgreSQL. Algunas funciones de VeciRed todavía están en desarrollo.'}
              </p>

            </section>

          </>
        )}

        {/* ================================================ */}
        {/* EXPLORAR */}
        {/* ================================================ */}

        {pantalla === 'explorar' && (
          <>

            <Catalog
              ofertas={ofertas}
              busqueda={busqueda}
              onBusqueda={setBusqueda}
              categoria={categoria}
              onCategoria={setCategoria}
              zona={zona}
              onZona={setZona}
              onOpen={abrirOferta}
              onMap={() => irAlMapa()}
            />

            {aviso && (
              <p
                className="toast-notice"
                role="status"
              >
                {aviso}
              </p>
            )}

          </>
        )}

        {/* ================================================ */}
        {/* DETALLE DE PUBLICACIÓN */}
        {/* ================================================ */}

        {pantalla === 'detalle' &&
          ofertaSeleccionada && (

            <OfferDetail
              oferta={ofertaSeleccionada}
              onBack={() => navegar('explorar')}
              onMap={() =>
                irAlMapa(ofertaSeleccionada.id)
              }
            />

          )}

        {/* ================================================ */}
        {/* MAPA */}
        {/* ================================================ */}

        {pantalla === 'mapa' && (

          <MapPage
            ofertas={ofertas}
            categoria={categoria}
            onCategoria={setCategoria}
            zona={zona}
            onZona={setZona}
            busqueda={busqueda}
            onBusqueda={setBusqueda}
            onOpen={abrirOferta}
            onPublish={() => navegar('publicar')}
            enLinea={enLinea}
            destacadoId={mapaDestacadoId}
          />

        )}

        {/* ================================================ */}
        {/* MI CUENTA */}
        {/* ================================================ */}

        {pantalla === 'mis-publicaciones' && <MyPublications onBack={() => navegar('cuenta')} onChanged={(item) => { setOfertas((actuales) => item.status === 'activo' ? [aOferta(item), ...actuales.filter((o) => o.id !== item.id)] : actuales.filter((o) => o.id !== item.id)) }} />}
      {pantalla === 'cuenta' && (

          <Account
            onBack={() => navegar('inicio')}
            onTutorial={() => navegar('tutorial')}
            onMyItems={() => navegar('mis-publicaciones')}
            mensajeAcceso={!obtenerToken() ? aviso : ''} />

        )}

        {/* ================================================ */}
        {/* TUTORIAL */}
        {/* ================================================ */}

        {pantalla === 'tutorial' && (

          <Tutorial
            onBack={() => navegar('cuenta')}
            onExplore={() => navegar('explorar')}
          />

        )}

        {/* ================================================ */}
        {/* SOLIDARIDAD */}
        {/* ================================================ */}

        {pantalla === 'solidaridad' && (<SolidarityHub mode="solidaridad" onBack={() => navegar('inicio')} />)}

        {pantalla === 'emergencia' && (<SolidarityHub mode="emergencia" onBack={() => navegar('inicio')} />)}

      </main>

      {/* ================================================== */}
      {/* NAVEGACIÓN INFERIOR */}
      {/* ================================================== */}

      <BottomNav
        actual={esNav ? pantalla : ''}
        onNavigate={navegar}
      />

      {/* ================================================== */}
      {/* FORMULARIO DE PUBLICACIÓN */}
      {/* ================================================== */}

      {mostrarPublicar && (

        <PublishWizard
          onClose={() => setMostrarPublicar(false)}
          onCreate={publicar}
          enLinea={enLinea}
        />

      )}

      <OfflineWidget />
    </div>
  )
}
