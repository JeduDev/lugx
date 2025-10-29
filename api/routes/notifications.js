const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const { executeQuery } = require('../config/database');
const { verifyToken } = require('./auth');
const router = express.Router();

// Middleware para verificar autenticación en todas las rutas
router.use(verifyToken);

// Validaciones para notificaciones
const notificationValidation = [
  body('titulo').notEmpty().withMessage('El título es requerido').isLength({ min: 2, max: 200 }),
  body('mensaje').notEmpty().withMessage('El mensaje es requerido').isLength({ min: 5, max: 1000 }),
  body('tipo').optional().isIn(['info', 'success', 'warning', 'error']).withMessage('El tipo debe ser: info, success, warning o error'),
  body('idUsuario').optional().isInt({ min: 1 }).withMessage('ID de usuario debe ser un número positivo'),
  body('idRenta').optional().isInt({ min: 1 }).withMessage('ID de renta debe ser un número positivo'),
  body('activa').optional().isIn([0, 1]).withMessage('El estado activo debe ser 0 o 1')
];

// GET /api/notifications - Obtener todas las notificaciones con paginación y filtros
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Página debe ser un número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe estar entre 1 y 100'),
  query('search').optional().isLength({ max: 100 }),
  query('tipo').optional().isIn(['info', 'success', 'warning', 'error']).withMessage('Tipo inválido'),
  query('status').optional().isIn(['read', 'unread']).withMessage('Estado debe ser read o unread')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const tipo = req.query.tipo;
    const status = req.query.status;

    // Construir consulta con filtros
    let whereClause = 'WHERE 1=1';
    let params = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (titulo LIKE ?${paramIndex} OR mensaje LIKE ?${paramIndex + 1})`;
      params.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    if (tipo) {
      whereClause += ` AND tipo = ?${paramIndex}`;
      params.push(tipo);
      paramIndex++;
    }

    if (status === 'read') {
      whereClause += ` AND leida = ?${paramIndex}`;
      params.push(1);
      paramIndex++;
    } else if (status === 'unread') {
      whereClause += ` AND leida = ?${paramIndex}`;
      params.push(0);
      paramIndex++;
    }

    // Obtener total de registros
    const countQuery = `SELECT COUNT(*) as total FROM notificaciones ${whereClause}`;
    const countResult = await executeQuery(countQuery, params);

    if (!countResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al contar notificaciones',
        error: countResult.error
      });
    }

    const total = countResult.rows[0].total;
    const totalPages = Math.ceil(total / limit);

    // Obtener notificaciones con paginación
    const notificationsQuery = `
      SELECT idNotificacion, titulo, mensaje, tipo, idUsuario, idRenta, 
             leida, fechaCreacion, fechaLectura, activa
      FROM notificaciones 
      ${whereClause}
      ORDER BY fechaCreacion DESC
      LIMIT ?${paramIndex} OFFSET ?${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await executeQuery(notificationsQuery, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener notificaciones',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: {
        notifications: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// GET /api/notifications/:id - Obtener una notificación específica
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const query = `
      SELECT idNotificacion, titulo, mensaje, tipo, idUsuario, idRenta, 
             leida, fechaCreacion, fechaLectura, activa
      FROM notificaciones 
      WHERE idNotificacion = ?1
    `;

    const result = await executeQuery(query, [id]);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener notificación',
        error: result.error
      });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// POST /api/notifications - Crear nueva notificación
router.post('/', notificationValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const {
      titulo, mensaje, tipo, idUsuario, idRenta, activa
    } = req.body;

    const query = `
      INSERT INTO notificaciones (
        titulo, mensaje, tipo, idUsuario, idRenta, leida, fechaCreacion, activa
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5, 0, datetime('now'), ?6
      )
    `;

    const params = [
      titulo.trim(), 
      mensaje.trim(), 
      tipo || 'info', 
      idUsuario || null, 
      idRenta || null, 
      activa !== undefined ? activa : 1
    ];

    const result = await executeQuery(query, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al crear notificación',
        error: result.error
      });
    }

    // Obtener la notificación creada
    const newNotificationQuery = `
      SELECT idNotificacion, titulo, mensaje, tipo, idUsuario, idRenta, 
             leida, fechaCreacion, fechaLectura, activa
      FROM notificaciones 
      WHERE idNotificacion = ?1
    `;

    const newNotification = await executeQuery(newNotificationQuery, [result.lastInsertRowid]);

    res.status(201).json({
      success: true,
      message: 'Notificación creada exitosamente',
      data: newNotification.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// PUT /api/notifications/:id - Actualizar notificación
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
  ...notificationValidation
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const {
      titulo, mensaje, tipo, idUsuario, idRenta, activa, leida
    } = req.body;

    // Verificar si la notificación existe
    const notificationCheck = await executeQuery('SELECT idNotificacion FROM notificaciones WHERE idNotificacion = ?1', [id]);
    if (!notificationCheck.success || notificationCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }

    const query = `
      UPDATE notificaciones SET
        titulo = ?1, mensaje = ?2, tipo = ?3, idUsuario = ?4, idRenta = ?5, activa = ?6, leida = ?7
      WHERE idNotificacion = ?8
    `;

    const params = [
      titulo.trim(), 
      mensaje.trim(), 
      tipo || 'info', 
      idUsuario || null, 
      idRenta || null, 
      activa !== undefined ? activa : 1, 
      leida !== undefined ? (leida ? 1 : 0) : 0,
      id
    ];

    const result = await executeQuery(query, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al actualizar notificación',
        error: result.error
      });
    }

    // Obtener la notificación actualizada
    const updatedNotificationQuery = `
      SELECT idNotificacion, titulo, mensaje, tipo, idUsuario, idRenta, 
             leida, fechaCreacion, fechaLectura, activa
      FROM notificaciones 
      WHERE idNotificacion = ?1
    `;

    const updatedNotification = await executeQuery(updatedNotificationQuery, [id]);

    res.json({
      success: true,
      message: 'Notificación actualizada exitosamente',
      data: updatedNotification.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// DELETE /api/notifications/:id - Eliminar notificación (soft delete)
router.delete('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido',
        errors: errors.array()
      });
    }

    const { id } = req.params;

    // Verificar si la notificación existe
    const notificationCheck = await executeQuery('SELECT idNotificacion, activa FROM notificaciones WHERE idNotificacion = ?1', [id]);
    if (!notificationCheck.success || notificationCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }

    // Soft delete - cambiar estado a inactivo
    const query = `
      UPDATE notificaciones SET 
        activa = 0
      WHERE idNotificacion = ?1
    `;

    const result = await executeQuery(query, [id]);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al eliminar notificación',
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Notificación eliminada exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// PATCH /api/notifications/:id/read - Marcar notificación como leída/no leída
router.patch('/:id/read', [
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
  body('leida').optional().isBoolean().withMessage('Leída debe ser un valor booleano')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { leida = true } = req.body;

    // Verificar si la notificación existe
    const notificationCheck = await executeQuery('SELECT idNotificacion FROM notificaciones WHERE idNotificacion = ?1', [id]);
    if (!notificationCheck.success || notificationCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }

    const query = `
      UPDATE notificaciones SET 
        leida = ?1, 
        fechaLectura = CASE WHEN ?1 = 1 THEN datetime('now') ELSE NULL END
      WHERE idNotificacion = ?2
    `;

    const result = await executeQuery(query, [leida ? 1 : 0, id]);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al actualizar estado de notificación',
        error: result.error
      });
    }

    // Obtener la notificación actualizada
    const updatedNotificationQuery = `
      SELECT idNotificacion, titulo, mensaje, tipo, idUsuario, idRenta, 
             leida, fechaCreacion, fechaLectura, activa
      FROM notificaciones 
      WHERE idNotificacion = ?1
    `;

    const updatedNotification = await executeQuery(updatedNotificationQuery, [id]);

    res.json({
      success: true,
      message: `Notificación marcada como ${leida ? 'leída' : 'no leída'}`,
      data: updatedNotification.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// GET /api/notifications/stats/summary - Obtener estadísticas de notificaciones
router.get('/stats/summary', async (req, res) => {
  try {
    // Total de notificaciones
    const totalResult = await executeQuery('SELECT COUNT(*) as total FROM notificaciones');
    if (!totalResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
        error: totalResult.error
      });
    }

    // Notificaciones no leídas
    const unreadResult = await executeQuery('SELECT COUNT(*) as unread FROM notificaciones WHERE leida = 0');
    if (!unreadResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
        error: unreadResult.error
      });
    }

    // Notificaciones activas
    const activeResult = await executeQuery('SELECT COUNT(*) as active FROM notificaciones WHERE activa = 1');
    if (!activeResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
        error: activeResult.error
      });
    }

    // Notificaciones de hoy
    const todayResult = await executeQuery('SELECT COUNT(*) as today FROM notificaciones WHERE date(fechaCreacion) = date("now")');
    if (!todayResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
        error: todayResult.error
      });
    }

    // Notificaciones por tipo
    const byTypeResult = await executeQuery('SELECT tipo, COUNT(*) as count FROM notificaciones GROUP BY tipo');
    if (!byTypeResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
        error: byTypeResult.error
      });
    }

    res.json({
      success: true,
      data: {
        total: totalResult.rows[0].total,
        unread: unreadResult.rows[0].unread,
        active: activeResult.rows[0].active,
        today: todayResult.rows[0].today,
        byType: byTypeResult.rows
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;