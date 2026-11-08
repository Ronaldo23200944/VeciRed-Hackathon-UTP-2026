import { obtenerToken } from './veciredApi'

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '')

async function solicitar(ruta, metodo = 'GET', body, prefijo = '/api/my-items') {
  const token = obtenerToken()
  if (!token) throw new Error('Inicia sesión desde Mi cuenta para gestionar tus publicaciones.')
  let respuesta
  try {
    respuesta = await fetch(`${BASE}${prefijo}${ruta}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor de VeciRed.')
  }
  const datos = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok) throw new Error(datos.error || `Error HTTP ${respuesta.status}`)
  return datos
}

export const cargarMisPublicaciones = () => solicitar('')
export const editarMiPublicacion = (id, datos) => solicitar(`/${encodeURIComponent(id)}`, 'PUT', datos)
export const finalizarMiPublicacion = (id, completion_type) => solicitar(`/${encodeURIComponent(id)}/complete`, 'PATCH', { completion_type })
export const pausarMiPublicacion = (id) => solicitar(`/${encodeURIComponent(id)}/pause`, 'PATCH')
export const reactivarMiPublicacion = (id) => solicitar(`/${encodeURIComponent(id)}/reactivate`, 'PATCH')
export const eliminarMiPublicacion = (id) => solicitar(`/${encodeURIComponent(id)}`, 'DELETE', undefined, '/api/items')
