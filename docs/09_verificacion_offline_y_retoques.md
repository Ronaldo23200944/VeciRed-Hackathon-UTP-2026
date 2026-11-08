# VeciRed — últimos retoques y verificación real offline

## Qué cambió

1. Botón del asistente: **Continuar** (sin texto largo).
2. Bloque «Acuerdo concretado»: separado visualmente mediante espacio y línea divisoria.
3. «Mis publicaciones» en «Mi cuenta»: botón secundario, igual que sus vecinos.
4. «Eliminar publicación»: botón secundario rojo discreto en cada anuncio; pide confirmación; invoca el **DELETE /api/items/:id** existente, autenticado, que verifica la propiedad. La eliminación es **definitiva**, incluyendo reseñas vinculadas por la base de datos. Se retira de la pantalla al confirmarla el servidor, sin recarga.

## Antes de probar

- Arrancar Express desde `server` con `npm run dev` y comprobar `curl.exe http://localhost:3001/api/health`.
- En otra ventana arrancar `app`: `npm run dev -- --port 5173 --strictPort`.
- No ejecutar `npm run migrate`; la base ya está migrada.
- Las pruebas de eliminar deben hacerse con **una publicación de prueba**. No borres anuncios de tus compañeros.

## Pruebas visuales

- [ ] «Continuar» aparece en el paso 2 del asistente.
- [ ] «Acuerdo concretado» tiene separación entre selector y botón.
- [ ] «Mis publicaciones» se ve en modo contorno, igual que «Editar datos» y «Cerrar sesión».
- [ ] Crear anuncio de prueba con foto; verificar que sin foto no deja publicar.
- [ ] Marcarlo como concretado; permanece en Mis publicaciones, se actualiza sin recargar.
- [ ] En un anuncio de prueba distinto, elegir «Eliminar publicación» y **Cancelar**: no se elimina.
- [ ] Elegir «Eliminar publicación» y **Aceptar**: desaparece de Mis publicaciones y del catálogo; HTTP elimina solo anuncio propio.
- [ ] Probar el mismo flujo sin iniciar sesión: solo el propietario autenticado puede eliminar.

## Prueba PWA offline en navegador real

**Usar `npm run preview -- --port 4173 --strictPort` para PWA de producción**, no `npm run dev`.

1. Comprobar que el backend autoriza el origen `http://localhost:4173` en `FRONTEND_ORIGINS` si las pruebas requieren sesión/API; reiniciar backend tras cambiar la variable. Alternativa: usar las pruebas funcionales con `5173` y limitar `4173` a carga/cache offline.
2. Con conexión, abrir `http://localhost:4173` en Chrome o Edge; actualizar dos veces para que el service worker controle la pestaña.
3. En DevTools > Application > Service Workers comprobar que el trabajador está activado y que el manifest muestra «VeciRed» y los iconos.
4. Abrir DevTools > Network > Offline **en esa pestaña** y recargar. Esperado: la interfaz ya visitada sigue abriéndose gracias al precache.
5. Con la sesión de prueba previamente iniciada, abrir Publicar y completar oferta con una foto. Esperado: queda en la cola local IndexedDB y NO se afirma que llegó al backend. Ver DevTools > Application > IndexedDB > cola de salida.
6. Volver a Network > Online. Con sesión válida, esperar la sincronización. Esperado: la cola desaparece **solo después** de que el backend confirma la creación con imágenes. Revisar el anuncio en Mis publicaciones.
7. Comprobar el caso con token vencido, cuota de almacenamiento insuficiente o navegador en modo privado: puede requerir reautenticación o fallar el guardado local.

**Limitaciones:** los anuncios remotos no visitados y la API no se cachean automáticamente; offline no es garantía de disponer de todo el catálogo. La PWA instalada en celular requiere HTTPS para desplegar el service worker fuera de localhost. El frontend público de Vercel no podrá llegar al PostgreSQL/Express de tu computadora.

## Verificaciones automáticas sugeridas

```
cd /d D:\VeciRed-Hackathon-UTP-2026\app
npm run build
cd /d D:\VeciRed-Hackathon-UTP-2026
git diff --check
node "D:\VeciRed-RETOQUES-20261108\VeciRed_Retoques_Finales_UI_Offline_2026-11-08\VERIFICAR_ESTATICO.js"
```

Una compilación y un chequeo de archivos no reemplazan una prueba offline real en Edge/Chrome, ni las pruebas de seguridad API con usuarios distintos.
