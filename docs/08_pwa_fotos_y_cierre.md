# VeciRed: fotos obligatorias, concreción inmediata y PWA (8 de noviembre de 2026)

## Qué cambia
- Publicar exige 1-3 fotografías JPG/PNG/WebP (hasta 5 MB por imagen), tanto en la interfaz como en `POST /api/items` y en `/api/sync/batch`.
- En **Mis publicaciones**, el estado se actualiza en pantalla inmediatamente sin salir ni actualizar el navegador. La app recibe el item modificado (`onChanged(item)`).
- Publicación sin conexión: las fotos (File/Blob) se guardan en IndexedDB con el anuncio, y al reconectar se suben mediante `/api/uploads` antes de enviar el registro a `/api/sync/batch`. Si falla, queda pendiente. Sin conexión no se validan cuentas nuevas ni se puede consultar el servidor.
- Los iconos de la PWA son PNG reales de 192×192 y 512×512, en lugar de una referencia SVG con tamaños incorrectos.

## Instalación
La aplicación **no necesita compilarse como APK ni EXE** para instalarse. La PWA usa manifest, service worker e IndexedDB.
1. Desde la versión HTTPS publicada en Vercel, abrir **Edge**, menú `...` → **Aplicaciones** → **Instalar este sitio como una aplicación**; o en **Chrome** usar **Instalar** en la barra o menú.
2. En Android Chrome: menú `...` → **Instalar aplicación** / **Añadir a pantalla de inicio**.
3. iPhone: Safari → **Compartir** → **Añadir a pantalla de inicio**.
4. Abrir la app **online al menos una vez**, luego cortar Internet y volver a abrirla. La interfaz cacheada puede funcionar, pero datos de PostgreSQL y fotos remotas no están disponibles sin caché; la sincronización de anuncios pendientes requiere volver a estar online, un inicio de sesión válido y API accesible.

## Prueba local de producción
En un CMD: `cd /d D:\VeciRed-Hackathon-UTP-2026\app && npm run build && npm run preview -- --port 4173 --strictPort`. Abrir `http://localhost:4173` (no confiar exclusivamente en `npm run dev` para probar Service Worker).

## Pruebas obligatorias
- El paso 2 no deja continuar sin una foto; quitar la única foto desde el paso 3/confirmación impide publicar.
- Crear publicación online con 1 foto, revisar y confirmar; revisar en Explorar.
- En Mis publicaciones, marcar como concretada; debe aparecer estado `Concretado: venta` (u otro) y permanecer en la página sin recargar; el catálogo debe ocultar el anuncio concretado.
- Sin Internet: crear con foto, debe guardar pendiente en el dispositivo. Reconectar y comprobar que aparece en PostgreSQL con una foto (confirmar también tras recargar la página).
- Verificar manifest e iconos (Chrome DevTools → Application → Manifest), Service Worker y funcionamiento offline en `http://localhost:4173`.

## Advertencias
- Un dispositivo nuevo no puede obtener los datos nuevos de PostgreSQL estando offline; solo conserva lo que se haya cacheado/guardado previamente.
- Los archivos pendientes permanecen en **ese navegador/dispositivo**. No limpiar datos del sitio antes de sincronizarlos.
- Si el backend público sigue apuntando a `localhost:3001` en el navegador de otras personas, el despliegue de Vercel solo mostrará el frontend; para funciones reales debes publicar Express, PostgreSQL y almacenamiento persistente de fotografías.
- Las publicaciones pendientes **antiguas sin fotografía** se conservan en IndexedDB pero no podrán sincronizarse por la nueva regla. No se descartan.
- Un panel de administración real requiere roles autorizados en JWT, permisos de backend, auditoría y controles de moderación; se recomienda como fase posterior, no como atajo visual en este cierre.
