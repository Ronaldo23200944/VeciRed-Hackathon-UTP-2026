// Barra compartida mobile-first: cinco accesos, sin duplicar Perfil ni Emergencias.
// Perfil se abre desde la cabecera; Emergencias desde la sección Ayuda.
const ENLACES = [
  { id: 'inicio', etiqueta: 'Inicio' },
  { id: 'explorar', etiqueta: 'Explorar' },
  { id: 'publicar', etiqueta: 'Publicar' },
  { id: 'mapa', etiqueta: 'Mapa' },
  { id: 'solidaridad', etiqueta: 'Ayuda' },
]

function IconoNavegacion({ id }) {
  const formas = {
    inicio: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-7h6v7" /></>,
    explorar: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    publicar: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    mapa: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    solidaridad: <><path d="M20.5 5.5a5.5 5.5 0 0 0-7.8 0L12 6.2l-.7-.7a5.5 5.5 0 0 0-7.8 7.8L12 21l8.5-7.7a5.5 5.5 0 0 0 0-7.8Z" /></>,
  }

  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {formas[id]}
  </svg>
}

export default function BottomNav({ actual, onNavigate }) {
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {ENLACES.map(({ id, etiqueta }) => {
        const activo = actual === id || (id === 'solidaridad' && actual === 'emergencia')
        return (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            className={`bottom-nav-item${activo ? ' active' : ''}${id === 'publicar' ? ' is-publish' : ''}`}
            aria-current={activo ? 'page' : undefined}
            aria-label={id === 'publicar' ? 'Crear publicación' : etiqueta}
          >
            <span className="bottom-nav-icon"><IconoNavegacion id={id} /></span>
            <span className="bottom-nav-label">{etiqueta}</span>
          </button>
        )
      })}
    </nav>
  )
}
