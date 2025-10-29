const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const { executeQuery } = require('../config/database');
const router = express.Router();

// Validaciones para clientes
const clienteValidation = [
  body('nombreCliente').notEmpty().withMessage('El nombre del cliente es requerido').isLength({ min: 2, max: 100 }),
  body('telefono').notEmpty().withMessage('El teléfono es requerido').isLength({ min: 10, max: 15 }),
  body('correoElectronico').isEmail().withMessage('Correo electrónico inválido'),
  body('activo').optional().isIn([0, 1]).withMessage('El estado activo debe ser 0 o 1')
];

// GET /api/clientes - Obtener todos los clientes con paginación y filtros
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Página debe ser un número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe estar entre 1 y 100'),
  query('search').optional().isLength({ max: 100 }),
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
    const activo = req.query.activo;

    // Construir consulta con filtros
    let whereClause = 'WHERE 1=1';
    let params = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (nombreCliente LIKE ?${paramIndex} OR correoElectronico LIKE ?${paramIndex + 1} OR telefono LIKE ?${paramIndex + 2})`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      paramIndex += 3;
    }

    if (activo !== undefined) {
      whereClause += ` AND activo = ?${paramIndex}`;
      params.push(parseInt(activo));
      paramIndex++;
    }

    // Obtener total de registros
    const countQuery = `SELECT COUNT(*) as total FROM clientes ${whereClause}`;
    const countResult = await executeQuery(countQuery, params);

    if (!countResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al contar clientes',
        error: countResult.error
      });
    }

    const total = countResult.rows[0].total;
    const totalPages = Math.ceil(total / limit);

    // Obtener clientes con paginación
    const clientesQuery = `
      SELECT idCliente, nombreCliente, telefono, correoElectronico, 
             fechaRegistro, activo
      FROM clientes 
      ${whereClause}
      ORDER BY fechaRegistro DESC
      LIMIT ?${paramIndex} OFFSET ?${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await executeQuery(clientesQuery, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener clientes',
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

// GET /api/clientes/:id - Obtener un cliente específico
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
      SELECT idCliente, nombreCliente, telefono, correoElectronico, 
             fechaRegistro, activo
      FROM clientes 
      WHERE idCliente = ?1
    `;

    const result = await executeQuery(query, [id]);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener cliente',
        error: result.error
      });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
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

// POST /api/clientes - Crear nuevo cliente
router.post('/', clienteValidation, async (req, res) => {
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
      nombreCliente, telefono, correoElectronico, activo
    } = req.body;

    // Verificar si el correo electrónico ya existe
    const emailCheck = await executeQuery('SELECT idCliente FROM clientes WHERE correoElectronico = ?1', [correoElectronico]);
    if (emailCheck.success && emailCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'El correo electrónico ya está registrado'
      });
    }

    const query = `
      INSERT INTO clientes (
        nombreCliente, telefono, correoElectronico, fechaRegistro, activo
      ) VALUES (
        ?1, ?2, ?3, datetime('now'), ?4
      )
    `;

    const params = [
      nombreCliente, telefono, correoElectronico, activo !== undefined ? activo : 1
    ];

    const result = await executeQuery(query, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al crear cliente',
        error: result.error
      });
    }

    // Obtener el cliente creado
    const newClienteQuery = `
      SELECT idCliente, nombreCliente, telefono, correoElectronico, 
             fechaRegistro, activo
      FROM clientes 
      WHERE idCliente = ?1
    `;

    const newCliente = await executeQuery(newClienteQuery, [result.lastInsertRowid]);

    res.status(201).json({
      success: true,
      message: 'Cliente creado exitosamente',
      data: newCliente.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// PUT /api/clientes/:id - Actualizar cliente
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
  ...clienteValidation
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
      nombreCliente, telefono, correoElectronico, activo
    } = req.body;

    // Verificar si el cliente existe
    const clienteCheck = await executeQuery('SELECT idCliente FROM clientes WHERE idCliente = ?1', [id]);
    if (!clienteCheck.success || clienteCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    // Verificar si el correo electrónico ya existe en otro cliente
    const emailCheck = await executeQuery('SELECT idCliente FROM clientes WHERE correoElectronico = ?1 AND idCliente != ?2', [correoElectronico, id]);
    if (emailCheck.success && emailCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'El correo electrónico ya está registrado por otro cliente'
      });
    }

    const query = `
      UPDATE clientes SET
        nombreCliente = ?1, telefono = ?2, correoElectronico = ?3, activo = ?4
      WHERE idCliente = ?5
    `;

    const params = [
      nombreCliente, telefono, correoElectronico, activo !== undefined ? activo : 1, id
    ];

    const result = await executeQuery(query, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al actualizar cliente',
        error: result.error
      });
    }

    // Obtener el cliente actualizado
    const updatedClienteQuery = `
      SELECT idCliente, nombreCliente, telefono, correoElectronico, 
             fechaRegistro, activo
      FROM clientes 
      WHERE idCliente = ?1
    `;

    const updatedCliente = await executeQuery(updatedClienteQuery, [id]);

    res.json({
      success: true,
      message: 'Cliente actualizado exitosamente',
      data: updatedCliente.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// DELETE /api/clientes/:id - Eliminar cliente (soft delete)
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

    // Verificar si el cliente existe
    const clienteCheck = await executeQuery('SELECT idCliente, activo FROM clientes WHERE idCliente = ?1', [id]);
    if (!clienteCheck.success || clienteCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    // Verificar si tiene rentas activas
    const rentasActivas = await executeQuery(
      'SELECT COUNT(*) as count FROM rentas WHERE idCliente = ?1 AND estado IN ("pendiente", "activa")',
      [id]
    );

    if (rentasActivas.success && rentasActivas.rows[0].count > 0) {
      return res.status(409).json({
        success: false,
        message: 'No se puede eliminar el cliente porque tiene rentas activas'
      });
    }

    // Soft delete - cambiar estado a inactivo
    const query = `
      UPDATE clientes SET 
        activo = 0
      WHERE idCliente = ?1
    `;

    const result = await executeQuery(query, [id]);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al eliminar cliente',
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Cliente eliminado exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// GET /api/clientes/:id/rentas - Obtener historial de rentas de un cliente
router.get('/:id/rentas', [
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

    // Verificar si el cliente existe
    const clienteCheck = await executeQuery('SELECT idCliente FROM clientes WHERE idCliente = ?1', [id]);
    if (!clienteCheck.success || clienteCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    const query = `
      SELECT r.idRenta, r.fechaHoraInicio, r.fechaHoraFin, r.estado,
             r.costoTotal as precioTotal, r.observaciones,
             t.nombreTraje, t.tipo, t.color, t.talla
      FROM rentas r
      JOIN trajes t ON r.idTraje = t.idTraje
      WHERE r.idCliente = ?1
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

module.exports = router;