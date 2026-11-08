// ==============================================================================
// PROYECTO: VeciRed - Hackathon UTP 2026
// INTEGRANTE 2: Base de datos y lógica (Backend)
// ARCHIVO: server/routes/sync.routes.js
// DESCRIPCIÓN: Endpoint de sincronización por lotes para PWA Offline (Integrante 4)
// ==============================================================================

import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const UPLOAD_IMAGE_PATTERN = /^\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i;

/**
 * POST /api/sync/batch
 * Recibe un lote de operaciones pendientes almacenadas en IndexedDB durante el modo offline
 * Procesa cada operación con verificación de client_id para evitar registros duplicados.
 */
router.post('/batch', requireAuth, async (req, res) => {
  const { queue = [] } = req.body;

  if (!Array.isArray(queue) || queue.length === 0) {
    return res.status(400).json({ error: 'La cola de sincronización debe ser un arreglo no vacío.' });
  }

  const results = {
    synced: [],
    failed: [],
    duplicatesIgnored: [],
  };

  for (const item of queue) {
    const { action, entity, data, client_id } = item;

    try {
      if (entity === 'items' && action === 'create') {
        const images = data?.images;
        if (!Array.isArray(images) || images.length < 1 || images.length > 3 ||
            !images.every((image) => typeof image === 'string' && UPLOAD_IMAGE_PATTERN.test(image))) {
          results.failed.push({ client_id, entity, error: 'Se requiere al menos una fotografía válida.' });
          continue;
        }
        // Idempotencia: Verificar si ya existe con ese client_id
        if (client_id) {
          const check = await query('SELECT id FROM items WHERE client_id = $1', [client_id]);
          if (check.rows.length > 0) {
            results.duplicatesIgnored.push({ client_id, server_id: check.rows[0].id, entity });
            continue;
          }
        }

        const insert = await query(
          `INSERT INTO items (
            user_id, type, title, description, category, price_range, currency,
            availability, neighborhood, latitude, longitude, phone_contact,
            emergency_service, client_id, images
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::text[])
          RETURNING id, title;`,
          [
            req.user.id,
            data.type || 'servicio',
            data.title,
            data.description,
            data.category,
            data.price_range || 'A convenir',
            data.currency || 'PEN',
            data.availability || 'Inmediata',
            data.neighborhood || req.user.neighborhood,
            data.latitude || req.user.latitude || null,
            data.longitude || req.user.longitude || null,
            data.phone_contact || req.user.phone || '',
            Boolean(data.emergency_service),
            client_id || null,
            images,
          ]
        );

        results.synced.push({ client_id, server_id: insert.rows[0].id, entity });
      } else if (entity === 'solidarity_requests' && action === 'create') {
        if (client_id) {
          const check = await query('SELECT id FROM solidarity_requests WHERE client_id = $1', [client_id]);
          if (check.rows.length > 0) {
            results.duplicatesIgnored.push({ client_id, server_id: check.rows[0].id, entity });
            continue;
          }
        }

        const insert = await query(
          `INSERT INTO solidarity_requests (
            user_id, type, title, description, category, neighborhood,
            latitude, longitude, urgency, is_emergency, client_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id, title;`,
          [
            req.user.id,
            data.type,
            data.title,
            data.description,
            data.category,
            data.neighborhood || req.user.neighborhood,
            data.latitude || req.user.latitude || null,
            data.longitude || req.user.longitude || null,
            data.urgency || 'media',
            Boolean(data.is_emergency),
            client_id || null,
          ]
        );

        results.synced.push({ client_id, server_id: insert.rows[0].id, entity });
      } else if (entity === 'reviews' && action === 'create') {
        const insert = await query(
          `INSERT INTO reviews (item_id, reviewer_id, rating, comment)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (item_id, reviewer_id) DO NOTHING
           RETURNING id;`,
          [data.item_id, req.user.id, data.rating, data.comment]
        );

        if (insert.rows.length > 0) {
          results.synced.push({ client_id, server_id: insert.rows[0].id, entity });
        } else {
          results.duplicatesIgnored.push({ client_id, entity, reason: 'Ya existía una reseña para este ítem' });
        }
      } else {
        results.failed.push({ client_id, entity, error: `Acción o entidad no soportada: ${action} en ${entity}` });
      }
    } catch (err) {
      results.failed.push({ client_id, entity, error: err.message });
    }
  }

  res.json({
    message: 'Procesamiento de cola de sincronización completado',
    summary: {
      total: queue.length,
      syncedCount: results.synced.length,
      ignoredCount: results.duplicatesIgnored.length,
      failedCount: results.failed.length,
    },
    results,
  });
});

export default router;
