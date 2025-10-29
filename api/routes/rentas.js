const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const { executeQuery, executeTransaction } = require('../config/database');
const router = express.Router();

// Validaciones para rentas
const rentaValidation = [
  body('idCliente').optional().isInt({ min: 1 }).withMessage('ID de cliente debe ser un número positivo'),
  body('idTraje').isInt({ min: 1 }).withMessage('ID de traje debe ser un número positivo'),
  body('fechaHoraInicio').isISO8601().withMessage('Fecha de inicio inválida'),
  body('fechaHoraFin').isISO8601().withMessage('Fecha de fin inválida'),
  body('precioTotal').optional().isFloat({ min: 0 }).withMessage('El precio debe ser un número positivo'),
  body('descripcion').optional().isLength({ max: 500 })
];

// GET /api/rentas - Obtener todas las rentas con paginación y filtros
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Página debe ser un número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe estar entre 1 y 100'),
  query('idCliente').optional().isInt({ min: 1 }),
  query('idTraje').optional().isInt({ min: 1 }),
  query('fechaHoraInicio').optional().isISO8601(),
  query('fechaHoraFin').optional().isISO8601()
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
    const idCliente = req.query.idCliente;
    const idTraje = req.query.idTraje;
    const fechaHoraInicio = req.query.fechaHoraInicio;
    const fechaHoraFin = req.query.fechaHoraFin;

    // Construir consulta con filtros
    let whereClause = 'WHERE 1=1';
    let params = [];
    let paramIndex = 1;

    if (idCliente) {
      whereClause += ` AND r.idCliente = ?${paramIndex}`;
      params.push(idCliente);
      paramIndex++;
    }

    if (idTraje) {
      whereClause += ` AND r.idTraje = ?${paramIndex}`;
      params.push(idTraje);
      paramIndex++;
    }

    if (fechaHoraInicio) {
      whereClause += ` AND r.fechaHoraInicio >= ?${paramIndex}`;
      params.push(fechaHoraInicio);
      paramIndex++;
    }

    if (fechaHoraFin) {
      whereClause += ` AND r.fechaHoraFin <= ?${paramIndex}`;
      params.push(fechaHoraFin);
      paramIndex++;
    }

    // Obtener total de registros
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM rentas r
      LEFT JOIN clientes c ON r.idCliente = c.idCliente
      JOIN trajes t ON r.idTraje = t.idTraje
      ${whereClause}
    `;
    const countResult = await executeQuery(countQuery, params);

    if (!countResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al contar rentas',
        error: countResult.error
      });
    }

    const total = countResult.rows[0].total;
    const totalPages = Math.ceil(total / limit);

    // Obtener rentas con paginación
    const rentasQuery = `
      SELECT r.idRenta, r.idCliente, r.idTraje, r.fechaHoraInicio, r.fechaHoraFin,
             r.costoTotal as precioTotal, r.descripcion, r.fechaCreacion, r.estado,
             COALESCE(c.nombreCliente, 'Sin asignar') as nombreCliente, 
             COALESCE(c.correoElectronico, '') as correoElectronico, 
             COALESCE(c.telefono, '') as telefono,
             t.nombreTraje
      FROM rentas r
      LEFT JOIN clientes c ON r.idCliente = c.idCliente
      JOIN trajes t ON r.idTraje = t.idTraje
      ${whereClause}
      ORDER BY r.fechaCreacion DESC
      LIMIT ?${paramIndex} OFFSET ?${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await executeQuery(rentasQuery, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener rentas',
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

// GET /api/rentas/activas - Obtener rentas activas
router.get('/activas', async (req, res) => {
  try {
    const query = `
      SELECT r.idRenta, r.fechaHoraInicio, r.fechaHoraFin, r.costoTotal as precioTotal,
             COALESCE(c.nombreCliente, 'Sin asignar') as nombreCliente, 
             COALESCE(c.telefono, '') as telefono,
             t.nombreTraje
      FROM rentas r
      LEFT JOIN clientes c ON r.idCliente = c.idCliente
      JOIN trajes t ON r.idTraje = t.idTraje
      WHERE r.estado = 'activa'
      ORDER BY r.fechaHoraInicio ASC
    `;

    const result = await executeQuery(query);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener rentas activas',
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

// GET /api/rentas/:id - Obtener una renta específica
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
      SELECT r.idRenta, r.idCliente, r.idTraje, r.fechaHoraInicio, r.fechaHoraFin,
             r.costoTotal as precioTotal, r.descripcion, r.fechaCreacion, r.estado,
             COALESCE(c.nombreCliente, 'Sin asignar') as nombreCliente, 
             COALESCE(c.correoElectronico, '') as correoElectronico,
             COALESCE(c.telefono, '') as telefono,
             t.nombreTraje
      FROM rentas r
      LEFT JOIN clientes c ON r.idCliente = c.idCliente
      JOIN trajes t ON r.idTraje = t.idTraje
      WHERE r.idRenta = ?1
    `;

    const result = await executeQuery(query, [id]);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener renta',
        error: result.error
      });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Renta no encontrada'
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

// POST /api/rentas - Crear nueva renta
router.post('/', rentaValidation, async (req, res) => {
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
      idCliente, idTraje, fechaHoraInicio, fechaHoraFin,
      precioTotal, descripcion
    } = req.body;

    // Validar que la fecha de fin sea posterior a la de inicio
    if (new Date(fechaHoraFin) <= new Date(fechaHoraInicio)) {
      return res.status(400).json({
        success: false,
        message: 'La fecha de fin debe ser posterior a la fecha de inicio'
      });
    }

    // Verificar que el cliente existe y está activo (solo si se proporciona idCliente)
    if (idCliente) {
      const clienteCheck = await executeQuery(
        'SELECT idCliente, activo FROM clientes WHERE idCliente = ?1',
        [idCliente]
      );

      if (!clienteCheck.success || clienteCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      if (clienteCheck.rows[0].activo !== 1) {
        return res.status(400).json({
          success: false,
          message: 'El cliente no está activo'
        });
      }
    }

    // Verificar que el traje existe y está disponible
    const trajeCheck = await executeQuery(
      'SELECT idTraje, estado, activo FROM trajes WHERE idTraje = ?1',
      [idTraje]
    );

    if (!trajeCheck.success || trajeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Traje no encontrado'
      });
    }

    if (trajeCheck.rows[0].estado !== 'disponible' || trajeCheck.rows[0].activo !== 1) {
      return res.status(400).json({
        success: false,
        message: 'El traje no está disponible'
      });
    }

    // Verificar que no hay conflictos de fechas (verificar si hay rentas activas)
    const conflictoQuery = `
      SELECT COUNT(*) as count FROM rentas 
      WHERE idTraje = ?1 
      AND estado = 'activa'
      AND (
        (fechaHoraInicio <= ?2 AND fechaHoraFin >= ?2) OR
        (fechaHoraInicio <= ?3 AND fechaHoraFin >= ?3) OR
        (fechaHoraInicio >= ?2 AND fechaHoraFin <= ?3)
      )
    `;

    const conflictoCheck = await executeQuery(conflictoQuery, [idTraje, fechaHoraInicio, fechaHoraFin]);

    if (conflictoCheck.success && conflictoCheck.rows[0].count > 0) {
      return res.status(409).json({
        success: false,
        message: 'El traje ya está rentado en las fechas seleccionadas'
      });
    }

    // Crear la renta y actualizar el estado del traje en una transacción
    const queries = [
      {
        sql: `
          INSERT INTO rentas (
            idCliente, idTraje, fechaHoraInicio, fechaHoraFin,
            costoTotal, descripcion, fechaCreacion
          ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, datetime('now')
          )
        `,
        params: [idCliente, idTraje, fechaHoraInicio, fechaHoraFin, precioTotal, descripcion || null]
      },
      {
        sql: 'UPDATE trajes SET estado = "rentado" WHERE idTraje = ?1',
        params: [idTraje]
      }
    ];

    const transactionResult = await executeTransaction(queries);

    if (!transactionResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al crear renta',
        error: transactionResult.error
      });
    }

    // Obtener la renta creada con información completa
    const newRentaId = transactionResult.results[0].lastInsertRowid;
    const newRentaQuery = `
      SELECT r.idRenta, r.idCliente, r.idTraje, r.fechaHoraInicio, r.fechaHoraFin, r.estado,
             r.costoTotal as precioTotal, r.descripcion, r.fechaCreacion,
             COALESCE(c.nombreCliente, 'Sin asignar') as nombreCliente, 
             t.nombreTraje
      FROM rentas r
      LEFT JOIN clientes c ON r.idCliente = c.idCliente
      JOIN trajes t ON r.idTraje = t.idTraje
      WHERE r.idRenta = ?1
    `;

    const newRenta = await executeQuery(newRentaQuery, [newRentaId]);

    res.status(201).json({
      success: true,
      message: 'Renta creada exitosamente',
      data: newRenta.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// PUT /api/rentas/:id - Actualizar renta
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
  body('fechaHoraInicio').optional().isISO8601().withMessage('Fecha de inicio inválida'),
  body('fechaHoraFin').optional().isISO8601().withMessage('Fecha de fin inválida'),
  body('estado').optional().isIn(['activa', 'completada', 'vencida', 'cancelada']).withMessage('Estado inválido'),
  body('precioTotal').optional().isFloat({ min: 0 }).withMessage('El precio debe ser un número positivo'),
  body('descripcion').optional().isLength({ max: 500 })
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
      fechaHoraInicio, fechaHoraFin, estado, precioTotal, descripcion
    } = req.body;

    // Verificar si la renta existe
    const rentaCheck = await executeQuery(
      'SELECT idRenta, idTraje FROM rentas WHERE idRenta = ?1',
      [id]
    );

    if (!rentaCheck.success || rentaCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Renta no encontrada'
      });
    }

    const rentaActual = rentaCheck.rows[0];

    // Validar fechas si se proporcionan
    if (fechaHoraInicio && fechaHoraFin && new Date(fechaHoraFin) <= new Date(fechaHoraInicio)) {
      return res.status(400).json({
        success: false,
        message: 'La fecha de fin debe ser posterior a la fecha de inicio'
      });
    }

    // Preparar queries para transacción
    const queries = [];
    
    // Query principal de actualización
    const updateFields = [];
    const params = [];
    let paramIndex = 1;

    if (fechaHoraInicio) {
      updateFields.push(`fechaHoraInicio = ?${paramIndex}`);
      params.push(fechaHoraInicio);
      paramIndex++;
    }

    if (fechaHoraFin) {
      updateFields.push(`fechaHoraFin = ?${paramIndex}`);
      params.push(fechaHoraFin);
      paramIndex++;
    }

    if (estado !== undefined) {
      updateFields.push(`estado = ?${paramIndex}`);
      params.push(estado);
      paramIndex++;
    }

    if (precioTotal !== undefined) {
      updateFields.push(`costoTotal = ?${paramIndex}`);
      params.push(precioTotal);
      paramIndex++;
    }

    if (descripcion !== undefined) {
      updateFields.push(`descripcion = ?${paramIndex}`);
      params.push(descripcion);
      paramIndex++;
    }

    updateFields.push('fechaActualizacion = datetime("now")');
    params.push(id);

    const updateQuery = `
      UPDATE rentas SET ${updateFields.join(', ')}
      WHERE idRenta = ?${paramIndex}
    `;

    queries.push({ sql: updateQuery, params });

    // Si se cambia el estado a completada o cancelada, actualizar el estado del traje a disponible
    if (estado === 'completada' || estado === 'cancelada') {
      queries.push({
        sql: 'UPDATE trajes SET estado = ?1 WHERE idTraje = ?2',
        params: ['disponible', rentaActual.idTraje]
      });
    }
    const transactionResult = await executeTransaction(queries);

    if (!transactionResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al actualizar renta',
        error: transactionResult.error
      });
    }

    // Obtener la renta actualizada
    const updatedRentaQuery = `
      SELECT r.idRenta, r.fechaHoraInicio, r.fechaHoraFin, r.estado,
             r.costoTotal as precioTotal, r.descripcion, r.fechaCreacion,
             c.nombreCliente, t.nombreTraje
      FROM rentas r
      JOIN clientes c ON r.idCliente = c.idCliente
      JOIN trajes t ON r.idTraje = t.idTraje
      WHERE r.idRenta = ?1
    `;

    const updatedRenta = await executeQuery(updatedRentaQuery, [id]);

    res.json({
      success: true,
      message: 'Renta actualizada exitosamente',
      data: updatedRenta.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// DELETE /api/rentas/:id - Cancelar renta
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

    // Verificar si la renta existe
    const rentaCheck = await executeQuery(
      'SELECT idRenta, idTraje, estado FROM rentas WHERE idRenta = ?1',
      [id]
    );

    if (!rentaCheck.success || rentaCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Renta no encontrada'
      });
    }

    const renta = rentaCheck.rows[0];

    // Solo se pueden cancelar rentas activas
    if (renta.estado !== 'activa') {
      return res.status(400).json({
        success: false,
        message: 'No se puede cancelar una renta que no está activa'
      });
    }

    // Cancelar la renta y liberar el traje
    const queries = [
      {
        sql: `
          UPDATE rentas SET 
            estado = 'cancelada'
          WHERE idRenta = ?1
        `,
        params: [id]
      },
      {
        sql: 'UPDATE trajes SET estado = "disponible" WHERE idTraje = ?1',
        params: [renta.idTraje]
      }
    ];

    const transactionResult = await executeTransaction(queries);

    if (!transactionResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al cancelar renta',
        error: transactionResult.error
      });
    }

    res.json({
      success: true,
      message: 'Renta cancelada exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// GET /api/rentas/estadisticas/resumen - Obtener estadísticas de rentas
router.get('/estadisticas/resumen', async (req, res) => {
  try {
    const queries = [
      { name: 'total', sql: 'SELECT COUNT(*) as count FROM rentas' },
      { name: 'activas', sql: 'SELECT COUNT(*) as count FROM rentas WHERE estado = \'activa\'' },
      { name: 'completadas', sql: 'SELECT COUNT(*) as count FROM rentas WHERE estado = \'completada\'' },
      { name: 'ingresos_mes', sql: `
        SELECT COALESCE(SUM(costoTotal), 0) as total 
        FROM rentas 
        WHERE estado = 'completada' 
        AND strftime('%Y-%m', fechaCreacion) = strftime('%Y-%m', 'now')
      ` },
      { name: 'ingresos_total', sql: `
        SELECT COALESCE(SUM(costoTotal), 0) as total 
        FROM rentas 
        WHERE estado = 'completada'
      ` }
    ];

    const estadisticas = {};

    for (const query of queries) {
      const result = await executeQuery(query.sql);
      if (result.success) {
        if (query.name.includes('ingresos')) {
          estadisticas[query.name] = result.rows[0].total;
        } else {
          estadisticas[query.name] = result.rows[0].count;
        }
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