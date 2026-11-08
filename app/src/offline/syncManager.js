import { initDB, OUTBOX_STORE } from './db.js'
import { subirImagenes } from '../api/veciredApi'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '')
const TOKEN_KEY = 'vecired_token'

// La identidad se extrae únicamente para separar las colas locales.
// El servidor valida el JWT de forma independiente en cada solicitud.
export function obtenerIdVecinoActual() {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const segmento = token?.split('.')[1]
    if (!segmento) return null
    const base64 = segmento.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64))
    return typeof payload.id === 'string' ? payload.id : null
  } catch {
    return null
  }
}

function generarClientId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `vecired-${crypto.randomUUID()}`
  }
  return `vecired-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Guarda el anuncio y sus fotos en IndexedDB, nunca contraseñas ni JWT.
// Las fotos se subirán al reconectarse antes de confirmar /api/sync/batch.
export async function saveToOutbox(data, archivos = []) {
  const owner_id = obtenerIdVecinoActual()
  if (!owner_id) {
    throw new Error('Debes iniciar sesión para guardar publicaciones sin conexión.')
  }
  if (!data?.title?.trim() || !data?.description?.trim() || !data?.neighborhood) {
    throw new Error('Completa título, descripción y zona antes de guardar.')
  }
  if (!Array.isArray(archivos) || archivos.length < 1 || archivos.length > 3) {
    throw new Error('Para publicar necesitas entre una y tres fotografías.')
  }
  if (archivos.some((archivo) =>
    !['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type) ||
    archivo.size > 5 * 1024 * 1024 || archivo.size === 0
  )) {
    throw new Error('Solo puedes guardar fotos JPG, PNG o WebP de hasta 5 MB.')
  }

  const client_id = generarClientId()
  const registro = {
    id: client_id, // IndexedDB usa keyPath id
    client_id,     // El endpoint SQL utiliza esta clave para idempotencia
    owner_id,
    entity: 'items',
    action: 'create',
    // File/Blob admite clonación estructurada en IndexedDB.
    archivos: archivos.map((archivo) => ({
      nombre: archivo.name,
      tipo: archivo.type,
      datos: archivo,
    })),
    data: {
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category || 'Hogar',
      type: data.type || 'servicio',
      neighborhood: data.neighborhood,
      price_range: data.price_range || 'A coordinar',
    },
    createdAt: new Date().toISOString(),
  }

  const db = await initDB()
  await db.put(OUTBOX_STORE, registro)
  return registro
}

export async function getOutboxItems() {
  const db = await initDB()
  return db.getAll(OUTBOX_STORE)
}

let sincronizacionActiva = null

// Reintenta solo las operaciones de la cuenta actual. No borra fallidas.
export async function sincronizarPendientes() {
  if (sincronizacionActiva) return sincronizacionActiva

  sincronizacionActiva = (async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    const owner_id = obtenerIdVecinoActual()
    if (!navigator.onLine || !token || !owner_id) {
      return { sincronizadas: 0, fallidas: 0, pendientes: 0 }
    }

    const db = await initDB()
    const entradas = (await db.getAll(OUTBOX_STORE)).filter(
      (entrada) =>
        entrada.owner_id === owner_id &&
        entrada.entity === 'items' &&
        entrada.action === 'create' &&
        entrada.client_id
    )

    if (!entradas.length) {
      return { sincronizadas: 0, fallidas: 0, pendientes: 0 }
    }

    // Las fotografías se suben al reconectar; el envío es idempotente por client_id.
    // El archivo local solo se descarta después de que el servidor confirma el anuncio.
    let sincronizadas = 0
    let fallidas = 0
    for (const entrada of entradas) {
      if (obtenerIdVecinoActual() !== owner_id) break
      let pendiente = entrada
      try {
        if (pendiente.archivos?.length && !pendiente.data?.images?.length) {
          const fotos = pendiente.archivos.map((archivo) =>
            new File([archivo.datos], archivo.nombre, { type: archivo.tipo })
          )
          const images = await subirImagenes(fotos)
          if (!Array.isArray(images) || images.length !== fotos.length) {
            throw new Error('El servidor no confirmó las fotografías de la cola.')
          }
          // Guardar las rutas antes de crear el anuncio, para poder reintentar
          // sin subir otra vez las fotografías si se interrumpe la conexión.
          pendiente = {
            ...pendiente,
            data: { ...pendiente.data, images },
            archivos: [],
          }
          await db.put(OUTBOX_STORE, pendiente)
        }
        if (!pendiente.data?.images?.length) {
          // Se conserva una entrada antigua sin fotos para que no se pierda.
          fallidas += 1
          continue
        }
        if (obtenerIdVecinoActual() !== owner_id) break
        const respuesta = await fetch(`${API_URL}/api/sync/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            queue: [{
              action: pendiente.action,
              entity: pendiente.entity,
              data: pendiente.data,
              client_id: pendiente.client_id,
            }],
          }),
        })
        const contenido = await respuesta.json().catch(() => null)
        if (!respuesta.ok) {
          throw new Error(contenido?.error || `Sincronización fallida (HTTP ${respuesta.status}).`)
        }
        const confirmadas = new Set([
          ...(contenido?.results?.synced || []),
          ...(contenido?.results?.duplicatesIgnored || []),
        ].map((item) => item.client_id).filter(Boolean))
        if (confirmadas.has(pendiente.client_id) && obtenerIdVecinoActual() === owner_id) {
          await db.delete(OUTBOX_STORE, pendiente.id)
          sincronizadas += 1
        } else {
          fallidas += 1
        }
      } catch (error) {
        console.warn('La publicación seguirá pendiente de sincronización:', error)
        fallidas += 1
      }
    }
    return { sincronizadas, fallidas, pendientes: (await db.getAll(OUTBOX_STORE)).filter((r) => r.owner_id === owner_id).length }
  })()

  try {
    return await sincronizacionActiva
  } finally {
    sincronizacionActiva = null
  }
}
