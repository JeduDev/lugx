const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const { executeQuery } = require('../config/database');
const router = express.Router();

// Validaciones para trajes
const trajeValidation = [
  body('nombreTraje').notEmpty().withMessage('El nombre del traje es requerido').isLength({ min: 2, max: 100 }),
  body('descripcion').optional().isLength({ max: 500 }),
  body('estado').optional().isIn(['disponible', 'rentado', 'mantenimiento', 'fuera_servicio']).withMessage('Estado inválido'),
  body('activo').optional().isIn([0, 1]).withMessage('El estado activo debe ser 0 o 1')
];

// GET /api/trajes - Obtener todos los trajes con paginación y filtros
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Página debe ser un número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe estar entre 1 y 100'),
  query('search').optional().isLength({ max: 100 }),
  query('estado').optional().isIn(['disponible', 'rentado', 'mantenimiento', 'fuera_servicio']).withMessage('Estado inválido'),
  query('activo').optional().isIn(['0', '1']).withMessage('El estado activo debe ser 0 o 1')
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
    const estado = req.query.estado;
    const activo = req.query.activo;

    // Construir consulta con filtros
    let whereClause = 'WHERE 1=1';
    let params = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (nombreTraje LIKE ?${paramIndex} OR descripcion LIKE ?${paramIndex + 1})`;
      params.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    if (estado) {
      whereClause += ` AND estado = ?${paramIndex}`;
      params.push(estado);
      paramIndex++;
    }

    if (activo !== undefined) {
      whereClause += ` AND activo = ?${paramIndex}`;
      params.push(parseInt(activo));
      paramIndex++;
    }

    // Obtener total de registros
    const countQuery = `SELECT COUNT(*) as total FROM trajes ${whereClause}`;
    const countResult = await executeQuery(countQuery, params);

    if (!countResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al contar trajes',
        error: countResult.error
      });
    }

    const total = countResult.rows[0].total;
    const totalPages = Math.ceil(total / limit);

    // Obtener trajes con paginación
    const trajesQuery = `
      SELECT idTraje, nombreTraje, descripcion, estado, fechaCreacion, activo
      FROM trajes 
      ${whereClause}
      ORDER BY fechaCreacion DESC
      LIMIT ?${paramIndex} OFFSET ?${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await executeQuery(trajesQuery, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener trajes',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
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

// GET /api/trajes/disponibles - Obtener solo trajes disponibles
router.get('/disponibles', async (req, res) => {
  try {
    const query = `
      SELECT idTraje, nombreTraje, descripcion, estado, fechaCreacion, activo
      FROM trajes 
      WHERE estado = 'disponible' AND activo = 1
      ORDER BY nombreTraje ASC
    `;

    const result = await executeQuery(query);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener trajes disponibles',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// GET /api/trajes/:id - Obtener un traje específico
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
      SELECT idTraje, nombreTraje, descripcion, estado, fechaCreacion, activo
      FROM trajes 
      WHERE idTraje = ?1
    `;

    const result = await executeQuery(query, [id]);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener traje',
        error: result.error
      });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Traje no encontrado'
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

// POST /api/trajes - Crear nuevo traje
router.post('/', trajeValidation, async (req, res) => {
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
      nombreTraje, descripcion, estado, activo
    } = req.body;

    const query = `
      INSERT INTO trajes (
        nombreTraje, descripcion, estado, fechaCreacion, activo
      ) VALUES (
        ?1, ?2, ?3, datetime('now'), ?4
      )
    `;

    const params = [
      nombreTraje, 
      descripcion || null, 
      estado || 'disponible',
      activo !== undefined ? activo : 1
    ];

    const result = await executeQuery(query, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al crear traje',
        error: result.error
      });
    }

    // Obtener el traje creado
    const newTrajeQuery = `
      SELECT idTraje, nombreTraje, descripcion, estado, fechaCreacion, activo
      FROM trajes 
      WHERE idTraje = ?1
    `;

    const newTraje = await executeQuery(newTrajeQuery, [result.lastInsertRowid]);

    res.status(201).json({
      success: true,
      message: 'Traje creado exitosamente',
      data: newTraje.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// PUT /api/trajes/:id - Actualizar traje
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
  ...trajeValidation
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
      nombreTraje, descripcion, estado, activo
    } = req.body;

    // Verificar si el traje existe
    const trajeCheck = await executeQuery('SELECT idTraje, estado FROM trajes WHERE idTraje = ?1', [id]);
    if (!trajeCheck.success || trajeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Traje no encontrado'
      });
    }

    // Si se intenta cambiar el estado a 'disponible', verificar que no esté rentado
    if (estado === 'disponible') {
      const rentaActiva = await executeQuery(
        'SELECT COUNT(*) as count FROM rentas WHERE idTraje = ?1 AND estado = \'activa\'',
        [id]
      );

      if (rentaActiva.success && rentaActiva.rows[0].count > 0) {
        return res.status(409).json({
          success: false,
          message: 'No se puede marcar como disponible un traje que tiene rentas activas'
        });
      }
    }

    const query = `
      UPDATE trajes SET
        nombreTraje = ?1, descripcion = ?2, estado = ?3, activo = ?4
      WHERE idTraje = ?5
    `;

    const params = [
      nombreTraje, 
      descripcion || null, 
      estado || 'disponible',
      activo !== undefined ? activo : 1,
      id
    ];

    const result = await executeQuery(query, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al actualizar traje',
        error: result.error
      });
    }

    // Obtener el traje actualizado
    const updatedTrajeQuery = `
      SELECT idTraje, nombreTraje, descripcion, estado, fechaCreacion, activo
      FROM trajes 
      WHERE idTraje = ?1
    `;

    const updatedTraje = await executeQuery(updatedTrajeQuery, [id]);

    res.json({
      success: true,
      message: 'Traje actualizado exitosamente',
      data: updatedTraje.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// DELETE /api/trajes/:id - Eliminar traje (soft delete)
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

    // Verificar si el traje existe
    const trajeCheck = await executeQuery('SELECT idTraje, activo FROM trajes WHERE idTraje = ?1', [id]);
    if (!trajeCheck.success || trajeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Traje no encontrado'
      });
    }

    // Verificar si tiene rentas activas
    const rentasActivas = await executeQuery(
      'SELECT COUNT(*) as count FROM rentas WHERE idTraje = ?1 AND estado = \'activa\'',
      [id]
    );

    if (rentasActivas.success && rentasActivas.rows[0].count > 0) {
      return res.status(409).json({
        success: false,
        message: 'No se puede eliminar el traje porque tiene rentas activas'
      });
    }

    // Soft delete - cambiar activo a 0
    const query = `
      UPDATE trajes SET 
        activo = 0
      WHERE idTraje = ?1
    `;

    const result = await executeQuery(query, [id]);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al eliminar traje',
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Traje eliminado exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// GET /api/trajes/:id/historial - Obtener historial de rentas de un traje
router.get('/:id/historial', [
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

    // Verificar si el traje existe
    const trajeCheck = await executeQuery('SELECT idTraje FROM trajes WHERE idTraje = ?1', [id]);
    if (!trajeCheck.success || trajeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Traje no encontrado'
      });
    }

    const query = `
      SELECT r.idRenta, r.fechaHoraInicio, r.fechaHoraFin, r.estado,
             r.costoTotal as precioTotal, r.descripcion,
             c.nombreCliente, c.correoElectronico, c.telefono
      FROM rentas r
      JOIN clientes c ON r.idCliente = c.idCliente
      WHERE r.idTraje = ?1
      ORDER BY r.fechaHoraInicio DESC
    `;

    const result = await executeQuery(query, [id]);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener historial de rentas',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// GET /api/trajes/estadisticas/resumen - Obtener estadísticas de trajes
router.get('/estadisticas/resumen', async (req, res) => {
  try {
    const queries = [
      { name: 'total', sql: 'SELECT COUNT(*) as count FROM trajes WHERE activo = 1' },
      { name: 'disponibles', sql: 'SELECT COUNT(*) as count FROM trajes WHERE estado = "disponible" AND activo = 1' },
      { name: 'rentados', sql: 'SELECT COUNT(*) as count FROM trajes WHERE estado = "rentado" AND activo = 1' },
      { name: 'mantenimiento', sql: 'SELECT COUNT(*) as count FROM trajes WHERE estado = "mantenimiento" AND activo = 1' },
      { name: 'fuera_servicio', sql: 'SELECT COUNT(*) as count FROM trajes WHERE estado = "fuera_servicio" AND activo = 1' }
    ];

    const estadisticas = {};

    for (const query of queries) {
      const result = await executeQuery(query.sql);
      if (result.success) {
        estadisticas[query.name] = result.rows[0].count;
      }
    }

    res.json({
      success: true,
      data: estadisticas
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