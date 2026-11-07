import { useEffect, useState } from 'react'
import BottomNav from './components/BottomNav'
import OfferCard from './components/OfferCard'
import Catalog from './features/catalog/Catalog'
import OfferDetail from './features/catalog/OfferDetail'
import PublishWizard from './features/catalog/PublishWizard'
import Account from './features/auth/Account'
import Tutorial from './features/tutorial/Tutorial'
import MapPage from './features/map/MapPage'
import { CATEGORIAS, ICONOS, OFERTAS_DEMO } from './data/demoData'
import './App.css'

function PendingModule({ titulo, icono, texto, responsable, onBack, onEmergency }) {
  return <section className="pending-module container">
    <div className="pending-icon" aria-hidden="true">{icono}</div>
    <h1>{titulo}</h1>
    <p>{texto}</p>
    <div className="info-panel">Este módulo será implementado por el {responsable}. Todavía no realiza operaciones reales.</div>
    <div className="pending-actions">
      {onEmergency && <button className="button-primary" type="button" onClick={onEmergency}>🚨 Ver modo emergencia</button>}
      <button className="button-outline" type="button" onClick={onBack}>Volver al inicio</button>
    </div>
  </section>
}

export default function App() {
  const [pantalla, setPantalla] = useState('inicio')
  const [ofertas, setOfertas] = useState(OFERTAS_DEMO)
  const [ofertaSeleccionada, setOfertaSeleccionada] = useState(null)
  const [categoria, setCategoria] = useState('Todos')
  const [zona, setZona] = useState('Todas las zonas')
  const [busqueda, setBusqueda] = useState('')
  const [mostrarPublicar, setMostrarPublicar] = useState(false)
  const [enLinea, setEnLinea] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [aviso, setAviso] = useState('')
  const [mapaDestacadoId, setMapaDestacadoId] = useState(null)

  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine)
    window.addEventListener('online', actualizar)
    window.addEventListener('offline', actualizar)
    return () => { window.removeEventListener('online', actualizar); window.removeEventListener('offline', actualizar) }
  }, [])

  const navegar = (destino) => {
    if (destino === 'publicar') { setMostrarPublicar(true); return }
    setAviso('')
    setPantalla(destino)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const abrirOferta = (oferta) => { setOfertaSeleccionada(oferta); navegar('detalle') }
  const explorarCategoria = (opcion) => { setCategoria(opcion); navegar('explorar') }
  const publicar = (oferta) => {
    setOfertas((anteriores) => [oferta, ...anteriores])
    setMostrarPublicar(false)
    setCategoria('Todos'); setZona('Todas las zonas'); setBusqueda('')
    navegar('explorar')
    setAviso('Tu publicación de demostración se agregó solo a esta sesión. No se envió a la nube.')
  }
  const esNav = ['inicio', 'explorar', 'mapa', 'solidaridad', 'emergencia'].includes(pantalla)
  const irAlMapa = (id = null) => { setMapaDestacadoId(id); navegar('mapa') }

  return <div className="app-shell">
    <header className="topbar"><button className="brand" type="button" onClick={() => navegar('inicio')} aria-label="VeciRed, ir al inicio"><span className="brand-symbol">V</span><span>Veci<strong>Red</strong></span></button><div className="topbar-actions"><span className={`connection-state ${enLinea ? 'online' : 'offline'}`}><span aria-hidden="true" className="connection-dot" />{enLinea ? 'Con conexión' : 'Sin conexión'}</span><button className="profile-trigger" type="button" onClick={() => navegar('cuenta')} aria-label="Mi cuenta">👤</button></div></header>
    <main className="app-content">
      {pantalla === 'inicio' && <>
        <section className="home-hero"><span className="hero-pill">TU COMUNIDAD, MÁS CERCA</span><h1>Lo mejor de tu barrio, a un paso.</h1><p>Descubre lo que ofrecen tus vecinos, recomienda y apoya el comercio local.</p><button type="button" className="button-white" onClick={() => navegar('explorar')}>Explorar mi barrio <span aria-hidden="true">→</span></button><button type="button" className="hero-map-link" onClick={() => irAlMapa()}>📍 Ver mapa de mi barrio</button><span className="hero-orbit" aria-hidden="true">✳</span></section>
        <section className="container section-block"><div className="section-title"><div><h2>¿Qué necesitas hoy?</h2><p>Encuentra algo cerca de ti</p></div></div><div className="home-categories">{CATEGORIAS.filter((item) => item !== 'Todos').map((item) => <button key={item} type="button" className="home-category" onClick={() => explorarCategoria(item)}><span aria-hidden="true">{ICONOS[item]}</span>{item}</button>)}</div></section>
        <section className="container section-block"><div className="section-title"><div><h2>Recomendados del barrio</h2><p>Ideas para descubrir</p></div><button type="button" onClick={() => navegar('explorar')}>Ver todo →</button></div><div className="offer-list">{ofertas.slice(0, 3).map((oferta) => <OfferCard key={oferta.id} oferta={oferta} onOpen={abrirOferta} />)}</div></section>
        <section className="container"><button type="button" className="tutorial-banner" onClick={() => navegar('tutorial')}><span>💡</span><span><strong>¿Primera vez en VeciRed?</strong><small>Conoce cómo funciona en pocos pasos</small></span><span aria-hidden="true">›</span></button><p className="demo-disclaimer">Versión de demostración. Los perfiles, ofertas y recomendaciones son ficticios.</p></section>
      </>}
      {pantalla === 'explorar' && <><Catalog ofertas={ofertas} busqueda={busqueda} onBusqueda={setBusqueda} categoria={categoria} onCategoria={setCategoria} zona={zona} onZona={setZona} onOpen={abrirOferta} onMap={() => irAlMapa()}/>{aviso && <p className="toast-notice" role="status">{aviso}</p>}</>}
      {pantalla === 'detalle' && ofertaSeleccionada && <OfferDetail oferta={ofertaSeleccionada} onBack={() => navegar('explorar')} onMap={() => irAlMapa(ofertaSeleccionada.id)} />}
      {pantalla === 'mapa' && <MapPage ofertas={ofertas} categoria={categoria} onCategoria={setCategoria} zona={zona} onZona={setZona} busqueda={busqueda} onBusqueda={setBusqueda} onOpen={abrirOferta} onPublish={() => navegar('publicar')} enLinea={enLinea} destacadoId={mapaDestacadoId} />}
      {pantalla === 'cuenta' && <Account onBack={() => navegar('inicio')} onTutorial={() => navegar('tutorial')} />}
      {pantalla === 'tutorial' && <Tutorial onBack={() => navegar('cuenta')} onExplore={() => navegar('explorar')} />}
      {pantalla === 'solidaridad' && <PendingModule titulo="Red de solidaridad" icono="🤝" texto="Préstamos, donaciones, favores e intercambios con personas de tu comunidad." responsable="Integrante 3" onBack={() => navegar('inicio')} onEmergency={() => navegar('emergencia')} />}
      {pantalla === 'emergencia' && <PendingModule titulo="Modo emergencia" icono="🚨" texto="Recursos y solicitudes de apoyo ante situaciones críticas. Esta vista todavía no envía alertas." responsable="Integrante 3" onBack={() => navegar('inicio')}/>}
    </main>
    <BottomNav actual={esNav ? pantalla : ''} onNavigate={navegar}/>
    {mostrarPublicar && <PublishWizard onClose={() => setMostrarPublicar(false)} onCreate={publicar} />}
  </div>
}
