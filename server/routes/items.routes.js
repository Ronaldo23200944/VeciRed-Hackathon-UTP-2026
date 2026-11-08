
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Solo se aceptan rutas de imágenes creadas por el sistema de subidas.
const UPLOAD_IMAGE_PATTERN =
  /^\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i;

function imagenesValidas(images) {
  return (
    Array.isArray(images) &&
    images.length >= 1 &&
    images.length <= 3 &&
    images.every(
      (image) =>
        typeof image === 'string' &&
        UPLOAD_IMAGE_PATTERN.test(image)
    )
  );
}

// ------------------------------------------------------------------------------
// GET /api/items - Consultar catálogo y filtrar publicaciones
// ------------------------------------------------------------------------------
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      search,
      category,
      type,
      neighborhood,
      emergency_only,
      min_rating,
      user_id,
      limit = 50,
      offset = 0,
    } = req.query;

    const conditions = ["i.status = 'activo'"];
    const params = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(
        `(i.title ILIKE $${paramIndex} OR i.description ILIKE $${paramIndex} OR i.category ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (category) {
      conditions.push(`i.category ILIKE $${paramIndex}`);
      params.push(`%${category}%`);
      paramIndex++;
    }

    if (type) {
      conditions.push(`i.type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    if (neighborhood) {
      conditions.push(`i.neighborhood ILIKE $${paramIndex}`);
      params.push(`%${neighborhood}%`);
      paramIndex++;
    }

    if (emergency_only === 'true' || emergency_only === '1') {
      conditions.push('i.emergency_service = true');
    }

    if (min_rating) {
      conditions.push(`i.avg_rating >= $${paramIndex}`);
      params.push(parseFloat(min_rating));
      paramIndex++;
    }

    if (user_id) {
      conditions.push(`i.user_id = $${paramIndex}`);
      params.push(user_id);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const sqlText = `
      SELECT
        i.id,
        i.user_id,
        i.type,
        i.title,
        i.description,
        i.images,
        i.category,
        i.price_range,
        i.currency,
        i.availability,
        i.neighborhood,
        i.latitude,
        i.longitude,
        i.phone_contact,
        i.status,
        i.avg_rating,
        i.reviews_count,
        i.emergency_service,
        i.client_id,
        i.created_at,
        u.full_name AS author_name,
        u.verified_neighbor AS author_verified,
        u.phone AS author_phone
      FROM items i
      JOIN users u ON u.id = i.user_id
      ${whereClause}
      ORDER BY
        i.emergency_service DESC,
        i.avg_rating DESC,
        i.created_at DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1};
    `;

    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await query(sqlText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en GET /items:', error);
    res.status(500).json({
      error: 'Error al consultar el catálogo de productos y servicios',
    });
  }
});

// ------------------------------------------------------------------------------
// GET /api/items/:id - Consultar detalle de una publicación
// ------------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const itemSql = `
      SELECT
        i.*,
        u.full_name AS author_name,
        u.email AS author_email,
        u.neighborhood AS author_neighborhood,
        u.verified_neighbor AS author_verified,
        u.reputation_score AS author_reputation,
        u.bio AS author_bio
      FROM items i
      JOIN users u ON u.id = i.user_id
      WHERE i.id = $1;
    `;

    const itemRes = await query(itemSql, [id]);

    if (itemRes.rows.length === 0) {
      return res.status(404).json({
        error: 'Producto o servicio no encontrado',
      });
    }

    const reviewsSql = `
      SELECT
        r.id,
        r.rating,
        r.comment,
        r.neighbor_verified,
        r.created_at,
        u.id AS reviewer_id,
        u.full_name AS reviewer_name,
        u.neighborhood AS reviewer_neighborhood
      FROM reviews r
      JOIN users u ON u.id = r.reviewer_id
      WHERE r.item_id = $1
      ORDER BY r.created_at DESC;
    `;

    const reviewsRes = await query(reviewsSql, [id]);

    const item = itemRes.rows[0];
    item.reviews = reviewsRes.rows;

    res.json(item);
  } catch (error) {
    console.error('Error en GET /items/:id:', error);
    res.status(500).json({
      error: 'Error al cargar la información detallada',
    });
  }
});

// ------------------------------------------------------------------------------
// POST /api/items - Crear publicación con hasta 3 imágenes
// ------------------------------------------------------------------------------
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      type = 'servicio',
      price_range = 'A convenir',
      currency = 'PEN',
      availability = 'Inmediata',
      neighborhood,
      latitude,
      longitude,
      phone_contact,
      emergency_service = false,
      client_id,
      images = [],
    } = req.body;

    if (
      ![title, description, category].every(
        (value) =>
          typeof value === 'string' &&
          value.trim().length > 0
      )
    ) {
      return res.status(400).json({
        error: 'Los campos title, description y category son requeridos.',
      });
    }

    if (!imagenesValidas(images)) {
      return res.status(400).json({
        error: 'Para publicar debes añadir entre una y tres fotografías válidas de VeciRed.',
      });
    }

    // Evitar publicaciones duplicadas al sincronizar.
    if (client_id) {
      const existing = await query(
        'SELECT * FROM items WHERE client_id = $1',
        [client_id]
      );

      if (existing.rows.length > 0) {
        return res.status(200).json({
          message: 'Publicación sincronizada previamente (idempotencia)',
          item: existing.rows[0],
        });
      }
    }

    const itemNeighborhood =
      neighborhood || req.user.neighborhood || 'Zona Vecinal';

    const itemPhone =
      phone_contact || req.user.phone || '';

    const insertSql = `
      INSERT INTO items (
        user_id,
        type,
        title,
        description,
        category,
        price_range,
        currency,
        availability,
        neighborhood,
        latitude,
        longitude,
        phone_contact,
        emergency_service,
        client_id,
        images
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15
      )
      RETURNING *;
    `;

    const result = await query(insertSql, [
      req.user.id,
      type,
      title.trim(),
      description.trim(),
      category.trim(),
      price_range,
      currency,
      availability,
      itemNeighborhood,
      latitude || req.user.latitude || null,
      longitude || req.user.longitude || null,
      itemPhone,
      emergency_service,
      client_id || null,
      images,
    ]);

    res.status(201).json({
      message: 'Publicación creada exitosamente en el catálogo vecinal',
      item: result.rows[0],
    });
  } catch (error) {
    console.error('Error en POST /items:', error);
    res.status(500).json({
      error: 'Error al publicar en el catálogo',
    });
  }
});

// ------------------------------------------------------------------------------
// PUT /api/items/:id - Editar publicación y actualizar imágenes
// ------------------------------------------------------------------------------
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      description,
      category,
      type,
      price_range,
      availability,
      phone_contact,
      status,
      emergency_service,
      images,
    } = req.body;

    if (
      images !== undefined &&
      !imagenesValidas(images)
    ) {
      return res.status(400).json({
        error: 'Para publicar debes añadir entre una y tres fotografías válidas de VeciRed.',
      });
    }

    const existing = await query(
      'SELECT * FROM items WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'La publicación no existe.',
      });
    }

    const item = existing.rows[0];

    if (
      item.user_id !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        error:
          'Acceso Denegado: No tienes autorización para modificar la información de otro vecino.',
        code: 'FORBIDDEN_MODIFICATION',
      });
    }

    const updateSql = `
      UPDATE items
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        category = COALESCE($3, category),
        type = COALESCE($4, type),
        price_range = COALESCE($5, price_range),
        availability = COALESCE($6, availability),
        phone_contact = COALESCE($7, phone_contact),
        status = COALESCE($8, status),
        emergency_service = COALESCE($9, emergency_service),
        images = COALESCE($10::text[], images),
        updated_at = NOW()
      WHERE id = $11
      RETURNING *;
    `;

    const result = await query(updateSql, [
      title,
      description,
      category,
      type,
      price_range,
      availability,
      phone_contact,
      status,
      emergency_service,
      images ?? null,
      id,
    ]);

    res.json({
      message: 'Publicación actualizada correctamente',
      item: result.rows[0],
    });
  } catch (error) {
    console.error('Error en PUT /items/:id:', error);
    res.status(500).json({
      error: 'Error al actualizar la publicación',
    });
  }
});

// ------------------------------------------------------------------------------
// DELETE /api/items/:id - Eliminar publicación
// ------------------------------------------------------------------------------
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query(
      'SELECT * FROM items WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'La publicación no existe.',
      });
    }

    const item = existing.rows[0];

    if (
      item.user_id !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        error:
          'Acceso Denegado: No tienes autorización para eliminar una publicación ajena.',
        code: 'FORBIDDEN_DELETION',
      });
    }

    await query('DELETE FROM items WHERE id = $1', [id]);

    res.json({
      message: 'Publicación eliminada correctamente del catálogo',
      deleted_id: id,
    });
  } catch (error) {
    console.error('Error en DELETE /items/:id:', error);
    res.status(500).json({
      error: 'Error al eliminar la publicación',
    });
  }
});

export default router;
